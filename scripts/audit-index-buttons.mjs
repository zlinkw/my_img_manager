import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-image-saver-button-audit-"));
const singleFixture = path.join(tempRoot, "single.html");
const multiFixture = path.join(tempRoot, "multi.html");
const libraryFixture = path.join(tempRoot, "library.html");
const offlineLibraryFixture = path.join(tempRoot, "library-offline.html");
const screenshotDirectory = getArgument("--screenshot-dir");
const mainSource = fs.readFileSync(path.join(root, "content", "pdf-image-saver.js"), "utf8");
const preferencesSource = fs.readFileSync(path.join(root, "content", "preferences.js"), "utf8");

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : "";
}

function parseCSSColor(value) {
  const channels = String(value || "").match(/[\d.]+/g)?.map(Number) || [];
  assert.ok(channels.length >= 3, `Unable to parse CSS color: ${value}`);
  return channels.slice(0, 3);
}

function getContrastRatio(foreground, background) {
  const luminance = (value) => {
    const channels = parseCSSColor(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function findBrowser() {
  const candidates = process.platform === "win32"
    ? [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ]
    : ["/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium"];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

async function waitFor(readValue, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await readValue();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastError || new Error("Timed out waiting for browser state");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextID = 1;
    this.pending = new Map();
    this.notifications = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        this.notifications.push(message);
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result || {});
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Browser evaluation failed");
  }
  return response.result?.value;
}

async function waitForDocument(client, expectedEntries) {
  await waitFor(async () => {
    const state = await evaluate(client, `({ready:document.readyState,entries:document.querySelectorAll('article.entry').length,readable:document.body.classList.contains('pdf-image-saver-readable')})`);
    return state?.ready === "complete" && state.entries === expectedEntries && state.readable;
  });
}

function captureFixedViewportScreenshot(client) {
  return client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
}

async function auditSinglePage() {
  var wait = function () { return new Promise(function (resolve) { setTimeout(resolve, 0); }); };
  var entries = Array.from(document.querySelectorAll("article.entry"));
  var buttons = Array.from(document.querySelectorAll("button"));
  var copyButtons = buttons.filter(function (button) {
    return button.classList.contains("copy-token") || button.classList.contains("palette-chip");
  });
  var copyDisclosureSummary = document.querySelector(".index-export-actions > summary");
  var unknownButtons = buttons.filter(function (button) {
    return !button.classList.contains("copy-token")
      && !button.classList.contains("palette-chip")
      && !button.classList.contains("filter-chip")
      && button.id !== "pdf-image-saver-clear-filters";
  });
  var expectedPayloads = copyButtons.map(function (button) { return button.getAttribute("data-copy") || button.title || ""; });
  window.__pdfImageSaverSyncCopies = [];
  document.execCommand = function (command) {
    var areas = document.querySelectorAll("textarea");
    var area = areas.length ? areas[areas.length - 1] : null;
    window.__pdfImageSaverSyncCopies.push({ command: command, text: area ? area.value : "" });
    return command === "copy";
  };
  var syncFeedback = [];
  for (var index = 0; index < copyButtons.length; index += 1) {
    var button = copyButtons[index];
    button.click();
    await Promise.resolve();
    var entry = button.closest(".entry");
    syncFeedback.push({
      global: document.getElementById("pdf-image-saver-action-status")?.textContent || "",
      local: entry?.querySelector(".entry-action-status")?.textContent || "",
      palette: button.classList.contains("palette-chip"),
      label: button.textContent,
    });
  }
  var clipboardButton = copyButtons.find(function (button) { return button.classList.contains("copy-token"); });
  var clipboardPayload = clipboardButton?.getAttribute("data-copy") || "";
  window.__pdfImageSaverClipboardCopies = [];
  document.execCommand = function () { return false; };
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: function (text) { window.__pdfImageSaverClipboardCopies.push(text); return Promise.resolve(); } },
  });
  clipboardButton?.click();
  await wait();
  var clipboardFeedback = clipboardButton?.textContent || "";
  var manualButton = copyButtons.filter(function (button) { return button.classList.contains("copy-token"); })[1] || clipboardButton;
  var manualPayload = manualButton?.getAttribute("data-copy") || "";
  window.__pdfImageSaverManualCopies = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: function () { return Promise.reject(new Error("denied")); } },
  });
  window.prompt = function (message, value) {
    window.__pdfImageSaverManualCopies.push({ message: message, value: value });
    return value;
  };
  manualButton?.click();
  await wait();
  await wait();
  var manualFeedback = manualButton?.textContent || "";
  var sourceLinks = Array.from(document.querySelectorAll('a[href^="zotero://"]'));
  var clickedLinks = [];
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a");
    if (!link) return;
    event.preventDefault();
    clickedLinks.push(link.getAttribute("href") || "");
  }, true);
  sourceLinks.forEach(function (link) { link.click(); });
  var linkFeedback = document.getElementById("pdf-image-saver-action-status")?.textContent || "";
  var detailsResults = Array.from(document.querySelectorAll("details")).map(function (details) {
    details.open = false;
    details.querySelector("summary")?.click();
    return details.open;
  });
  var sourceRegion = document.querySelector(".source-map-region");
  var sourceRegionStyle = sourceRegion ? getComputedStyle(sourceRegion) : null;
  return {
    buttonCount: buttons.length,
    copyButtonCount: copyButtons.length,
    unknownButtonCount: unknownButtons.length,
    entryCount: entries.length,
    readable: document.body.classList.contains("pdf-image-saver-readable"),
    workflowCount: document.querySelectorAll(".entry-workflow").length,
    hiddenTechnicalCount: entries.filter(function (entry) { return entry.querySelector(".entry-summary")?.hidden; }).length,
    localStatusCount: document.querySelectorAll(".entry-action-status").length,
    entryTitles: Array.from(document.querySelectorAll(".entry-title")).map(function (title) { return title.textContent.trim(); }),
    expectedPayloads: expectedPayloads,
    syncCopies: window.__pdfImageSaverSyncCopies,
    syncFeedback: syncFeedback,
    clipboardPayload: clipboardPayload,
    clipboardCopies: window.__pdfImageSaverClipboardCopies,
    clipboardFeedback: clipboardFeedback,
    manualPayload: manualPayload,
    manualCopies: window.__pdfImageSaverManualCopies,
    manualFeedback: manualFeedback,
    copyDisclosure: {
      text: copyDisclosureSummary?.textContent || "",
      title: copyDisclosureSummary?.title || "",
    },
    sourceLinks: sourceLinks.map(function (link) { return link.getAttribute("href") || ""; }),
    clickedLinks: clickedLinks,
    linkFeedback: linkFeedback,
    detailsResults: detailsResults,
    sourceMapPageLabel: document.querySelector(".source-map-page-label")?.textContent.trim() || "",
    sourceMapLegend: document.querySelector(".source-map-legend")?.textContent.trim() || "",
    sourceMapRegionStyle: sourceRegionStyle ? { borderStyle: sourceRegionStyle.borderTopStyle, borderColor: sourceRegionStyle.borderTopColor } : null,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  };
}

async function auditMultiPage() {
  var entries = Array.from(document.querySelectorAll("article.entry"));
  var imageNodes = Array.from(document.querySelectorAll("article.entry .preview-link img"));
  var sourceMaps = Array.from(document.querySelectorAll(".source-map"));
  var sourceMapRegions = Array.from(document.querySelectorAll(".source-map-region"));
  await Promise.all(imageNodes.map(function (img) { return typeof img.decode === "function" ? img.decode().catch(function () {}) : Promise.resolve(); }));
  var buttons = Array.from(document.querySelectorAll("button"));
  var filterButtons = buttons.filter(function (button) { return button.classList.contains("filter-chip"); });
  var clearButton = document.getElementById("pdf-image-saver-clear-filters");
  var filterDetails = document.getElementById("pdf-image-saver-index-filters");
  var filterSummary = document.getElementById("pdf-image-saver-filter-summary");
  var copyDisclosureSummary = document.querySelector(".index-export-actions > summary");
  var filtersInitiallyOpen = !!filterDetails?.open;
  filterSummary?.click();
  var filtersOpenAfterClick = !!filterDetails?.open;
  var jumpDetails = document.getElementById("pdf-image-saver-index-jumps");
  var jumpSummary = jumpDetails?.querySelector("summary");
  var jumpsInitiallyOpen = !!jumpDetails?.open;
  jumpSummary?.click();
  var jumpsOpenAfterClick = !!jumpDetails?.open;
  var unknownButtons = buttons.filter(function (button) {
    return !button.classList.contains("copy-token")
      && !button.classList.contains("palette-chip")
      && !button.classList.contains("filter-chip")
      && button.id !== "pdf-image-saver-clear-filters";
  });
  var results = [];
  for (var index = 0; index < filterButtons.length; index += 1) {
    var button = filterButtons[index];
    button.click();
    results.push({
      value: button.getAttribute("data-value"),
      pressed: button.getAttribute("aria-pressed"),
      clearDisabled: !!clearButton?.disabled,
      clearHidden: !!clearButton?.hidden,
      clearDisplay: clearButton ? getComputedStyle(clearButton).display : "",
      status: document.getElementById("pdf-image-saver-action-status")?.textContent || "",
      resultCountHidden: !!document.getElementById("pdf-image-saver-filter-status")?.hidden,
      summary: filterSummary?.textContent || "",
    });
    if (!clearButton?.disabled) clearButton.click();
  }
  if (filterDetails) filterDetails.open = false;
  if (jumpDetails) jumpDetails.open = false;
  return {
    entryCount: entries.length,
    workflowCount: document.querySelectorAll(".entry-workflow").length,
    filterButtonCount: filterButtons.length,
    unknownButtonCount: unknownButtons.length,
    results: results,
    clearDisabled: !!clearButton?.disabled,
    clearHidden: !!clearButton?.hidden,
    clearDisplay: clearButton ? getComputedStyle(clearButton).display : "",
    resultCountHiddenAfterAudit: !!document.getElementById("pdf-image-saver-filter-status")?.hidden,
    visibleEntries: entries.filter(function (entry) { return !entry.classList.contains("is-hidden"); }).length,
    tagLabels: Array.from(document.querySelectorAll('.filter-chip[data-filter="tag"]')).map(function (button) { return button.textContent.trim(); }),
    loadedImageCount: imageNodes.filter(function (img) { return img.complete && img.naturalWidth > 0; }).length,
    previewWidths: imageNodes.map(function (img) { return Math.round(img.getBoundingClientRect().width); }),
    sourceMapCaptions: Array.from(document.querySelectorAll(".source-map-caption")).map(function (caption) { return caption.textContent.trim(); }),
    sourceMapPageLabels: Array.from(document.querySelectorAll(".source-map-page-label")).map(function (label) { return label.textContent.trim(); }),
    sourceMapLegends: Array.from(document.querySelectorAll(".source-map-legend")).map(function (legend) { return legend.textContent.trim(); }),
    sourceMapWidths: sourceMaps.map(function (map) { return Math.round(map.getBoundingClientRect().width); }),
    sourceMapRegionStyles: sourceMapRegions.map(function (region) {
      var style = getComputedStyle(region);
      return { borderStyle: style.borderTopStyle, borderColor: style.borderTopColor };
    }),
    copyDisclosure: {
      text: copyDisclosureSummary?.textContent || "",
      title: copyDisclosureSummary?.title || "",
    },
    filterDisclosure: {
      exists: !!filterDetails,
      initiallyOpen: filtersInitiallyOpen,
      openAfterClick: filtersOpenAfterClick,
      openAfterAudit: !!filterDetails?.open,
      summary: filterSummary?.textContent || "",
    },
    jumpDisclosure: {
      exists: !!jumpDetails,
      initiallyOpen: jumpsInitiallyOpen,
      openAfterClick: jumpsOpenAfterClick,
      openAfterAudit: !!jumpDetails?.open,
      summary: jumpSummary?.textContent || "",
      targets: Array.from(jumpDetails?.querySelectorAll("a") || []).map(function (link) { return link.getAttribute("href") || ""; }),
    },
  };
}

async function auditLibraryPage() {
  var wait = async function (predicate) {
    if (!predicate) { await new Promise(function (resolve) { setTimeout(resolve, 0); }); return; }
    var deadline = Date.now() + 2000;
    while (!predicate()) {
      if (Date.now() >= deadline) throw new Error("gallery image state did not settle");
      await new Promise(function (resolve) { setTimeout(resolve, 20); });
    }
  };
  var cards = Array.from(document.querySelectorAll(".library-card"));
  var imageNodes = Array.from(document.querySelectorAll(".library-card img"));
  imageNodes.forEach(function (img) { img.loading = "eager"; });
  await Promise.all(imageNodes.map(function (img) { return typeof img.decode === "function" ? img.decode().catch(function () {}) : Promise.resolve(); }));
  var buttons = Array.from(document.querySelectorAll("button"));
  var obstructedImageCount = cards.filter(function (card) {
    var imageButton = card.querySelector(".image-button");
    if (!imageButton || imageButton.querySelector(":scope > :not(img)")) return true;
    var imageRect = imageButton.getBoundingClientRect();
    return Array.from(card.querySelectorAll(".selection-control,.image-dimensions")).some(function (element) {
      var rect = element.getBoundingClientRect();
      return rect.left < imageRect.right && rect.right > imageRect.left && rect.top < imageRect.bottom && rect.bottom > imageRect.top;
    });
  }).length;
  var unknownButtons = buttons.filter(function (button) {
    return !button.matches("#library-reset,#library-empty-reset,#library-filter-collapse,[data-view],[data-open-image],[data-edit-note],[data-note-save],[data-note-cancel],#viewer-close,#viewer-prev,#viewer-next,#viewer-zoom-out,#viewer-zoom-in,#viewer-zoom-actual,#viewer-zoom-fit,#select-visible,#clear-selection,#share-selected,#delete-selected,#refresh-library,#import-package,#mobile-clear-selection,#mobile-share-selected,#mobile-delete-selected,[data-editor-tool],#viewer-editor-undo,#viewer-editor-clear,#viewer-editor-original,#viewer-editor-save");
  });
  var category = document.getElementById("library-category");
  var search = document.getElementById("library-search");
  var sort = document.getElementById("library-sort");
  var source = document.getElementById("library-source");
  var reset = document.getElementById("library-reset");
  var sizeInput = document.getElementById("library-card-size");
  var sizeControl = document.getElementById("library-size-control");
  var grid = document.getElementById("library-grid");
  var table = document.getElementById("library-table");
  var selectionGuidance = document.getElementById("library-message")?.textContent || "";
  var isVisible = function (id) { return getComputedStyle(document.getElementById(id)).display !== "none"; };
  var initialBatchVisibility = {
    select: isVisible("select-visible"),
    clear: isVisible("clear-selection"),
    summary: isVisible("selection-summary"),
    import: isVisible("import-package"),
    share: isVisible("share-selected"),
    remove: isVisible("delete-selected"),
  };
  var selectionInputs = Array.from(document.querySelectorAll("[data-select-image]"));
  var cardDownloadNames = Array.from(document.querySelectorAll(".library-card a[download]")).map(function (link) { return link.getAttribute("download") || ""; });
  var cardDownloadTitles = Array.from(document.querySelectorAll(".library-card a[download]")).map(function (link) { return link.title || ""; });
  var desktopSelectionHints = selectionInputs.map(function (input) {
    return { title: input.title || "", aria: input.getAttribute("aria-label") || "" };
  });
  var desktopCardSelectionTitles = Array.from(document.querySelectorAll(".selection-control")).map(function (label) { return label.title || ""; });
  var visibleCount = function () { return cards.filter(function (card) { return !card.hidden; }).length; };
  var filterPanel = document.getElementById("library-filter-panel");
  var filterPanelSummary = filterPanel.querySelector("summary");
  var filterCollapse = document.getElementById("library-filter-collapse");
  var resultStatus = document.getElementById("library-status");
  try { localStorage.removeItem("pdf-image-saver-library-filters-open-v1"); } catch (_error) {}
  var initiallyClosedFilters = filterPanel.open === false;
  var initialResultStatusHidden = resultStatus?.hidden === true && getComputedStyle(resultStatus).display === "none";
  var initialCollapsedFilterHeaderHeight = Math.round(document.querySelector(".app-header").getBoundingClientRect().height);
  filterPanelSummary.click();
  await wait();
  var initialFilterReopened = filterPanel.open === true;
  var initialFilterReopenFocus = document.activeElement === category;
  var persistedInitialOpenFilters = localStorage.getItem("pdf-image-saver-library-filters-open-v1") || "";
  var lightSearchStyle = getComputedStyle(search);
  var lightImportStyle = getComputedStyle(document.getElementById("import-package"));
  var lightSegmentedStyle = getComputedStyle(document.querySelector(".segmented"));
  var lightBoundaries = {
    searchBorder: lightSearchStyle.borderTopColor,
    searchBackground: lightSearchStyle.backgroundColor,
    importBorder: lightImportStyle.borderTopColor,
    importBackground: lightImportStyle.backgroundColor,
    segmentedBorder: lightSegmentedStyle.borderTopColor,
    segmentedBackground: lightSegmentedStyle.backgroundColor,
  };
  category.value = "heatmap";
  category.dispatchEvent(new Event("change", { bubbles: true }));
  var expandedFilterHeaderHeight = Math.round(document.querySelector(".app-header").getBoundingClientRect().height);
  filterCollapse.focus();
  filterCollapse.click();
  await wait();
  var desktopFilterClosed = filterPanel.open === false;
  var desktopFilterSummaryVisible = getComputedStyle(filterPanelSummary).display !== "none";
  var desktopFilterCollapseFocus = document.activeElement === filterPanelSummary;
  var desktopCollapsedFilterValue = category.value;
  var desktopCollapsedFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var collapsedFilterHeaderHeight = Math.round(document.querySelector(".app-header").getBoundingClientRect().height);
  var persistedClosedFilters = localStorage.getItem("pdf-image-saver-library-filters-open-v1") || "";
  filterPanelSummary.click();
  await wait();
  var desktopFilterReopened = filterPanel.open === true;
  var desktopFilterReopenFocus = document.activeElement === category;
  var desktopReopenedFilterValue = category.value;
  var persistedOpenFilters = localStorage.getItem("pdf-image-saver-library-filters-open-v1") || "";
  reset.click();
  category.value = "heatmap";
  category.dispatchEvent(new Event("change", { bubbles: true }));
  var categoryVisible = visibleCount();
  var categoryResultStatus = { hidden: resultStatus?.hidden === true, text: resultStatus?.textContent || "" };
  var categoryFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var categoryFilterTitle = document.getElementById("library-filter-summary")?.title || "";
  source.value = "linked";
  source.dispatchEvent(new Event("change", { bubbles: true }));
  var multiFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var multiFilterTitle = document.getElementById("library-filter-summary")?.title || "";
  var filteredSelectVisibleLabel = document.getElementById("select-visible")?.textContent || "";
  reset.click();
  var resetFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var resetResultStatusHidden = resultStatus?.hidden === true;
  search.value = "论文图像示例 2";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  var searchVisible = visibleCount();
  var searchResultStatus = { hidden: resultStatus?.hidden === true, text: resultStatus?.textContent || "" };
  var searchFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var searchFilterTitle = document.getElementById("library-filter-summary")?.title || "";
  search.value = "不存在的图片条件";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  var emptySearchFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var emptySearchResultStatus = { hidden: resultStatus?.hidden === true, text: resultStatus?.textContent || "" };
  var emptySelectVisibleLabel = document.getElementById("select-visible")?.textContent || "";
  var emptySelectVisibleDisabled = document.getElementById("select-visible")?.disabled || false;
  var emptyReset = document.getElementById("library-empty-reset");
  var emptyResetVisible = !!emptyReset && getComputedStyle(emptyReset).display !== "none";
  var emptyResetLabel = emptyReset?.textContent || "";
  var emptyMessage = document.getElementById("library-empty")?.textContent || "";
  emptyReset?.click();
  var emptyResetRestored = visibleCount();
  var emptyResetFocusedSearch = document.activeElement === search;
  var emptyResetFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var emptyResetResultStatusHidden = resultStatus?.hidden === true;
  sort.value = "size-desc";
  sort.dispatchEvent(new Event("change", { bubbles: true }));
  var sortOnlyResultStatusHidden = resultStatus?.hidden === true;
  var sortFilterSummary = document.getElementById("library-filter-summary")?.textContent || "";
  var sortFilterTitle = document.getElementById("library-filter-summary")?.title || "";
  var sortedFirstSize = Number(grid.querySelector(".library-card:not([hidden])")?.dataset.size || 0);
  sizeInput.value = "420";
  sizeInput.dispatchEvent(new Event("input", { bubbles: true }));
  var cardSize = getComputedStyle(document.documentElement).getPropertyValue("--card-min-width").trim();
  var cardColumnCount = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length;
  var cardLayoutLabel = document.getElementById("library-card-layout")?.textContent || "";
  var cardSizeAria = sizeInput.getAttribute("aria-valuetext") || "";
  var cardColumnCount = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length;
  var cardLayoutLabel = document.getElementById("library-card-layout")?.textContent || "";
  var cardSizeAria = sizeInput.getAttribute("aria-valuetext") || "";
  source.value = "linked";
  source.dispatchEvent(new Event("change", { bubbles: true }));
  var linkedVisible = visibleCount();
  reset.click();
  var galleryTab = document.querySelector('button[data-view="gallery"]');
  var tableTab = document.querySelector('button[data-view="table"]');
  tableTab?.click();
  var tableMode = !table.hidden && grid.hidden;
  var tableSizeControlHidden = sizeControl.hidden;
  var tableTitleOpeners = Array.from(table.querySelectorAll('.table-title-button[data-open-image]'));
  var tableTitleOpener = tableTitleOpeners[0];
  tableTitleOpener?.focus();
  tableTitleOpener?.click();
  await wait();
  var tableTitleViewerOpened = !document.getElementById("library-viewer")?.hidden;
  var tableTitleViewerTitle = document.getElementById("viewer-title")?.textContent || "";
  document.getElementById("viewer-close")?.click();
  var tableTitleFocusRestored = document.activeElement === tableTitleOpener;
  var desktopTableHeaderCount = Array.from(table.querySelectorAll("th")).filter(function (cell) { return getComputedStyle(cell).display !== "none"; }).length;
  var desktopTableFactsHidden = Array.from(table.querySelectorAll(".table-facts")).every(function (facts) { return getComputedStyle(facts).display === "none"; });
  var tablePreviewHeaderText = table.querySelector("th.table-preview")?.textContent.trim() || "";
  var tableImageLabelsHidden = Array.from(table.querySelectorAll(".table-image-label")).every(function (label) { return getComputedStyle(label).position === "absolute" && label.getBoundingClientRect().width <= 1; });
  var tableImageButtonTitles = Array.from(table.querySelectorAll(".table-image")).map(function (button) { return button.title || ""; });
  var tableImageWidths = Array.from(table.querySelectorAll(".table-image img")).map(function (image) { return Math.round(image.getBoundingClientRect().width); });
  var stickyHeaderHeight = Math.ceil(document.querySelector(".app-header").getBoundingClientRect().height);
  var stickyTableOffset = Math.round(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--library-header-height")) || 0);
  var tableHeaderRect = table.querySelector("th").getBoundingClientRect();
  var firstTableRowRect = table.querySelector("tbody tr").getBoundingClientRect();
  var tableHeaderBeforeFirstRow = tableHeaderRect.bottom <= firstTableRowRect.top + 1;
  window.scrollTo(0, document.documentElement.scrollHeight);
  var stickyTableHeaderTop = Math.round(table.querySelector("th").getBoundingClientRect().top);
  var stickyPageHeaderBottom = Math.round(document.querySelector(".app-header").getBoundingClientRect().bottom);
  var tableHeaderSticksBelowPageHeader = Math.abs(stickyTableHeaderTop - stickyPageHeaderBottom) <= 1;
  window.scrollTo(0, 0);
  var tableTabSelected = tableTab?.getAttribute("aria-selected") || "";
  var tableTabIndex = tableTab?.tabIndex;
  var galleryTabIndexInTable = galleryTab?.tabIndex;
  var persistedTableView = localStorage.getItem("pdf-image-saver-library-view-v1") || "";
  tableTab?.focus();
  tableTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  var galleryMode = !grid.hidden && table.hidden;
  var gallerySizeControlVisible = !sizeControl.hidden;
  var galleryTabSelected = galleryTab?.getAttribute("aria-selected") || "";
  var galleryTabIndex = galleryTab?.tabIndex;
  var tableTabIndexInGallery = tableTab?.tabIndex;
  var galleryKeyboardFocus = document.activeElement === galleryTab;
  galleryTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  var endKeyOpenedTable = !table.hidden && document.activeElement === tableTab;
  tableTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  var homeKeyOpenedGallery = !grid.hidden && document.activeElement === galleryTab;
  var persistedGalleryView = localStorage.getItem("pdf-image-saver-library-view-v1") || "";
  var sourceLinks = Array.from(document.querySelectorAll('a[href^="zotero://open-pdf/"]'));
  var clickedSources = [];
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('a[href^="zotero://open-pdf/"]');
    if (!link) return;
    event.preventDefault();
    clickedSources.push(link.getAttribute("href") || "");
  }, true);
  sourceLinks.forEach(function (link) { link.click(); });
  var sourceFeedback = document.getElementById("library-message")?.textContent || "";
  var selectVisibleInitialLabel = document.getElementById("select-visible")?.textContent || "";
  document.getElementById("select-visible")?.click();
  var selectedCount = document.querySelectorAll('.library-card input[data-select-image]:checked').length;
  var selectedSummary = document.getElementById("selection-summary")?.textContent || "";
  var selectVisibleSelectedLabel = document.getElementById("select-visible")?.textContent || "";
  var selectedShareLabel = document.getElementById("share-selected")?.textContent || "";
  var selectedDeleteLabel = document.getElementById("delete-selected")?.textContent || "";
  var selectedClearLabel = document.getElementById("clear-selection")?.textContent || "";
  var selectedClearTitle = document.getElementById("clear-selection")?.title || "";
  var selectedBatchVisibility = {
    clear: isVisible("clear-selection"),
    summary: isVisible("selection-summary"),
    share: isVisible("share-selected"),
    remove: isVisible("delete-selected"),
  };
  var desktopMobileDockHidden = getComputedStyle(document.getElementById("mobile-selection-bar")).display === "none";
  document.getElementById("clear-selection")?.click();
  var clearedCount = document.querySelectorAll('.library-card input[data-select-image]:checked').length;
  var selectVisibleClearedLabel = document.getElementById("select-visible")?.textContent || "";
  var clearedShareLabel = document.getElementById("share-selected")?.textContent || "";
  var clearedDeleteLabel = document.getElementById("delete-selected")?.textContent || "";
  var clearedFeedback = document.getElementById("library-message")?.textContent || "";
  var clearedBatchVisibility = {
    clear: isVisible("clear-selection"),
    summary: isVisible("selection-summary"),
    share: isVisible("share-selected"),
    remove: isVisible("delete-selected"),
  };
  var rangeInputs = cards.slice(0, 3).map(function (card) { return card.querySelector('input[data-select-image]'); });
  rangeInputs[0].click();
  rangeInputs[2].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  var rangeSelectedCount = document.querySelectorAll('.library-card input[data-select-image]:checked').length;
  var rangeTableSelectedCount = document.querySelectorAll('#library-table input[data-select-image]:checked').length;
  var rangeSelectedSummary = document.getElementById("selection-summary")?.textContent || "";
  var rangeSelectionFeedback = document.getElementById("library-message")?.textContent || "";
  rangeInputs[1].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  var rangeDeselectedCount = document.querySelectorAll('.library-card input[data-select-image]:checked').length;
  var rangeDeselectionFeedback = document.getElementById("library-message")?.textContent || "";
  document.getElementById("clear-selection")?.click();
  var firstSelection = document.querySelector('.library-card input[data-select-image]');
  firstSelection.checked = true;
  firstSelection.dispatchEvent(new Event("change", { bubbles: true }));
  var firstSelectedCard = firstSelection.closest('.library-card');
  var differentCategoryCard = cards.find(function (card) { return card.dataset.category !== firstSelectedCard.dataset.category; });
  category.value = differentCategoryCard.dataset.category;
  category.dispatchEvent(new Event("change", { bubbles: true }));
  var hiddenSelectedSummary = document.getElementById("selection-summary")?.textContent || "";
  var hiddenSelectedTitle = document.getElementById("selection-summary")?.title || "";
  var hiddenShareTitle = document.getElementById("share-selected")?.title || "";
  var hiddenDeleteTitle = document.getElementById("delete-selected")?.title || "";
  var hiddenShareLabel = document.getElementById("share-selected")?.textContent || "";
  var hiddenDeleteLabel = document.getElementById("delete-selected")?.textContent || "";
  var hiddenClearLabel = document.getElementById("clear-selection")?.textContent || "";
  var hiddenShareAria = document.getElementById("share-selected")?.getAttribute("aria-label") || "";
  window.__libraryCommands = [];
  window.fetch = async function (_url, options) {
    var fields = new URLSearchParams(options.body);
    window.__libraryCommands.push({ command: fields.get("command"), imageIDs: fields.get("image_ids") || "", userNote: fields.get("user_note") || "" });
    if (fields.get("command") === "exportImages") return { ok: true, json: async function () { return { ok: true, exported: 1, bytes: 100 }; } };
    if (fields.get("command") === "importImages") return { ok: true, json: async function () { return { ok: true, imported: 0, matched: 0, unmatched: 0, skipped: 0 }; } };
    if (fields.get("command") === "updateImageNote") return { ok: true, json: async function () { return { ok: true, updated: 1, userNote: fields.get("user_note") || "" }; } };
    if (fields.get("command") === "readImageBytes") return { ok: true, json: async function () { return { ok: true, base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", mimeType: "image/png", byteCount: 70 }; } };
    return { ok: true, json: async function () { return { ok: true, deleted: 0 }; } };
  };
  document.getElementById("share-selected")?.click();
  await wait();
  await wait();
  var shareFeedback = document.getElementById("library-message")?.textContent || "";
  document.getElementById("import-package")?.click();
  await wait();
  await wait();
  var importFeedback = document.getElementById("library-message")?.textContent || "";
  var deleteConfirmMessage = "";
  window.confirm = function (message) { deleteConfirmMessage = String(message || ""); return false; };
  document.getElementById("delete-selected")?.click();
  document.getElementById("clear-selection")?.click();
  reset.click();
  var firstOpen = document.querySelector(".library-card:not([hidden]) [data-open-image]");
  firstOpen?.focus();
  firstOpen?.click();
  await wait();
  var viewer = document.getElementById("library-viewer");
  var viewerOpened = !viewer.hidden && !!document.getElementById("viewer-image")?.getAttribute("src");
  var viewerShortcutDeclaration = viewer.getAttribute("aria-keyshortcuts") || "";
  var viewerPrevShortcut = document.getElementById("viewer-prev")?.getAttribute("aria-keyshortcuts") || "";
  var viewerNextShortcut = document.getElementById("viewer-next")?.getAttribute("aria-keyshortcuts") || "";
  var viewerPrevText = document.getElementById("viewer-prev")?.textContent || "";
  var viewerNextText = document.getElementById("viewer-next")?.textContent || "";
  var viewerMetadata = document.getElementById("viewer-meta")?.textContent || "";
  var viewerSource = document.getElementById("viewer-source");
  var viewerDownload = document.getElementById("viewer-download");
  var viewerMatchedSource = viewerSource?.textContent || "";
  var viewerDownloadName = viewerDownload?.getAttribute("download") || "";
  var viewerDownloadTitle = viewerDownload?.title || "";
  var viewerStage = document.getElementById("viewer-stage");
  var viewerImage = document.getElementById("viewer-image");
  var viewerZoomValue = document.getElementById("viewer-zoom-value");
  var viewerSelect = document.getElementById("viewer-select");
  var viewerSelectionText = document.querySelector("#viewer-selection-label span");
  var viewerSelectionCount = document.getElementById("viewer-selection-count");
  var viewerClose = document.getElementById("viewer-close");
  var viewerSelectInitial = !viewerSelect?.checked;
  var viewerSelectedCountInitial = viewerSelectionCount?.textContent || "";
  var viewerSelectionTextInitial = viewerSelectionText?.textContent || "";
  var viewerCloseInitialText = viewerClose?.textContent || "";
  var viewerCloseGlyph = getComputedStyle(viewerClose, "::before").content || "";
  var viewerCloseInitialAria = viewerClose?.getAttribute("aria-label") || "";
  viewerSelect.checked = true;
  viewerSelect.dispatchEvent(new Event("change", { bubbles: true }));
  var viewerSelectChecked = viewerSelect.checked && viewerSelect.closest(".viewer-selection")?.classList.contains("is-selected");
  var viewerSelectedCountAfterAdd = viewerSelectionCount?.textContent || "";
  var viewerSelectionTextAfterAdd = viewerSelectionText?.textContent || "";
  var viewerSelectionAriaAfterAdd = viewerSelect.getAttribute("aria-label") || "";
  var viewerFinishText = viewerClose?.textContent || "";
  var viewerFinishTitle = viewerClose?.title || "";
  var viewerFinishHighlighted = viewerClose?.classList.contains("is-finish") || false;
  var viewerSelectionInputsSynced = document.querySelectorAll('[data-select-image="' + firstOpen.dataset.openImage + '"]:checked').length;
  var viewerSelectionSummary = document.getElementById("selection-summary")?.textContent || "";
  var viewerInitialZoom = viewerZoomValue?.textContent || "";
  var originalViewerSource = viewerImage?.getAttribute("src") || "";
  viewerImage.src = "data:image/png;base64,not-a-real-image";
  await wait(function () { return viewerStage.classList.contains("is-image-error"); });
  var viewerImageErrorFeedback = viewerStage.classList.contains("is-image-error");
  var viewerDownloadFailureState = viewerDownload.classList.contains("is-disabled") && viewerDownload.getAttribute("aria-disabled") === "true" && !viewerDownload.hasAttribute("href");
  viewerImage.src = originalViewerSource;
  await wait(function () { return !viewerStage.classList.contains("is-image-error") && viewerImage.naturalWidth > 0 && !viewerDownload.classList.contains("is-disabled") && !!viewerDownload.getAttribute("href"); });
  var originalCardImage = document.querySelector(".library-card:not([hidden]) .image-button img");
  var cardDownload = originalCardImage.closest(".library-card").querySelector(".card-actions a[download]");
  var originalCardSource = originalCardImage?.getAttribute("src") || "";
  originalCardImage.src = "data:image/png;base64,not-a-real-image";
  await wait(function () { return originalCardImage.closest(".image-button").classList.contains("is-image-error"); });
  var cardImageErrorFeedback = originalCardImage.closest(".image-button").classList.contains("is-image-error");
  var cardDownloadFailureState = !!cardDownload && cardDownload.classList.contains("is-disabled") && cardDownload.getAttribute("aria-disabled") === "true" && !cardDownload.hasAttribute("href");
  originalCardImage.src = originalCardSource;
  await wait(function () { return !originalCardImage.closest(".image-button").classList.contains("is-image-error") && originalCardImage.naturalWidth > 0 && (!cardDownload || (!cardDownload.classList.contains("is-disabled") && !!cardDownload.getAttribute("href"))); });
  // With OpenSeadragon the plain image is replaced by the engine, so the honest measurement of a
  // zoom action is the reported percentage of the original image rather than an element width.
  function zoomPercent() { var text = viewerZoomValue?.textContent || ""; var match = text.match(/(\d+)%/); return match ? Number(match[1]) : 0; }
  document.getElementById("viewer-zoom-actual")?.click();
  var viewerActualZoom = viewerZoomValue?.textContent || "";
  var viewerActualWidth = zoomPercent();
  document.getElementById("viewer-zoom-in")?.click();
  var viewerEnlargedZoom = viewerZoomValue?.textContent || "";
  var viewerEnlargedWidth = zoomPercent();
  var viewerZoomedScrollable = zoomPercent() > 0;
  document.getElementById("viewer-zoom-fit")?.click();
  var viewerFittedZoom = viewerZoomValue?.textContent || "";
  var viewerFittedWidth = zoomPercent();
  document.getElementById("viewer-zoom-in")?.click();
  document.getElementById("viewer-zoom-out")?.click();
  var viewerReducedZoom = viewerZoomValue?.textContent || "";
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true }));
  var viewerKeyboardActualZoom = viewerZoomValue?.textContent || "";
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true }));
  var viewerKeyboardFitZoom = viewerZoomValue?.textContent || "";
  var viewerControlOverflow = Array.from(viewer.querySelectorAll("button,a,.viewer-selection")).filter(function (control) { var rect = control.getBoundingClientRect(); return rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1; }).length;
  var viewerStandardControlHeights = Array.from(viewer.querySelectorAll("#viewer-close,.viewer-selection,.viewer-actions > *"))
    .map(function (control) { return Math.round(control.getBoundingClientRect().height); });
  var viewerCompactControlHeights = Array.from(viewer.querySelectorAll(".viewer-zoom button"))
    .map(function (control) { return Math.round(control.getBoundingClientRect().height); });
  var viewerStageRect = viewer.querySelector(".viewer-stage").getBoundingClientRect();
  var viewerImageRect = viewerImage.getBoundingClientRect();
  var viewerHeaderInline = getComputedStyle(viewer.querySelector(".viewer-header")).flexDirection === "row";
  var viewerChromeRects = Array.from(viewer.querySelectorAll(".viewer-header,.viewer-footer")).map(function (element) { return element.getBoundingClientRect(); });
  var viewerImageObstructed = viewerChromeRects.some(function (rect) { return rect.left < viewerImageRect.right && rect.right > viewerImageRect.left && rect.top < viewerImageRect.bottom && rect.bottom > viewerImageRect.top; });
  viewerSelect.focus();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  var viewerFocusWrapped = document.activeElement === viewerSource;
  var firstViewerPosition = document.getElementById("viewer-position")?.textContent || "";
  var viewerNext = document.getElementById("viewer-next");
  viewerNext.focus();
  viewerNext.click();
  var nextViewerPosition = document.getElementById("viewer-position")?.textContent || "";
  var nextViewerSelectionUnchecked = !viewerSelect.checked && !viewerSelect.closest(".viewer-selection")?.classList.contains("is-selected");
  var nextViewerSelectedCount = viewerSelectionCount?.textContent || "";
  var nextViewerSelectionText = viewerSelectionText?.textContent || "";
  var viewerNavigationFocusStable = document.activeElement === viewerNext;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
  var viewerKeyboardPreviousPosition = document.getElementById("viewer-position")?.textContent || "";
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  var viewerKeyboardNextPosition = document.getElementById("viewer-position")?.textContent || "";
  var viewerKeyboardNavigationFocusStable = document.activeElement === viewerNext;
  viewerSelect.checked = true;
  viewerSelect.dispatchEvent(new Event("change", { bubbles: true }));
  var viewerSelectedCountAfterSecondAdd = viewerSelectionCount?.textContent || "";
  viewerSelect.checked = false;
  viewerSelect.dispatchEvent(new Event("change", { bubbles: true }));
  var viewerSelectedCountAfterSecondRemove = viewerSelectionCount?.textContent || "";
  var viewerSelectionTextAfterRemove = viewerSelectionText?.textContent || "";
  viewerClose.click();
  var viewerClosed = viewer.hidden;
  var viewerBatchFocus = document.activeElement === document.getElementById("share-selected");
  var batchRect = document.getElementById("library-batch-row").getBoundingClientRect();
  var viewerBatchVisible = batchRect.bottom > 0 && batchRect.top < window.innerHeight;
  var unmatchedOpen = document.querySelector('.library-card[data-source="unmatched"] [data-open-image]');
  unmatchedOpen?.focus();
  unmatchedOpen?.click();
  var viewerUnmatchedSource = viewerSource?.textContent || "";
  var viewerUnmatchedDisabled = viewerSource?.getAttribute("aria-disabled") || "";
  var viewerUnmatchedHasHref = viewerSource?.hasAttribute("href") || false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  var viewerEscapeClosed = viewer.hidden;
  var viewerEscapeFocusRestored = document.activeElement === unmatchedOpen;
  document.getElementById("clear-selection")?.click();
  firstOpen?.focus();
  firstOpen?.click();
  var viewerPlainCloseText = viewerClose?.textContent || "";
  viewerClose?.click();
  var viewerPlainCloseFocusRestored = document.activeElement === firstOpen;
  // The description is the only gallery-side field the user authors, so the audit drives the real
  // editor instead of trusting the markup: open, cancel, reopen, save, then re-read every surface.
  var noteCard = firstOpen.closest(".library-card");
  var noteEdit = noteCard.querySelector("[data-edit-note]");
  var noteForm = noteCard.querySelector("[data-note-form]");
  var noteText = noteCard.querySelector("[data-note-text]");
  var noteInput = noteForm.querySelector("textarea");
  var noteCell = Array.from(table.querySelectorAll("td[data-note-cell]")).find(function (cell) { return cell.dataset.noteCell === noteCard.dataset.id; });
  var noteEmptyCard = Array.from(document.querySelectorAll(".library-card")).find(function (card) { return card.querySelector("[data-note-text]")?.hidden === true; });
  var noteEmptyCell = Array.from(table.querySelectorAll("td[data-note-cell]")).find(function (cell) { return cell.dataset.noteCell === noteEmptyCard?.dataset.id; });
  var noteInitial = {
    text: noteText?.textContent || "",
    textHidden: noteText?.hidden === true,
    editLabel: noteEdit?.textContent || "",
    formHidden: noteForm?.hidden === true,
    cell: noteCell?.textContent.trim() || "",
    cellTitle: noteCell?.title || "",
  };
  var noteInitialSearch = noteCard.dataset.search || "";
  var noteEmptyState = {
    editLabel: noteEmptyCard?.querySelector("[data-edit-note]")?.textContent || "",
    textHidden: noteEmptyCard?.querySelector("[data-note-text]")?.hidden !== false,
    cell: noteEmptyCell?.textContent.trim() || "",
  };
  var noteCardCount = document.querySelectorAll("[data-edit-note]").length;
  var noteFormCount = document.querySelectorAll("[data-note-form]").length;
  noteEdit.focus();
  noteEdit.click();
  var noteOpened = noteForm.hidden === false && noteEdit.hidden === true;
  var noteFocusInForm = document.activeElement === noteInput;
  noteForm.querySelector("[data-note-cancel]")?.click();
  var noteCancelled = noteForm.hidden === true && noteEdit.hidden === false;
  var noteCancelKeptValue = noteInput.value === noteInitial.text;
  noteEdit.click();
  noteInput.value = "审计写入的描述\n第二行";
  noteInput.dispatchEvent(new Event("input", { bubbles: true }));
  noteForm.querySelector("[data-note-save]")?.click();
  await wait();
  await wait();
  var noteCommands = window.__libraryCommands.filter(function (entry) { return entry.command === "updateImageNote"; });
  var noteSaved = {
    formHidden: noteForm.hidden === true,
    editLabel: noteEdit.textContent,
    text: noteText.textContent,
    textHidden: noteText.hidden === true,
    cell: noteCell.textContent.trim(),
    cellTitle: noteCell.title,
    inputValue: noteInput.value,
    message: document.getElementById("library-message")?.textContent || "",
  };
  var noteSavedSearch = noteCard.dataset.search || "";
  firstOpen.click();
  await wait();
  var noteViewerNote = document.getElementById("viewer-note");
  var noteViewerState = {
    text: noteViewerNote?.textContent || "",
    hidden: noteViewerNote?.hidden !== false,
    clipped: noteViewerNote ? noteViewerNote.scrollHeight > noteViewerNote.clientHeight + 1 || noteViewerNote.scrollWidth > noteViewerNote.clientWidth + 1 : false,
    meta: document.getElementById("viewer-meta")?.textContent || "",
  };
  document.getElementById("viewer-close")?.click();
  search.value = "审计写入的描述";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  var noteSearchVisible = visibleCount();
  var noteSearchKeptCard = !noteCard.hidden;
  reset.click();
  var noteSearchResetVisible = visibleCount();
  firstSelection.checked = true;
  firstSelection.dispatchEvent(new Event("change", { bubbles: true }));
  window.fetch = async function () { return { ok: false, json: async function () { return { ok: false, error: "Unexpected internal value" }; } }; };
  document.getElementById("share-selected")?.click();
  await wait();
  await wait();
  var unknownBridgeFeedback = document.getElementById("library-message")?.textContent || "";
  var availableAfterUnknownError = !document.getElementById("share-selected")?.disabled && firstSelection.checked;
  window.fetch = async function () { throw new Error("Failed to fetch"); };
  document.getElementById("share-selected")?.click();
  await wait();
  await wait();
  var networkFeedback = document.getElementById("library-message")?.textContent || "";
  var liveDisconnectState = {
    selectedCount: document.querySelectorAll("[data-select-image]:checked").length,
    inputsDisabled: Array.from(document.querySelectorAll("[data-select-image]")).every(function (input) { return input.disabled; }),
    selectVisibleDisabled: !!document.getElementById("select-visible")?.disabled,
    shareDisabled: !!document.getElementById("share-selected")?.disabled,
    deleteDisabled: !!document.getElementById("delete-selected")?.disabled,
    importDisabled: !!document.getElementById("import-package")?.disabled,
    mobileDockHidden: document.getElementById("mobile-selection-bar")?.hidden !== false,
    summary: document.getElementById("selection-summary")?.textContent || "",
  };
  return {
    cardCount: cards.length,
    buttonCount: buttons.length,
    unknownButtonCount: unknownButtons.length,
    viewerImageErrorFeedback: viewerImageErrorFeedback,
    cardImageErrorFeedback: cardImageErrorFeedback,
    viewerDownloadFailureState: viewerDownloadFailureState,
    cardDownloadFailureState: cardDownloadFailureState,
    lightBoundaries: lightBoundaries,
    expandedFilterHeaderHeight: expandedFilterHeaderHeight,
    collapsedFilterHeaderHeight: collapsedFilterHeaderHeight,
    desktopFilterClosed: desktopFilterClosed,
    initiallyClosedFilters: initiallyClosedFilters,
    initialResultStatusHidden: initialResultStatusHidden,
    initialCollapsedFilterHeaderHeight: initialCollapsedFilterHeaderHeight,
    initialFilterReopened: initialFilterReopened,
    initialFilterReopenFocus: initialFilterReopenFocus,
    persistedInitialOpenFilters: persistedInitialOpenFilters,
    desktopFilterSummaryVisible: desktopFilterSummaryVisible,
    desktopFilterCollapseFocus: desktopFilterCollapseFocus,
    desktopCollapsedFilterValue: desktopCollapsedFilterValue,
    desktopCollapsedFilterSummary: desktopCollapsedFilterSummary,
    persistedClosedFilters: persistedClosedFilters,
    desktopFilterReopened: desktopFilterReopened,
    desktopFilterReopenFocus: desktopFilterReopenFocus,
    desktopReopenedFilterValue: desktopReopenedFilterValue,
    persistedOpenFilters: persistedOpenFilters,
    categoryVisible: categoryVisible,
    categoryResultStatus: categoryResultStatus,
    categoryFilterSummary: categoryFilterSummary,
    categoryFilterTitle: categoryFilterTitle,
    multiFilterSummary: multiFilterSummary,
    multiFilterTitle: multiFilterTitle,
    filteredSelectVisibleLabel: filteredSelectVisibleLabel,
    resetFilterSummary: resetFilterSummary,
    resetResultStatusHidden: resetResultStatusHidden,
    searchVisible: searchVisible,
    searchResultStatus: searchResultStatus,
    searchFilterSummary: searchFilterSummary,
    searchFilterTitle: searchFilterTitle,
    emptySearchFilterSummary: emptySearchFilterSummary,
    emptySearchResultStatus: emptySearchResultStatus,
    emptySelectVisibleLabel: emptySelectVisibleLabel,
    emptySelectVisibleDisabled: emptySelectVisibleDisabled,
    emptyResetVisible: emptyResetVisible,
    emptyResetLabel: emptyResetLabel,
    emptyMessage: emptyMessage,
    emptyResetRestored: emptyResetRestored,
    emptyResetFocusedSearch: emptyResetFocusedSearch,
    emptyResetFilterSummary: emptyResetFilterSummary,
    emptyResetResultStatusHidden: emptyResetResultStatusHidden,
    sortOnlyResultStatusHidden: sortOnlyResultStatusHidden,
    resetVisible: visibleCount(),
    sortedFirstSize: sortedFirstSize,
    sortFilterSummary: sortFilterSummary,
    sortFilterTitle: sortFilterTitle,
    maxSize: Math.max.apply(null, cards.map(function (card) { return Number(card.dataset.size || 0); })),
    cardSize: cardSize,
    cardColumnCount: cardColumnCount,
    cardLayoutLabel: cardLayoutLabel,
    cardSizeAria: cardSizeAria,
    cardColumnCount: cardColumnCount,
    cardLayoutLabel: cardLayoutLabel,
    cardSizeAria: cardSizeAria,
    linkedVisible: linkedVisible,
    tableMode: tableMode,
    tableTitleActionCount: tableTitleOpeners.length,
    tableTitleViewerOpened: tableTitleViewerOpened,
    tableTitleViewerTitle: tableTitleViewerTitle,
    tableTitleFocusRestored: tableTitleFocusRestored,
    desktopTableHeaderCount: desktopTableHeaderCount,
    desktopTableFactsHidden: desktopTableFactsHidden,
    tablePreviewHeaderText: tablePreviewHeaderText,
    tableImageLabelsHidden: tableImageLabelsHidden,
    tableImageButtonTitles: tableImageButtonTitles,
    tableImageWidths: tableImageWidths,
    galleryMode: galleryMode,
    tableSizeControlHidden: tableSizeControlHidden,
    stickyHeaderHeight: stickyHeaderHeight,
    stickyTableOffset: stickyTableOffset,
    tableHeaderBeforeFirstRow: tableHeaderBeforeFirstRow,
    tableHeaderSticksBelowPageHeader: tableHeaderSticksBelowPageHeader,
    gallerySizeControlVisible: gallerySizeControlVisible,
    tableTabSelected: tableTabSelected,
    tableTabIndex: tableTabIndex,
    galleryTabIndexInTable: galleryTabIndexInTable,
    galleryTabSelected: galleryTabSelected,
    galleryTabIndex: galleryTabIndex,
    tableTabIndexInGallery: tableTabIndexInGallery,
    galleryKeyboardFocus: galleryKeyboardFocus,
    endKeyOpenedTable: endKeyOpenedTable,
    homeKeyOpenedGallery: homeKeyOpenedGallery,
    persistedTableView: persistedTableView,
    persistedGalleryView: persistedGalleryView,
    viewerOpened: viewerOpened,
    viewerShortcutDeclaration: viewerShortcutDeclaration,
    viewerPrevShortcut: viewerPrevShortcut,
    viewerNextShortcut: viewerNextShortcut,
    viewerPrevText: viewerPrevText,
    viewerNextText: viewerNextText,
    viewerMetadata: viewerMetadata,
    viewerMatchedSource: viewerMatchedSource,
    viewerDownloadName: viewerDownloadName,
    viewerDownloadTitle: viewerDownloadTitle,
    viewerSelectInitial: viewerSelectInitial,
    viewerSelectedCountInitial: viewerSelectedCountInitial,
    viewerSelectionTextInitial: viewerSelectionTextInitial,
    viewerCloseInitialText: viewerCloseInitialText,
    viewerCloseGlyph: viewerCloseGlyph,
    viewerCloseInitialAria: viewerCloseInitialAria,
    viewerSelectChecked: viewerSelectChecked,
    viewerSelectedCountAfterAdd: viewerSelectedCountAfterAdd,
    viewerSelectionTextAfterAdd: viewerSelectionTextAfterAdd,
    viewerSelectionAriaAfterAdd: viewerSelectionAriaAfterAdd,
    viewerFinishText: viewerFinishText,
    viewerFinishTitle: viewerFinishTitle,
    viewerFinishHighlighted: viewerFinishHighlighted,
    nextViewerSelectedCount: nextViewerSelectedCount,
    nextViewerSelectionText: nextViewerSelectionText,
    viewerSelectedCountAfterSecondAdd: viewerSelectedCountAfterSecondAdd,
    viewerSelectedCountAfterSecondRemove: viewerSelectedCountAfterSecondRemove,
    viewerSelectionTextAfterRemove: viewerSelectionTextAfterRemove,
    viewerSelectionInputsSynced: viewerSelectionInputsSynced,
    viewerSelectionSummary: viewerSelectionSummary,
    nextViewerSelectionUnchecked: nextViewerSelectionUnchecked,
    viewerInitialZoom: viewerInitialZoom,
    viewerActualZoom: viewerActualZoom,
    viewerActualWidth: viewerActualWidth,
    viewerEnlargedZoom: viewerEnlargedZoom,
    viewerEnlargedWidth: viewerEnlargedWidth,
    viewerZoomedScrollable: viewerZoomedScrollable,
    viewerReducedZoom: viewerReducedZoom,
    viewerKeyboardActualZoom: viewerKeyboardActualZoom,
    viewerKeyboardFitZoom: viewerKeyboardFitZoom,
    viewerFittedZoom: viewerFittedZoom,
    viewerFittedWidth: viewerFittedWidth,
    viewerControlOverflow: viewerControlOverflow,
    viewerStandardControlHeights: viewerStandardControlHeights,
    viewerCompactControlHeights: viewerCompactControlHeights,
    viewerStageHeight: Math.round(viewerStageRect.height),
    viewerHeaderInline: viewerHeaderInline,
    viewerImageObstructed: viewerImageObstructed,
    viewerFocusWrapped: viewerFocusWrapped,
    firstViewerPosition: firstViewerPosition,
    nextViewerPosition: nextViewerPosition,
    viewerAdvanced: firstViewerPosition !== nextViewerPosition,
    viewerNavigationFocusStable: viewerNavigationFocusStable,
    viewerKeyboardPreviousPosition: viewerKeyboardPreviousPosition,
    viewerKeyboardNextPosition: viewerKeyboardNextPosition,
    viewerKeyboardNavigationFocusStable: viewerKeyboardNavigationFocusStable,
    viewerClosed: viewerClosed,
    viewerBatchFocus: viewerBatchFocus,
    viewerBatchVisible: viewerBatchVisible,
    viewerUnmatchedSource: viewerUnmatchedSource,
    viewerUnmatchedDisabled: viewerUnmatchedDisabled,
    viewerUnmatchedHasHref: viewerUnmatchedHasHref,
    viewerEscapeClosed: viewerEscapeClosed,
    viewerEscapeFocusRestored: viewerEscapeFocusRestored,
    viewerPlainCloseText: viewerPlainCloseText,
    viewerPlainCloseFocusRestored: viewerPlainCloseFocusRestored,
    sourceCount: sourceLinks.length,
    clickedSourceCount: clickedSources.length,
    sourceFeedback: sourceFeedback,
    selectionInputCount: document.querySelectorAll("[data-select-image]").length,
    cardDownloadNames: cardDownloadNames,
    cardDownloadTitles: cardDownloadTitles,
    initialBatchVisibility: initialBatchVisibility,
    selectedCount: selectedCount,
    selectedSummary: selectedSummary,
    selectionGuidance: selectionGuidance,
    desktopSelectionHints: desktopSelectionHints,
    desktopCardSelectionTitles: desktopCardSelectionTitles,
    selectVisibleInitialLabel: selectVisibleInitialLabel,
    selectVisibleSelectedLabel: selectVisibleSelectedLabel,
    selectedShareLabel: selectedShareLabel,
    selectedDeleteLabel: selectedDeleteLabel,
    selectedClearLabel: selectedClearLabel,
    selectedClearTitle: selectedClearTitle,
    selectedBatchVisibility: selectedBatchVisibility,
    desktopMobileDockHidden: desktopMobileDockHidden,
    clearedCount: clearedCount,
    selectVisibleClearedLabel: selectVisibleClearedLabel,
    clearedShareLabel: clearedShareLabel,
    clearedDeleteLabel: clearedDeleteLabel,
    clearedFeedback: clearedFeedback,
    clearedBatchVisibility: clearedBatchVisibility,
    rangeSelectedCount: rangeSelectedCount,
    rangeTableSelectedCount: rangeTableSelectedCount,
    rangeSelectedSummary: rangeSelectedSummary,
    rangeSelectionFeedback: rangeSelectionFeedback,
    rangeDeselectedCount: rangeDeselectedCount,
    rangeDeselectionFeedback: rangeDeselectionFeedback,
    hiddenSelectedSummary: hiddenSelectedSummary,
    hiddenSelectedTitle: hiddenSelectedTitle,
    hiddenShareTitle: hiddenShareTitle,
    hiddenDeleteTitle: hiddenDeleteTitle,
    hiddenShareLabel: hiddenShareLabel,
    hiddenDeleteLabel: hiddenDeleteLabel,
    hiddenClearLabel: hiddenClearLabel,
    hiddenShareAria: hiddenShareAria,
    deleteConfirmMessage: deleteConfirmMessage,
    commands: window.__libraryCommands,
    shareFeedback: shareFeedback,
    importFeedback: importFeedback,
    unknownBridgeFeedback: unknownBridgeFeedback,
    availableAfterUnknownError: availableAfterUnknownError,
    networkFeedback: networkFeedback,
    liveDisconnectState: liveDisconnectState,
    noteCardCount: noteCardCount,
    noteFormCount: noteFormCount,
    noteInitial: noteInitial,
    noteInitialSearch: noteInitialSearch,
    noteEmptyState: noteEmptyState,
    noteOpened: noteOpened,
    noteFocusInForm: noteFocusInForm,
    noteCancelled: noteCancelled,
    noteCancelKeptValue: noteCancelKeptValue,
    noteCommands: noteCommands,
    noteSaved: noteSaved,
    noteSavedSearch: noteSavedSearch,
    noteViewerState: noteViewerState,
    noteSearchVisible: noteSearchVisible,
    noteSearchKeptCard: noteSearchKeptCard,
    noteSearchResetVisible: noteSearchResetVisible,
    sourceBadgeCount: document.querySelectorAll(".library-card .source-badge").length,
    originalDownloadCount: document.querySelectorAll('.library-card a[download]').length,
    obstructedImageCount: obstructedImageCount,
    tagLabels: Array.from(document.querySelectorAll(".library-card .tag")).map(function (tag) { return tag.textContent.trim(); }),
    loadedImageCount: imageNodes.filter(function (img) { return img.complete && img.naturalWidth > 0; }).length,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  };
}

let browser = null;
let client = null;
try {
  const legacySource = getArgument("--legacy-source");
  if (legacySource) assert.ok(fs.existsSync(legacySource), `Legacy source missing: ${legacySource}`);
  await runProcess(process.execPath, [path.join(root, "tests", "current-release.test.js")], {
    cwd: root,
    env: {
      ...process.env,
      PDF_IMAGE_SAVER_BROWSER_SINGLE_FIXTURE: singleFixture,
      PDF_IMAGE_SAVER_BROWSER_MULTI_FIXTURE: multiFixture,
      PDF_IMAGE_SAVER_BROWSER_LIBRARY_FIXTURE: libraryFixture,
      PDF_IMAGE_SAVER_BROWSER_OFFLINE_LIBRARY_FIXTURE: offlineLibraryFixture,
      PDF_IMAGE_SAVER_BROWSER_LEGACY_SOURCE: legacySource,
    },
  });
  const browserPath = findBrowser();
  if (!browserPath && process.argv.includes("--skip-without-browser")) {
    // Release gates stay runnable on machines without Edge or Chrome; an explicit skip is
    // reported instead of failing the batch for a reason unrelated to the change under test.
    console.log("browser UI audit skipped: no Edge or Chrome found");
    process.exit(0);
  }
  assert.ok(browserPath, "Edge or Chrome is required for the browser button audit");
  const userDataDirectory = path.join(tempRoot, "browser-profile");
  const browserArguments = [
    "--headless=new",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--window-size=430,1200",
    `--user-data-dir=${userDataDirectory}`,
    pathToFileURL(singleFixture).href,
  ];
  if (!screenshotDirectory) browserArguments.splice(1, 0, "--disable-gpu");
  browser = spawn(browserPath, browserArguments, { stdio: "ignore", windowsHide: true });
  const activePortFile = path.join(userDataDirectory, "DevToolsActivePort");
  const activePort = await waitFor(() => {
    if (!fs.existsSync(activePortFile)) return null;
    const value = fs.readFileSync(activePortFile, "utf8").split(/\r?\n/)[0];
    return /^\d+$/.test(value) ? value : null;
  });
  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    const values = await response.json();
    return values.find((target) => target.type === "page" && target.webSocketDebuggerUrl) ? values : null;
  });
  const target = targets.find((value) => value.type === "page" && value.webSocketDebuggerUrl);
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  // Every large-image view must stay inside the generated page. Discovering targets lets the audit
  // prove that no gallery action hands the user off to a second browser tab.
  await client.send("Target.setDiscoverTargets", { discover: true });
  await waitFor(() => client.notifications.some((message) => message.method === "Target.targetCreated"));
  const countPageTargets = () => client.notifications.filter((message) => message.method === "Target.targetCreated" && message.params?.targetInfo?.type === "page").length;
  const initialPageTargetCount = countPageTargets();
  await waitForDocument(client, 1);
  const single = await evaluate(client, `(${auditSinglePage.toString()})()`);
  assert.equal(single.readable, true, "readable layout must be applied");
  assert.equal(single.workflowCount, single.entryCount, "every entry must receive the readable workflow");
  assert.equal(single.hiddenTechnicalCount, single.entryCount, "technical summaries must stay collapsed");
  assert.equal(single.localStatusCount, single.entryCount, "every entry must expose local action feedback");
  assert.deepEqual(single.entryTitles, ["第 1 张图片 · 未分类"], "legacy saved images must use a stable unclassified label instead of implying active inference");
  assert.equal(single.sourceMapPageLabel, "原文页", "legacy current-paper views must receive the explicit whole-page label at runtime");
  assert.equal(single.sourceMapLegend, "绿色虚线：保存区域", "legacy current-paper views must receive the native Chinese saved-area legend at runtime");
  assert.deepEqual(single.sourceMapRegionStyle, { borderStyle: "dashed", borderColor: "rgb(22, 163, 74)" }, "legacy current-paper views must receive the same green dashed saved-area marker");
  assert.equal(single.unknownButtonCount, 0, "every generated button must have a runtime action");
  assert.ok(single.copyButtonCount >= 10, "single page must expose all copy actions");
  assert.deepEqual(single.syncCopies.map((copy) => copy.text), single.expectedPayloads, "every synchronous copy action must preserve its exact payload");
  assert.ok(single.syncCopies.every((copy) => copy.command === "copy"), "every copy action must invoke the copy command");
  assert.ok(single.syncFeedback.every((feedback) => feedback.global === "已复制"), "every copy action must show global Chinese feedback");
  assert.ok(single.syncFeedback.filter((feedback) => feedback.local || feedback.palette).every((feedback) => feedback.local === "已复制"), "entry copy and palette actions must show local Chinese feedback");
  assert.deepEqual(single.clipboardCopies, [single.clipboardPayload], "Clipboard API fallback must preserve the payload");
  assert.equal(single.clipboardFeedback, "已复制", "Clipboard API success must update the source button");
  assert.equal(single.manualCopies.length, 1, "double clipboard denial must open one manual-copy prompt");
  assert.equal(single.manualCopies[0].value, single.manualPayload, "manual-copy fallback must preserve the payload");
  assert.equal(single.manualFeedback, "请手动复制", "manual-copy fallback must update the source button");
  assert.deepEqual(single.copyDisclosure, {
    text: "复制图片信息",
    title: "展开复制当前图片的 PPT、叙事和 JSON 信息",
  }, "single-image current-paper page must name its copy-only disclosure accurately");
  assert.deepEqual(single.clickedLinks, single.sourceLinks, "every Zotero source link must receive the click event without payload changes");
  assert.equal(single.linkFeedback, "已请求 Zotero 定位", "source links must show Chinese trigger feedback");
  assert.ok(single.detailsResults.every(Boolean), "every disclosure control must open on click");
  assert.ok(single.documentWidth <= single.viewportWidth, `single-page index overflows horizontally: ${single.documentWidth}px > ${single.viewportWidth}px`);
  assert.ok(single.bodyWidth <= single.viewportWidth, `single-page body overflows horizontally: ${single.bodyWidth}px > ${single.viewportWidth}px`);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.navigate", { url: pathToFileURL(multiFixture).href });
  await waitForDocument(client, 2);
  const currentPaperFirstUse = await evaluate(client, `(() => { const status=document.getElementById('pdf-image-saver-filter-status');return {filterSummary:document.getElementById('pdf-image-saver-filter-summary')?.textContent||'',resultCountHidden:!!status?.hidden,resultCountDisplay:status?getComputedStyle(status).display:'',actionFeedback:document.getElementById('pdf-image-saver-action-status')?.textContent||'',copySummary:document.querySelector('.index-export-actions > summary')?.textContent||'',pageFact:document.querySelector('.entry-readable-summary dd')?.textContent.trim()||'',entryTitles:Array.from(document.querySelectorAll('.entry-title')).map(function(title){return title.textContent.trim();}),captionTitles:Array.from(document.querySelectorAll('.caption-title')).map(function(title){return title.textContent.trim();})}; })()`);
  assert.deepEqual(currentPaperFirstUse, {
    filterSummary: "筛选图片",
    resultCountHidden: true,
    resultCountDisplay: "none",
    actionFeedback: "",
    copySummary: "复制整篇信息",
    pageFact: "第 5 页（文献页码 v）",
    entryTitles: ["第 1 张图片 · 未分类", "第 2 张图片 · 未分类"],
    captionTitles: ["建议标题：图片重点", "建议标题：图片重点"],
  }, "current-paper first use must keep only actionable disclosures and no redundant full-result status");
  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const currentPaperFirstUseScreenshot = await captureFixedViewportScreenshot(client);
    fs.writeFileSync(path.join(screenshotDirectory, "current-paper-first-use-desktop.png"), Buffer.from(currentPaperFirstUseScreenshot.data, "base64"));
  }
  const multi = await evaluate(client, `(${auditMultiPage.toString()})()`);
  assert.equal(multi.workflowCount, multi.entryCount, "every multi-page entry must receive the readable workflow");
  assert.equal(multi.unknownButtonCount, 0, "multi-page index must not contain unhandled buttons");
  assert.ok(multi.filterButtonCount >= 2, "multi-page index must expose filter actions");
  assert.equal(multi.filterDisclosure.exists, true, "multi-page filters must use one disclosure control");
  assert.equal(multi.filterDisclosure.initiallyOpen, false, "multi-page filters must default closed so images enter the first viewport sooner");
  assert.equal(multi.filterDisclosure.openAfterClick, true, "filter disclosure must open on one click");
  assert.equal(multi.filterDisclosure.openAfterAudit, false, "screenshot fixture must restore the compact closed state");
  assert.equal(multi.filterDisclosure.summary, "筛选图片", "cleared filters must restore the concise Chinese disclosure label");
  assert.equal(multi.jumpDisclosure.exists, true, "multi-page navigation must use one disclosure control");
  assert.equal(multi.jumpDisclosure.initiallyOpen, false, "multi-page navigation must default closed so images enter the first viewport sooner");
  assert.equal(multi.jumpDisclosure.openAfterClick, true, "navigation disclosure must open on one click");
  assert.equal(multi.jumpDisclosure.openAfterAudit, false, "screenshot fixture must restore compact navigation");
  assert.equal(multi.jumpDisclosure.summary, "快速跳转（2 张）", "navigation disclosure must state its image scope in Chinese");
  assert.deepEqual(multi.copyDisclosure, {
    text: "复制整篇信息",
    title: "展开复制全部 PPT、叙事和 JSON 信息",
  }, "multi-image current-paper page must name its copy-only disclosure accurately");
  assert.ok(multi.jumpDisclosure.targets.includes("#e1") && multi.jumpDisclosure.targets.includes("#e2"), "navigation disclosure must retain every per-image anchor");
  assert.ok(multi.jumpDisclosure.targets.filter((target) => target.startsWith("zotero://")).length >= 2, "navigation disclosure must retain first and last Zotero source links");
  assert.ok(multi.results.every((result) => result.pressed === "true"), "every filter button must enter its pressed state");
  assert.ok(multi.results.every((result) => result.status.startsWith("已筛选")), "every filter action must show Chinese feedback");
  assert.ok(multi.results.filter((result) => result.value !== "all").every((result) => result.resultCountHidden === false), "active current-paper filters must reveal the result count");
  assert.ok(multi.results.filter((result) => result.value === "all").every((result) => result.resultCountHidden === true), "all-value current-paper filters must keep the redundant full-result count hidden");
  assert.ok(multi.results.filter((result) => result.value !== "all").every((result) => result.summary.includes("已启用 1 项")), "active filters must remain visible in the collapsed disclosure label");
  assert.ok(multi.results.filter((result) => result.value === "all").every((result) => result.summary === "筛选图片"), "all-value filters must retain the concise disclosure label");
  assert.equal(multi.clearDisabled, true, "clear filter must return to its accurate disabled state");
  assert.equal(multi.clearHidden, true, "inactive clear filter must stay out of the compact header");
  assert.equal(multi.clearDisplay, "none", "inactive clear filter must be visually absent despite the shared action display style");
  assert.equal(multi.resultCountHiddenAfterAudit, true, "cleared current-paper filters must leave the full-result count hidden");
  assert.ok(multi.results.filter((result) => result.value !== "all").every((result) => result.clearHidden === false), "active filters must reveal the clear action immediately");
  assert.ok(multi.results.filter((result) => result.value !== "all").every((result) => result.clearDisplay !== "none"), "active filters must render the clear action immediately");
  assert.equal(multi.visibleEntries, multi.entryCount, "clear filter must restore all entries");
  assert.ok(multi.tagLabels.every((label) => /[\u3400-\u9fff]/.test(label)), "saved-page tag filters must not expose internal English tokens");
  assert.equal(multi.loadedImageCount, multi.entryCount, "current-paper screenshot fixtures must render every saved image");
  assert.ok(multi.previewWidths.every((width) => width >= 400 && width <= 424), `current-paper previews must remain large enough for inspection: ${multi.previewWidths.join(",")}`);
  assert.deepEqual(multi.sourceMapCaptions, ["原文位置 · 第 5 页", "原文位置 · 第 5 页"], "current-paper source maps must identify their page and purpose visibly");
  assert.deepEqual(multi.sourceMapPageLabels, ["原文页", "原文页"], "current-paper source diagrams must identify the complete page instead of resembling missing thumbnails");
  assert.deepEqual(multi.sourceMapLegends, ["绿色虚线：保存区域", "绿色虚线：保存区域"], "current-paper source diagrams must explain their highlighted region in native Chinese");
  assert.ok(multi.sourceMapWidths.every((width) => width >= 96), `source-region diagrams must remain visually legible: ${multi.sourceMapWidths.join(",")}`);
  assert.ok(multi.sourceMapRegionStyles.every((style) => style.borderStyle === "dashed" && style.borderColor === "rgb(22, 163, 74)"), "source-region diagrams must use the documented green dashed saved-area marker");
  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const currentPaperScreenshot = await captureFixedViewportScreenshot(client);
    fs.writeFileSync(path.join(screenshotDirectory, "current-paper-index-desktop.png"), Buffer.from(currentPaperScreenshot.data, "base64"));
  }
  await client.send("Page.navigate", { url: pathToFileURL(libraryFixture).href });
  await waitFor(async () => {
    const state = await evaluate(client, `({ready:document.readyState,cards:document.querySelectorAll('.library-card').length})`);
    return state?.ready === "complete" && state.cards === 8;
  });
  const firstUseLibrary = await evaluate(client, `(() => {const status=document.getElementById('library-status');return {panelOpen:document.getElementById('library-filter-panel')?.open===true,summary:document.getElementById('library-filter-summary')?.textContent||'',resultCountHidden:status?.hidden===true,resultCountDisplay:status?getComputedStyle(status).display:'',firstCardTop:Math.round(document.querySelector('.library-card')?.getBoundingClientRect().top||0),viewportHeight:innerHeight};})()`);
  assert.equal(firstUseLibrary.panelOpen, false, "first-use global library must start with secondary filters collapsed");
  assert.equal(firstUseLibrary.summary, "未筛选", "first-use collapsed filter summary must remain immediately understandable");
  assert.equal(firstUseLibrary.resultCountHidden, true, "first-use global library must hide the redundant full-result count");
  assert.equal(firstUseLibrary.resultCountDisplay, "none", "hidden first-use result count must release toolbar space");
  assert.ok(firstUseLibrary.firstCardTop < firstUseLibrary.viewportHeight / 3, `first-use global library must bring images into the upper third of the full-screen viewport: ${firstUseLibrary.firstCardTop}px`);
  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const firstUseLibraryScreenshot = await captureFixedViewportScreenshot(client);
    fs.writeFileSync(path.join(screenshotDirectory, "library-first-use-desktop.png"), Buffer.from(firstUseLibraryScreenshot.data, "base64"));
  }
  const library = await evaluate(client, `(${auditLibraryPage.toString()})()`);
  assert.equal(library.cardCount, 8, "global library must show every fixture image");
  assert.equal(library.unknownButtonCount, 0, "every global-library button must have a runtime action");
  assert.equal(library.noteCardCount, library.cardCount, "every gallery card must expose one description action");
  assert.equal(library.noteFormCount, library.cardCount, "every gallery card must own one description editor");
  assert.deepEqual(library.noteInitial, {
    text: "复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。",
    textHidden: false,
    editLabel: "编辑描述",
    formHidden: true,
    cell: "复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。",
    cellTitle: "复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。",
  }, "a stored description must render identically on the card and in the table cell");
  assert.ok(library.noteInitialSearch.includes("复现实验第 2 轮"), "the description must join the card search index");
  assert.deepEqual(library.noteEmptyState, { editLabel: "添加描述", textHidden: true, cell: "无描述" }, "an undescribed image must offer 添加描述 and state 无描述 instead of an empty cell");
  assert.equal(library.noteOpened, true, "the description action must reveal the editor and hide itself");
  assert.equal(library.noteFocusInForm, true, "opening the description editor must focus its textarea");
  assert.equal(library.noteCancelled, true, "cancelling must restore the description action without saving");
  assert.equal(library.noteCancelKeptValue, true, "cancelling must discard the typed text");
  assert.equal(library.noteCommands.length, 1, "saving a description must send exactly one bridge command");
  assert.deepEqual(library.noteCommands[0], { command: "updateImageNote", imageIDs: "", userNote: "审计写入的描述\n第二行" }, "the description must reach the bridge verbatim, line breaks included");
  assert.deepEqual(library.noteSaved, {
    formHidden: true,
    editLabel: "编辑描述",
    text: "审计写入的描述\n第二行",
    textHidden: false,
    cell: "审计写入的描述 第二行",
    cellTitle: "审计写入的描述 第二行",
    inputValue: "审计写入的描述\n第二行",
    message: "描述已保存到外部数据库",
  }, "a saved description must refresh the card, the table cell, the editor value and the feedback in one pass");
  assert.ok(library.noteSavedSearch.includes("审计写入的描述"), "the refreshed description must rejoin the search index");
  assert.deepEqual(library.noteViewerState, {
    text: "描述：审计写入的描述\n第二行",
    hidden: false,
    clipped: false,
    meta: library.noteViewerState.meta,
  }, "the large viewer must show the saved description on its own unwrapped line");
  assert.ok(!library.noteViewerState.meta.includes("描述："), "the description must stay out of the single-line metadata strip that mobile clamps");
  assert.equal(library.noteSearchVisible, 1, "a description-only search term must filter the gallery down to the described image");
  assert.equal(library.noteSearchKeptCard, true, "the described image must survive its own description search");
  assert.equal(library.noteSearchResetVisible, library.cardCount, "clearing the description search must restore every card");
  assert.ok(getContrastRatio(library.lightBoundaries.searchBorder, library.lightBoundaries.searchBackground) >= 3, "light search boundary must reach 3:1 non-text contrast");
  assert.ok(getContrastRatio(library.lightBoundaries.importBorder, library.lightBoundaries.importBackground) >= 3, "light action boundary must reach 3:1 non-text contrast");
  assert.ok(getContrastRatio(library.lightBoundaries.segmentedBorder, library.lightBoundaries.segmentedBackground) >= 3, "light view-switch boundary must reach 3:1 non-text contrast");
  assert.equal(library.desktopFilterClosed, true, "desktop filter collapse action must close the secondary controls");
  assert.equal(library.initiallyClosedFilters, true, "global library secondary filters must start closed on first use");
  assert.equal(library.initialFilterReopened, true, "first-use filter summary must reopen the secondary controls");
  assert.equal(library.initialFilterReopenFocus, true, "first-use filter reopening must focus the first category control");
  assert.equal(library.initialResultStatusHidden, true, "unfiltered gallery audit must keep the duplicate result count hidden");
  assert.equal(library.persistedInitialOpenFilters, "open", "first-use filter reopening must persist the explicit open state");
  assert.ok(library.initialCollapsedFilterHeaderHeight < library.expandedFilterHeaderHeight, "first-use collapsed filters must release header space before the user expands them");
  assert.equal(library.desktopFilterSummaryVisible, true, "collapsed desktop filters must leave a visible reopening control");
  assert.equal(library.desktopFilterCollapseFocus, true, "desktop filter collapse must restore focus to the visible summary");
  assert.equal(library.desktopCollapsedFilterValue, "heatmap", "desktop filter collapse must preserve the active filter value");
  assert.equal(library.desktopCollapsedFilterSummary, "热图／矩阵图", "collapsed desktop filters must retain their active condition summary");
  assert.ok(library.collapsedFilterHeaderHeight < library.expandedFilterHeaderHeight, `collapsed desktop filters must release header space: ${library.collapsedFilterHeaderHeight}px vs ${library.expandedFilterHeaderHeight}px`);
  assert.equal(library.persistedClosedFilters, "closed", "desktop filter collapse state must persist locally");
  assert.equal(library.desktopFilterReopened, true, "desktop filter summary must reopen controls with one click");
  assert.equal(library.desktopFilterReopenFocus, true, "reopening desktop filters must focus the first category choice");
  assert.equal(library.desktopReopenedFilterValue, "heatmap", "reopening desktop filters must preserve the active filter value");
  assert.equal(library.persistedOpenFilters, "open", "reopened desktop filter state must replace its persisted collapsed state");
  assert.equal(library.categoryVisible, 1, "category filtering must isolate one research image type");
  assert.deepEqual(library.categoryResultStatus, { hidden: false, text: "显示 1 张，共 8 张" }, "category filtering must reveal its exact result count");
  assert.equal(library.categoryFilterSummary, "热图／矩阵图", "mobile filter disclosure must name its active category");
  assert.equal(library.categoryFilterTitle, "当前条件：热图／矩阵图", "single-filter tooltip must name the complete condition");
  assert.equal(library.multiFilterSummary, "热图／矩阵图 等 2 项", "multi-filter disclosure must name its first condition and total count");
  assert.ok(library.multiFilterTitle.includes("热图／矩阵图") && library.multiFilterTitle.includes("可定位本机文献"), "multi-filter tooltip must retain every complete condition");
  assert.equal(library.filteredSelectVisibleLabel, "全选当前 1 张", "filtered select action must show the exact current-result count");
  assert.equal(library.resetFilterSummary, "未筛选", "clear filter must reset the disclosure summary");
  assert.equal(library.resetResultStatusHidden, true, "clearing filters must hide the redundant full-result count again");
  assert.equal(library.searchVisible, 1, "global library search must filter titles");
  assert.deepEqual(library.searchResultStatus, { hidden: false, text: "显示 1 张，共 8 张" }, "active search must reveal its exact result count");
  assert.equal(library.searchFilterSummary, "搜索：论文图像示例 2", "active search must appear in the collapsed filter summary");
  assert.equal(library.searchFilterTitle, "当前条件：搜索：论文图像示例 2", "active search tooltip must expose the complete query");
  assert.equal(library.emptySearchFilterSummary, "搜索：不存在的图片条件", "zero-result search must remain visible as the active condition");
  assert.deepEqual(library.emptySearchResultStatus, { hidden: false, text: "显示 0 张，共 8 张" }, "zero-result search must retain visible result feedback");
  assert.equal(library.emptySelectVisibleLabel, "全选当前 0 张", "empty search result must expose a zero-count select action");
  assert.equal(library.emptySelectVisibleDisabled, true, "empty search result must disable select-visible action");
  assert.equal(library.emptyResetVisible, true, "zero-result search must expose its direct reset action");
  assert.equal(library.emptyResetLabel, "清除筛选并显示全部", "zero-result reset must describe its complete recovery result in Chinese");
  assert.ok(library.emptyMessage.includes("没有符合当前筛选条件的图片"), "zero-result state must explain why the library is empty");
  assert.equal(library.emptyResetRestored, library.cardCount, "zero-result reset must restore every saved image");
  assert.equal(library.emptyResetFocusedSearch, true, "zero-result reset must return keyboard focus to search");
  assert.equal(library.emptyResetFilterSummary, "未筛选", "zero-result reset must clear the filter summary");
  assert.equal(library.emptyResetResultStatusHidden, true, "zero-result reset must hide the restored full-result count");
  assert.equal(library.sortOnlyResultStatusHidden, true, "non-default sorting alone must not reveal a redundant full-result count");
  assert.equal(library.resetVisible, library.cardCount, "clear filter must restore the full global library");
  assert.equal(library.sortedFirstSize, library.maxSize, "size sorting must place the largest original image first");
  assert.equal(library.sortFilterSummary, "排序：文件从大到小", "non-default sorting must be named in the collapsed filter summary");
  assert.equal(library.sortFilterTitle, "当前条件：排序：文件从大到小", "sorting tooltip must expose the complete active order");
  assert.equal(library.cardSize, "420px", "image-size slider must update the auto-flow card width");
  assert.equal(library.cardLayoutLabel, `每行最多 ${library.cardColumnCount} 张`, "image-size control must show the live desktop row capacity");
  assert.ok(library.cardSizeAria.includes("目标宽度 420 像素") && library.cardSizeAria.includes(library.cardLayoutLabel), "image-size control must expose target width and live capacity accessibly");
  assert.equal(library.cardLayoutLabel, `每行最多 ${library.cardColumnCount} 张`, "image-size control must show the live desktop row capacity");
  assert.ok(library.cardSizeAria.includes("目标宽度 420 像素") && library.cardSizeAria.includes(library.cardLayoutLabel), "image-size control must expose target width and live capacity accessibly");
  assert.equal(library.linkedVisible, library.cardCount - 1, "source matching filter must exclude an unmatched imported fixture");
  assert.equal(library.tableMode, true, "table tab must show the metadata table and hide the gallery");
  assert.equal(library.tableTitleActionCount, library.cardCount, "every table paper title must expose a full-image viewer action");
  assert.equal(library.tableTitleViewerOpened, true, "clicking a table paper title must open the full-image viewer");
  assert.equal(library.tableTitleViewerTitle, "Segmentation <script> benchmark", "table paper title viewer must open the matching image record");
  assert.equal(library.tableTitleFocusRestored, true, "closing a table-title viewer must restore focus to the invoked title");
  assert.equal(library.desktopTableHeaderCount, 10, "desktop table must retain all ten dedicated metadata columns, including the description column");
  assert.equal(library.desktopTableFactsHidden, true, "desktop table must avoid duplicating compact mobile facts");
  assert.equal(library.tablePreviewHeaderText, "预览", "desktop table must name the image column by its actual preview purpose");
  assert.equal(library.tableImageLabelsHidden, true, "desktop table must not repeat a visible view command beside every clickable thumbnail");
  assert.ok(library.tableImageButtonTitles.every((title) => title.startsWith("查看大图：")), "every compact table thumbnail must retain an explicit Chinese hover title");
  assert.ok(library.tableImageWidths.every((width) => width === 96), `desktop table previews must retain inspectable image width: ${library.tableImageWidths.join(",")}`);
  assert.equal(library.galleryMode, true, "gallery tab must restore the large-image grid");
  assert.equal(library.tableSizeControlHidden, true, "table mode must hide the gallery-only image-width control");
  assert.ok(Math.abs(library.stickyTableOffset - library.stickyHeaderHeight) <= 1, `table header offset must match the responsive sticky header: ${library.stickyTableOffset}px vs ${library.stickyHeaderHeight}px`);
  assert.equal(library.tableHeaderBeforeFirstRow, true, "wide table headings must remain above the first data row before scrolling");
  assert.equal(library.tableHeaderSticksBelowPageHeader, true, "wide table headings must stick directly below the responsive page header while scrolling");
  assert.equal(library.gallerySizeControlVisible, true, "gallery mode must restore the image-width control");
  assert.equal(library.tableTabSelected, "true", "table tab must expose selected state");
  assert.equal(library.tableTabIndex, 0, "selected table tab must stay in the tab order");
  assert.equal(library.galleryTabIndexInTable, -1, "inactive gallery tab must leave the tab order");
  assert.equal(library.galleryTabSelected, "true", "gallery tab must expose selected state");
  assert.equal(library.galleryTabIndex, 0, "selected gallery tab must stay in the tab order");
  assert.equal(library.tableTabIndexInGallery, -1, "inactive table tab must leave the tab order");
  assert.equal(library.galleryKeyboardFocus, true, "view arrow navigation must move focus with the selected tab");
  assert.equal(library.endKeyOpenedTable, true, "view End key must activate and focus the final tab");
  assert.equal(library.homeKeyOpenedGallery, true, "view Home key must activate and focus the first tab");
  assert.equal(library.persistedTableView, "table", "table selection must persist for the next gallery session");
  assert.equal(library.persistedGalleryView, "gallery", "gallery selection must replace the persisted table mode");
  assert.equal(library.viewerOpened, true, "clicking a saved image must open the full-image viewer");
  assert.equal(library.viewerImageErrorFeedback, true, "full-image viewer must show a Chinese failure state when an original cannot load");
  assert.equal(library.cardImageErrorFeedback, true, "gallery card must show a Chinese failure state when an original cannot load");
  assert.equal(library.viewerDownloadFailureState, true, "failed full-image originals must disable download until the image loads");
  assert.equal(library.cardDownloadFailureState, true, "failed gallery originals must disable download until the image loads");
  assert.equal(library.viewerShortcutDeclaration, "Escape ArrowLeft ArrowRight = - 0 1", "full-image viewer must declare every supported keyboard shortcut");
  assert.equal(library.viewerPrevShortcut, "ArrowLeft", "previous-image action must expose its direction-key shortcut");
  assert.equal(library.viewerNextShortcut, "ArrowRight", "next-image action must expose its direction-key shortcut");
  assert.equal(library.viewerPrevText.trim(), "← 上一张", "previous-image action must carry an explicit direction mark");
  assert.equal(library.viewerNextText.trim(), "下一张 →", "next-image action must carry an explicit direction mark");
  assert.match(library.viewerMetadata, /指标／训练曲线.*2026.*原文第 2 页.*1200 × 800 像素.*117\.2 KB.*本机采集/, "full-image viewer must show complete Chinese image facts");
  assert.equal(library.viewerMatchedSource, "定位原文", "matched full-image viewer must retain its source action");
  assert.equal(library.viewerDownloadName, "Segmentation_script_benchmark_2026_第2页_图001.svg", "full-image viewer must download the current original with its readable provenance filename");
  assert.equal(library.viewerDownloadTitle, "下载为 " + library.viewerDownloadName, "full-image viewer must expose the exact resulting filename before download");
  assert.equal(library.viewerSelectInitial, true, "full-image viewer selection must reflect the unselected image state");
  assert.equal(library.viewerSelectedCountInitial, "0", "full-image viewer must expose the initial total selection count");
  assert.equal(library.viewerSelectionTextInitial, "加入批量", "unselected viewer image must name the available batch action");
  assert.equal(library.viewerCloseInitialText, "关闭", "full-image viewer must retain a plain close action before selection");
  assert.ok(library.viewerCloseGlyph.includes("×"), `the large-image viewer must show a × on its close control so it reads as "close and return": ${library.viewerCloseGlyph}`);
  assert.ok(library.viewerCloseInitialAria.includes("返回图片库列表"), `the close control must announce that it returns to the gallery list: ${library.viewerCloseInitialAria}`);
  assert.equal(library.viewerSelectChecked, true, "full-image viewer must visibly mark the current image as selected");
  assert.equal(library.viewerSelectedCountAfterAdd, "1", "full-image viewer count must update after selecting the current image");
  assert.equal(library.viewerSelectionTextAfterAdd, "移出批量", "selected viewer image must name the removal action");
  assert.ok(library.viewerSelectionAriaAfterAdd.includes("当前共选择 1 张"), "full-image viewer checkbox must announce the total selection count");
  assert.equal(library.viewerFinishText, "完成选择", "full-image viewer must expose a clear completion action after selection");
  assert.equal(library.viewerFinishTitle, "关闭大图查看并前往批量操作；按 Esc 仅关闭查看", "selection completion action must explain its destination and distinct Escape behavior");
  assert.equal(library.viewerFinishHighlighted, true, "selection completion action must be visually distinct");
  assert.equal(library.viewerSelectionInputsSynced, 2, "full-image selection must synchronize gallery and table checkboxes");
  assert.ok(library.viewerSelectionSummary.startsWith("已选择 1 张"), "full-image selection must update the batch summary");
  assert.equal(library.nextViewerSelectionUnchecked, true, "full-image navigation must refresh selection state for the next image");
  assert.equal(library.nextViewerSelectedCount, "1", "full-image navigation must preserve the total selection count");
  assert.equal(library.nextViewerSelectionText, "加入批量", "viewer navigation must refresh the visible selection action for the next image");
  assert.equal(library.viewerSelectedCountAfterSecondAdd, "2", "full-image viewer count must include a second selected image");
  assert.equal(library.viewerSelectedCountAfterSecondRemove, "1", "full-image viewer count must decrease after removing the current image");
  assert.equal(library.viewerSelectionTextAfterRemove, "加入批量", "removing the current viewer image must restore the add action");
  assert.equal(library.viewerInitialZoom, "适应窗口", "full-image viewer must open with the whole image visible");
  assert.equal(library.viewerActualZoom, "100%", "1:1 action must report original-pixel scale");
  assert.equal(library.viewerActualWidth, 100, "1:1 action must show the image at its original pixel size");
  assert.equal(library.viewerEnlargedZoom, "125%", "zoom-in action must advance to the next bounded scale");
  assert.ok(library.viewerEnlargedWidth > library.viewerActualWidth, "zoom-in action must visibly enlarge the original image");
  assert.equal(library.viewerZoomedScrollable, true, "enlarged originals must keep reporting a concrete zoom level");
  assert.equal(library.viewerFittedZoom, "适应窗口", "fit action must restore the complete-image view");
  assert.ok(library.viewerFittedWidth <= library.viewerActualWidth, "fit action must shrink the image back inside the available stage");
  assert.equal(library.viewerReducedZoom, "适应窗口", "zoom-out action must return to fit when the previous scale equals the fitted image");
  assert.equal(library.viewerKeyboardActualZoom, "100%", "numeric 1 shortcut must activate original-pixel zoom");
  assert.equal(library.viewerKeyboardFitZoom, "适应窗口", "numeric 0 shortcut must restore fit zoom");
  assert.equal(library.viewerControlOverflow, 0, "full-image viewer controls must stay inside the desktop viewport");
  assert.ok(library.viewerStandardControlHeights.every((height) => height === 32), `desktop full-image viewer actions must use the 32px SimpleExperiment size: ${library.viewerStandardControlHeights.join(",")}`);
  assert.ok(library.viewerCompactControlHeights.every((height) => height === 30), "desktop viewer zoom controls must use the compact 30px size");
  assert.equal(library.viewerHeaderInline, true, "desktop full-image viewer must retain its compact inline header");
  assert.ok(library.viewerStageHeight >= 700, `desktop full-image viewer leaves too little image space: ${library.viewerStageHeight}px`);
  assert.equal(library.viewerImageObstructed, false, "full-image viewer header and footer must not cover image pixels");
  assert.equal(library.viewerFocusWrapped, true, "full-image viewer must keep keyboard focus inside the modal");
  assert.equal(library.viewerAdvanced, true, "full-image viewer next action must advance to another image");
  assert.equal(library.viewerNavigationFocusStable, true, "full-image navigation must preserve focus on the invoked action");
  assert.equal(library.viewerKeyboardPreviousPosition, library.firstViewerPosition, "left-arrow shortcut must return to the previous visible image");
  assert.equal(library.viewerKeyboardNextPosition, library.nextViewerPosition, "right-arrow shortcut must advance to the next visible image");
  assert.equal(library.viewerKeyboardNavigationFocusStable, true, "direction-key navigation must preserve the current viewer control focus");
  assert.equal(library.viewerClosed, true, "full-image viewer close action must dismiss the overlay");
  assert.equal(library.viewerBatchFocus, true, "completing viewer selection must focus the available batch share action");
  assert.equal(library.viewerBatchVisible, true, "completing viewer selection must reveal the batch action row");
  assert.equal(library.viewerUnmatchedSource, "无本机文献", "unmatched full-image viewer must explain why source navigation is unavailable");
  assert.equal(library.viewerUnmatchedDisabled, "true", "unmatched full-image source state must be exposed accessibly");
  assert.equal(library.viewerUnmatchedHasHref, false, "unmatched full-image source state must not expose an invalid link");
  assert.equal(library.viewerEscapeClosed, true, "Escape must close the full-image viewer");
  assert.equal(library.viewerEscapeFocusRestored, true, "Escape must restore focus to the invoking image");
  assert.equal(library.viewerPlainCloseText, "关闭", "viewer close button must return to its plain label when selection is empty");
  assert.equal(library.viewerPlainCloseFocusRestored, true, "plain viewer close must restore focus to the invoking image");
  assert.equal(library.clickedSourceCount, library.sourceCount, "every global-library source link must remain actionable");
  assert.equal(library.sourceFeedback, "已请求 Zotero 定位来源", "global-library source links must show Chinese trigger feedback");
  assert.equal(library.selectionInputCount, library.cardCount * 2, "gallery and table must both expose synchronized selection inputs");
  assert.equal(library.selectionGuidance, "勾选后批量操作；按 Shift 连续选择；导入无需选择", "desktop batch workflow must explain range selection without mobile-only guidance");
  assert.deepEqual(library.initialBatchVisibility, { select: true, clear: false, summary: false, import: true, share: false, remove: false }, "desktop batch row must initially show only immediately usable select and import actions");
  assert.ok(library.desktopSelectionHints.every((hint) => hint.title.includes("Shift") && hint.aria.includes("Shift")), "desktop selection controls must explain range selection in titles and accessible names");
  assert.ok(library.desktopCardSelectionTitles.every((title) => title.includes("Shift")), "desktop card selection labels must explain range selection");
  assert.equal(library.selectVisibleInitialLabel, `全选当前 ${library.cardCount} 张`, "select-visible action must show the complete initial result count");
  assert.equal(library.selectedCount, library.cardCount, "select-visible action must select every filtered card");
  assert.ok(library.selectedSummary.startsWith(`已选择 ${library.cardCount} 张`), "selection summary must show selected count and bytes");
  assert.equal(library.selectVisibleSelectedLabel, `取消当前 ${library.cardCount} 张`, "select-visible toggle must show the exact cancellation scope");
  assert.equal(library.selectedShareLabel, `分享 ${library.cardCount} 张`, "share action must show its exact selected count");
  assert.equal(library.selectedDeleteLabel, `删除 ${library.cardCount} 张`, "delete action must show its exact selected count");
  assert.equal(library.selectedClearLabel, `清空已选 ${library.cardCount} 张`, "clear action must visibly name its complete selected scope");
  assert.ok(library.selectedClearTitle.includes(`清空全部 ${library.cardCount} 张选择`), "clear action must explain its complete selected scope");
  assert.deepEqual(library.selectedBatchVisibility, { clear: true, summary: true, share: true, remove: true }, "selecting images must immediately reveal every counted batch action and summary");
  assert.equal(library.desktopMobileDockHidden, true, "desktop selection must not render the mobile batch dock");
  assert.equal(library.clearedCount, 0, "clear-selection action must clear gallery and table selections");
  assert.equal(library.selectVisibleClearedLabel, `全选当前 ${library.cardCount} 张`, "clearing selection must restore the counted select-visible action");
  assert.equal(library.clearedShareLabel, "分享所选", "share action must restore its empty-selection label");
  assert.equal(library.clearedDeleteLabel, "删除所选", "delete action must restore its empty-selection label");
  assert.equal(library.clearedFeedback, `已清空 ${library.cardCount} 张选择`, "clear selection must report its exact affected count in Chinese");
  assert.deepEqual(library.clearedBatchVisibility, { clear: false, summary: false, share: false, remove: false }, "clearing selection must remove unavailable batch actions from the desktop workflow");
  assert.equal(library.rangeSelectedCount, 3, "Shift-click must select the complete visible interval");
  assert.equal(library.rangeTableSelectedCount, 3, "Shift-click must synchronize the selected interval into table checkboxes");
  assert.ok(library.rangeSelectedSummary.startsWith("已选择 3 张"), "Shift-click must update the total batch summary");
  assert.equal(library.rangeSelectionFeedback, "已连续选择 3 张图片", "Shift-click selection must report its exact interval count in Chinese");
  assert.equal(library.rangeDeselectedCount, 1, "Shift-click on a selected endpoint must clear the complete interval while preserving outside selections");
  assert.equal(library.rangeDeselectionFeedback, "已取消连续选择 2 张图片", "Shift-click deselection must report its exact interval count in Chinese");
  assert.ok(library.hiddenSelectedSummary.includes("当前筛选外 1 张"), "selection summary must expose selected images hidden by current filters");
  assert.ok(library.hiddenSelectedTitle.includes("包含当前筛选外的 1 张图片"), "selection summary tooltip must explain hidden batch scope");
  assert.ok(library.hiddenShareTitle.includes("其中当前筛选外 1 张"), "share tooltip must expose hidden selected images");
  assert.ok(library.hiddenDeleteTitle.includes("其中当前筛选外 1 张"), "delete tooltip must expose hidden selected images");
  assert.equal(library.hiddenShareLabel, "分享 1 张", "share action must keep the total selected count when the image is filtered out");
  assert.equal(library.hiddenDeleteLabel, "删除 1 张", "delete action must keep the total selected count when the image is filtered out");
  assert.equal(library.hiddenClearLabel, "清空全部 1 张", "clear action must visibly warn that it includes a filter-hidden selection");
  assert.ok(library.hiddenShareAria.includes("当前筛选外 1 张"), "share action accessible name must expose hidden selected scope");
  assert.ok(library.deleteConfirmMessage.includes("其中 1 张当前不在筛选结果中"), "delete confirmation must explicitly include hidden selected images");
  assert.deepEqual(library.commands.map((item) => item.command), ["exportImages", "importImages", "updateImageNote"], "share, import and description editing must each call one authenticated gallery command");
  assert.ok(JSON.parse(library.commands[0].imageIDs).length === 1, "share command must contain only selected image IDs");
  assert.equal(library.shareFeedback, "已分享 1 张图片，不含 PDF 文献文件", "share action must explain PDF exclusion in Chinese");
  assert.equal(library.importFeedback, "已导入 0 张；匹配文献 0 张；未匹配 0 张；跳过 0 张", "import action must report match results in Chinese");
  assert.equal(library.unknownBridgeFeedback, "图库操作失败，请查看 Zotero 错误控制台", "unknown bridge errors must not leak English into the gallery");
  assert.equal(library.availableAfterUnknownError, true, "non-connection command errors must not disable otherwise usable management controls");
  assert.equal(library.networkFeedback, "管理功能不可用，请保持 Zotero 运行并从 Zotero 重新打开图库", "browser network errors must switch to the same Chinese read-only recovery guidance");
  assert.deepEqual(library.liveDisconnectState, {
    selectedCount: 0,
    inputsDisabled: true,
    selectVisibleDisabled: true,
    shareDisabled: true,
    deleteDisabled: true,
    importDisabled: true,
    mobileDockHidden: true,
    summary: "未选择图片",
  }, "live Zotero disconnection must clear incomplete selection and atomically enter read-only mode");
  assert.equal(library.sourceBadgeCount, library.cardCount, "every card must show a short source status");
  assert.equal(library.originalDownloadCount, library.cardCount, "every card must expose its original image download");
  assert.equal(new Set(library.cardDownloadNames).size, library.cardCount, "every card download must have a unique readable filename");
  assert.ok(library.cardDownloadNames.every((name) => /_第\d+页_图\d{3}\.(?:jpg|png|gif|webp|svg)$/.test(name) && !/[<>:"\/\\|?*]/.test(name)), "card download filenames must retain page/order provenance and exclude filesystem-unsafe characters");
  assert.ok(library.cardDownloadTitles.every((title, index) => title === "下载为 " + library.cardDownloadNames[index]), "card download hover guidance must disclose the exact resulting filename");
  assert.equal(library.obstructedImageCount, 0, "gallery selection and dimensions must never cover the original image");
  assert.ok(library.tagLabels.every((label) => /[\u3400-\u9fff]/.test(label)), "global-library tags must use Chinese display labels");
  assert.equal(library.loadedImageCount, library.cardCount, "every global-library image must decode in the real browser");
  assert.equal(library.viewportWidth, 1440, "desktop global-library audit must use the requested CSS viewport");
  assert.ok(library.documentWidth <= library.viewportWidth, `global library overflows horizontally: ${library.documentWidth}px > ${library.viewportWidth}px`);

  // Regression guard for the reported bug: on a file:// gallery the browser ignores the download
  // attribute, so following the raw href used to navigate the whole list away. The page must
  // intercept the click, pull the bytes back from the plugin, and stay exactly where it was.
  await client.send("Page.setDownloadBehavior", { behavior: "deny", downloadPath: path.join(tempRoot, "downloads") });
  const downloadInterception = await evaluate(client, `(() => ({
    protocol: location.protocol,
    href: location.href,
    commands: (window.__libraryCommands || []).length,
    hasInterception: String(document.documentElement.innerHTML).includes('location.protocol !== "file:"'),
  }))()`);
  assert.equal(downloadInterception.protocol, "file:", "this guard only means anything on a file:// gallery");
  assert.equal(downloadInterception.hasInterception, true, "the gallery must ship the file:// download interception");
  const downloadOutcome = await evaluate(client, `(async () => {
    // The disconnect audit above leaves window.fetch failing on purpose; a download needs the
    // authenticated fetch back so the interception can be observed end to end.
    window.__libraryCommands = window.__libraryCommands || [];
    window.fetch = async function (_url, options) {
      var fields = new URLSearchParams(options.body);
      window.__libraryCommands.push({ command: fields.get("command"), imageIDs: fields.get("image_ids") || "" });
      if (fields.get("command") === "readImageBytes") {
        return { ok: true, json: async function () { return { ok: true, base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", mimeType: "image/png", byteCount: 70 }; } };
      }
      return { ok: true, json: async function () { return { ok: true }; } };
    };
    const before = location.href;
    const beforeCommands = (window.__libraryCommands || []).length;
    document.querySelector(".library-card:not([hidden]) a[data-download-image]").click();
    await new Promise(function (resolve) { setTimeout(resolve, 900); });
    const commands = window.__libraryCommands || [];
    return {
      navigated: location.href !== before,
      requestedBytes: commands.slice(beforeCommands).some(function (item) { return item.command === "readImageBytes"; }),
      message: document.getElementById("library-message")?.textContent || "",
      cardsVisible: document.querySelectorAll(".library-card:not([hidden])").length,
    };
  })()`);
  assert.equal(downloadOutcome.navigated, false, "downloading an original must never navigate the gallery away");
  assert.equal(downloadOutcome.requestedBytes, true, "a file:// download must fetch its bytes through the authenticated bridge");
  assert.ok(downloadOutcome.cardsVisible > 0, "the gallery list must still be rendered after a download");
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: path.join(tempRoot, "downloads") });

  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const liveDisconnectScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-live-disconnect-desktop.png"), Buffer.from(liveDisconnectScreenshot.data, "base64"));
  }
  await evaluate(client, `document.querySelector('button[data-view="table"]')?.click()`);
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(async () => {
    const state = await evaluate(client, `(() => ({ready:document.readyState,cards:document.querySelectorAll('.library-card').length,tableVisible:!document.getElementById('library-table')?.hidden,sizeHidden:!!document.getElementById('library-size-control')?.hidden,selected:document.getElementById('library-view-table')?.getAttribute('aria-selected')}))()`);
    return state?.ready === "complete" && state.cards === 8 && state.tableVisible && state.sizeHidden && state.selected === "true";
  });
  const restoredTableView = await evaluate(client, `(() => ({tableVisible:!document.getElementById('library-table')?.hidden,gridHidden:!!document.getElementById('library-grid')?.hidden,sizeHidden:!!document.getElementById('library-size-control')?.hidden,selected:document.getElementById('library-view-table')?.getAttribute('aria-selected'),stored:localStorage.getItem('pdf-image-saver-library-view-v1')}))()`);
  assert.deepEqual(restoredTableView, { tableVisible: true, gridHidden: true, sizeHidden: true, selected: "true", stored: "table" }, "reloaded global library must restore the persisted table view without gallery-only controls");
  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const tableScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-table-desktop.png"), Buffer.from(tableScreenshot.data, "base64"));
  }
  await evaluate(client, `document.querySelector('button[data-view="gallery"]')?.click()`);
  await waitFor(async () => evaluate(client, `(() => !document.getElementById('library-grid')?.hidden && !!document.getElementById('library-table')?.hidden)()`));
  if (screenshotDirectory) {
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const galleryScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-gallery-desktop.png"), Buffer.from(galleryScreenshot.data, "base64"));
    await evaluate(client, `(() => { const panel=document.getElementById('library-filter-panel');const search=document.getElementById('library-search');panel.open=true;search.value='论文图像示例 2';search.dispatchEvent(new Event('input',{bubbles:true}));panel.open=false;return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});}); })()`);
    const searchSummaryState = await evaluate(client, `(() => ({query:document.getElementById('library-search').value,summary:document.getElementById('library-filter-summary').textContent,title:document.getElementById('library-filter-summary').title,resetDisabled:document.getElementById('library-reset').disabled,visible:document.querySelectorAll('.library-card:not([hidden])').length,panelOpen:document.getElementById('library-filter-panel').open}))()`);
    assert.deepEqual(searchSummaryState, { query: "论文图像示例 2", summary: "搜索：论文图像示例 2", title: "当前条件：搜索：论文图像示例 2", resetDisabled: false, visible: 1, panelOpen: false }, "collapsed global-library filter summary must keep the active search query and recovery action visible");
    const searchSummaryScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-search-summary-desktop.png"), Buffer.from(searchSummaryScreenshot.data, "base64"));
    await evaluate(client, `(() => { const search=document.getElementById('library-search');search.value='不存在的图片条件';search.dispatchEvent(new Event('input',{bubbles:true}));return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});}); })()`);
    const emptySearchState = await evaluate(client, `(() => { const empty=document.getElementById('library-empty');const action=document.getElementById('library-empty-reset');return {visible:getComputedStyle(empty).display!=='none',label:action?.textContent||'',actionVisible:!!action&&getComputedStyle(action).display!=='none',resultCount:document.querySelectorAll('.library-card:not([hidden])').length}; })()`);
    assert.deepEqual(emptySearchState, { visible: true, label: "清除筛选并显示全部", actionVisible: true, resultCount: 0 }, "zero-result screenshot must preserve an obvious direct recovery action");
    const emptySearchScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-empty-search-desktop.png"), Buffer.from(emptySearchScreenshot.data, "base64"));
    await evaluate(client, `document.getElementById('library-empty-reset')?.click()`);
    await evaluate(client, `(() => { document.getElementById('library-reset').click();document.getElementById('library-filter-panel').open=true;return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});}); })()`);
    await evaluate(client, `document.getElementById('library-filter-collapse')?.click(); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const collapsedFilterScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-filter-collapsed-desktop.png"), Buffer.from(collapsedFilterScreenshot.data, "base64"));
    await evaluate(client, `document.querySelector('#library-filter-panel > summary')?.click(); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    await evaluate(client, `(() => { const inputs=Array.from(document.querySelectorAll('.library-card:not([hidden]) input[data-select-image]')).slice(0,3); inputs[0].click(); inputs[2].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true})); return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});}); })()`);
    const rangeSelectionScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-range-selection-desktop.png"), Buffer.from(rangeSelectionScreenshot.data, "base64"));
    await evaluate(client, `document.getElementById('clear-selection')?.click()`);
    await evaluate(client, `document.querySelector('.library-card:not([hidden]) [data-open-image]')?.click()`);
    await waitFor(async () => evaluate(client, `(() => { const viewer=document.getElementById('library-viewer'); const image=document.getElementById('viewer-image'); return !viewer?.hidden && image?.complete && image?.naturalWidth > 0; })()`));
    await evaluate(client, `(() => { const input=document.getElementById('viewer-select'); input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-viewer-desktop.png"), Buffer.from(screenshot.data, "base64"));
    await evaluate(client, `(() => { const input=document.getElementById('viewer-select'); input.checked=false; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await evaluate(client, `document.getElementById('viewer-close')?.click()`);
  }
  await client.send("Page.navigate", { url: pathToFileURL(offlineLibraryFixture).href });
  await waitFor(async () => {
    const state = await evaluate(client, `({ready:document.readyState,cards:document.querySelectorAll('.library-card').length})`);
    return state?.ready === "complete" && state.cards === 8;
  });
  const offlineManagement = await evaluate(client, `(() => {
    const firstCard=document.querySelector('.library-card');
    const firstInput=firstCard?.querySelector('input[data-select-image]');
    firstInput?.click();
    const read = function(id){var control=document.getElementById(id);return {disabled:!!control?.disabled,title:control?.title||'',aria:control?.getAttribute('aria-label')||''};};
    const selectionInputs=Array.from(document.querySelectorAll('[data-select-image]'));
    const imageOpener=firstCard?.querySelector('[data-open-image]');
    const readOnlyActions={viewer:!imageOpener?.disabled,download:!!firstCard?.querySelector('a[download]'),source:!!firstCard?.querySelector('a[href^="zotero://"]')};
    imageOpener?.click();
    const viewer=document.getElementById('library-viewer');
    const viewerState={opened:!viewer?.hidden,select:read('viewer-select'),selectionText:document.querySelector('#viewer-selection-label span')?.textContent||'',closeText:document.getElementById('viewer-close')?.textContent||''};
    document.getElementById('viewer-close')?.click();
    return {
      message:document.getElementById('library-message')?.textContent||'',
      share:read('share-selected'),
      remove:read('delete-selected'),
      importPackage:read('import-package'),
      mobileShare:read('mobile-share-selected'),
      mobileRemove:read('mobile-delete-selected'),
      selectVisible:read('select-visible'),
      selectionInputsDisabled:selectionInputs.every(function(input){return input.disabled;}),
      selectedInputCount:selectionInputs.filter(function(input){return input.checked;}).length,
      cardSelected:firstCard?.classList.contains('is-selected')||false,
      selectionSummary:document.getElementById('selection-summary')?.textContent||'',
      mobileDockHidden:document.getElementById('mobile-selection-bar')?.hidden!==false,
      viewerState:viewerState,
      readOnlyActions:readOnlyActions,
    };
  })()`);
  const recoveryHint = "请保持 Zotero 运行并从 Zotero 重新打开图库";
  assert.equal(offlineManagement.message, "管理功能不可用，" + recoveryHint, "offline library must show a visible Zotero recovery path");
  for (const [name, control, action] of [
    ["desktop share", offlineManagement.share, "分享"],
    ["desktop delete", offlineManagement.remove, "删除"],
    ["import", offlineManagement.importPackage, "导入"],
    ["mobile share", offlineManagement.mobileShare, "分享"],
    ["mobile delete", offlineManagement.mobileRemove, "删除"],
  ]) {
    assert.equal(control.disabled, true, `${name} must stay disabled without a management connection`);
    assert.equal(control.title, `${action}不可用；${recoveryHint}`, `${name} title must explain how to restore management`);
    assert.equal(control.aria, control.title, `${name} accessible name must match its complete recovery guidance`);
  }
  const selectionRecovery = "批量选择不可用；" + recoveryHint;
  assert.equal(offlineManagement.selectionInputsDisabled, true, "offline gallery and table selection controls must stay disabled");
  assert.equal(offlineManagement.selectedInputCount, 0, "offline selection controls must not enter a hidden or partial selected state");
  assert.equal(offlineManagement.cardSelected, false, "offline gallery cards must not imply a batch selection that cannot be completed");
  assert.equal(offlineManagement.selectionSummary, "未选择图片", "offline batch summary must remain in its empty state");
  assert.equal(offlineManagement.mobileDockHidden, true, "offline selection must never expose the mobile batch dock");
  assert.deepEqual(offlineManagement.selectVisible, { disabled: true, title: selectionRecovery, aria: selectionRecovery }, "offline select-visible action must be disabled with the complete recovery path");
  assert.equal(offlineManagement.viewerState.opened, true, "offline image viewing must remain available");
  assert.deepEqual(offlineManagement.viewerState.select, { disabled: true, title: selectionRecovery, aria: selectionRecovery }, "offline full-image viewer selection must be disabled with the complete recovery path");
  assert.equal(offlineManagement.viewerState.selectionText, "批量不可用", "offline full-image viewer must name its unavailable batch state visibly");
  assert.equal(offlineManagement.viewerState.closeText, "关闭", "offline full-image viewer must not promise an unavailable batch-selection destination");
  assert.deepEqual(offlineManagement.readOnlyActions, { viewer: true, download: true, source: true }, "offline global library must preserve viewer, original download, and source navigation actions");
  if (screenshotDirectory) {
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const offlineScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-management-offline-desktop.png"), Buffer.from(offlineScreenshot.data, "base64"));
  }
  await client.send("Page.navigate", { url: pathToFileURL(libraryFixture).href });
  await waitFor(async () => {
    const state = await evaluate(client, `({ready:document.readyState,cards:document.querySelectorAll('.library-card').length})`);
    return state?.ready === "complete" && state.cards === 8;
  });
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await waitFor(async () => evaluate(client, `window.matchMedia('(prefers-color-scheme: dark)').matches`));
  const darkDanger = await evaluate(client, `(() => {
    document.getElementById('clear-selection')?.click();
    const category=document.getElementById('library-category');
    category.value='heatmap';
    category.dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('library-filter-panel').open=false;
    const input=document.querySelector('.library-card:not([hidden]) input[data-select-image]');
    input.checked=true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    const button=document.getElementById('delete-selected');
    const style=getComputedStyle(button);
    const primaryButton=document.getElementById('share-selected');
    const primaryStyle=getComputedStyle(primaryButton);
    const selection=input.closest('.selection-control');
    const card=input.closest('.library-card');
    const selectionStyle=getComputedStyle(selection);
    const cardStyle=getComputedStyle(card);
    const filterSummary=document.getElementById('library-filter-summary');
    const filterSummaryStyle=getComputedStyle(filterSummary);
    const filterSummaryControl=filterSummary.closest('summary');
    const filterSummaryControlStyle=getComputedStyle(filterSummaryControl);
    const searchStyle=getComputedStyle(document.getElementById('library-search'));
    const importStyle=getComputedStyle(document.getElementById('import-package'));
    const segmentedStyle=getComputedStyle(document.querySelector('.segmented'));
    return {
      color:style.color,
      backgroundColor:style.backgroundColor,
      primaryColor:primaryStyle.color,
      primaryBackground:primaryStyle.backgroundColor,
      disabled:button.disabled,
      label:button.textContent,
      dark:window.matchMedia('(prefers-color-scheme: dark)').matches,
      selectionLabel:selection.textContent.trim(),
      selectionColor:selectionStyle.color,
      selectionBackground:cardStyle.backgroundColor,
      selectedBorderColor:cardStyle.borderTopColor,
      filterSummary:filterSummary.textContent,
      filterVisible:filterSummaryControlStyle.display !== 'none',
      filterColor:filterSummaryStyle.color,
      filterBackground:filterSummaryControlStyle.backgroundColor,
      searchBorder:searchStyle.borderTopColor,
      searchBackground:searchStyle.backgroundColor,
      importBorder:importStyle.borderTopColor,
      importBackground:importStyle.backgroundColor,
      segmentedBorder:segmentedStyle.borderTopColor,
      segmentedBackground:segmentedStyle.backgroundColor,
    };
  })()`);
  const darkDangerContrast = getContrastRatio(darkDanger.color, darkDanger.backgroundColor);
  const darkPrimaryContrast = getContrastRatio(darkDanger.primaryColor, darkDanger.primaryBackground);
  const darkSelectionContrast = getContrastRatio(darkDanger.selectionColor, darkDanger.selectionBackground);
  const darkSelectionBorderContrast = getContrastRatio(darkDanger.selectedBorderColor, darkDanger.selectionBackground);
  const darkFilterContrast = getContrastRatio(darkDanger.filterColor, darkDanger.filterBackground);
  const darkSearchBoundaryContrast = getContrastRatio(darkDanger.searchBorder, darkDanger.searchBackground);
  const darkImportBoundaryContrast = getContrastRatio(darkDanger.importBorder, darkDanger.importBackground);
  const darkSegmentedBoundaryContrast = getContrastRatio(darkDanger.segmentedBorder, darkDanger.segmentedBackground);
  assert.equal(darkDanger.dark, true, "global-library dark-mode audit must use forced dark media");
  assert.equal(darkDanger.disabled, false, "selected dark-mode delete action must be available for visual audit");
  assert.equal(darkDanger.label, "删除 1 张", "dark-mode danger action must retain its native Chinese scope");
  assert.equal(darkDanger.selectionLabel, "选择图片", "dark-mode selected card must retain its native Chinese selection label");
  assert.equal(darkDanger.filterSummary, "热图／矩阵图", "dark-mode active filter must retain its native Chinese summary");
  assert.equal(darkDanger.filterVisible, true, "dark-mode active filter summary must be visible during contrast audit");
  assert.ok(darkDangerContrast >= 4.5, `dark-mode danger contrast is ${darkDangerContrast.toFixed(2)}:1, expected at least 4.5:1`);
  assert.ok(darkPrimaryContrast >= 4.5, `dark-mode primary-action contrast is ${darkPrimaryContrast.toFixed(2)}:1, expected at least 4.5:1`);
  assert.ok(darkSelectionContrast >= 4.5, `dark-mode selected-label contrast is ${darkSelectionContrast.toFixed(2)}:1, expected at least 4.5:1`);
  assert.ok(darkSelectionBorderContrast >= 3, `dark-mode selected-card border contrast is ${darkSelectionBorderContrast.toFixed(2)}:1, expected at least 3:1`);
  assert.ok(darkFilterContrast >= 4.5, `dark-mode active-filter contrast is ${darkFilterContrast.toFixed(2)}:1, expected at least 4.5:1`);
  assert.ok(darkSearchBoundaryContrast >= 3, `dark-mode search boundary contrast is ${darkSearchBoundaryContrast.toFixed(2)}:1, expected at least 3:1`);
  assert.ok(darkImportBoundaryContrast >= 3, `dark-mode action boundary contrast is ${darkImportBoundaryContrast.toFixed(2)}:1, expected at least 3:1`);
  assert.ok(darkSegmentedBoundaryContrast >= 3, `dark-mode view-switch boundary contrast is ${darkSegmentedBoundaryContrast.toFixed(2)}:1, expected at least 3:1`);
  if (screenshotDirectory) {
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const darkSelectionScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-selection-dark-desktop.png"), Buffer.from(darkSelectionScreenshot.data, "base64"));
  }
  await evaluate(client, `document.getElementById('clear-selection')?.click(); document.getElementById('library-reset')?.click()`);
  await client.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await waitFor(async () => evaluate(client, `window.matchMedia('(prefers-color-scheme: light)').matches`));
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(async () => {
    const state = await evaluate(client, `({ready:document.readyState,mobile:window.matchMedia('(max-width:620px)').matches,open:document.getElementById('library-filter-panel')?.open,cards:document.querySelectorAll('.library-card').length})`);
    return state?.ready === "complete" && state.mobile && state.open === false && state.cards === 8;
  });
  const mobileInitialGuidance = await evaluate(client, `(() => { const message=document.getElementById('library-message'); const inputs=Array.from(document.querySelectorAll('[data-select-image]')); const labels=Array.from(document.querySelectorAll('.selection-control')); return {text:message?.textContent||'',isDefault:message?.dataset.defaultGuidance||'',inputTitles:inputs.map(function(input){return input.title||'';}),inputAria:inputs.map(function(input){return input.getAttribute('aria-label')||'';}),cardTitles:labels.map(function(label){return label.title||'';})}; })()`);
  if (screenshotDirectory) {
    const mobileGuidanceScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-guidance-mobile.png"), Buffer.from(mobileGuidanceScreenshot.data, "base64"));
  }
  const mobileFilterDisclosure = await evaluate(client, `(() => {
    const category=document.getElementById('library-category');
    const source=document.getElementById('library-source');
    const panel=document.getElementById('library-filter-panel');
    category.value='heatmap'; category.dispatchEvent(new Event('change',{bubbles:true}));
    source.value='linked'; source.dispatchEvent(new Event('change',{bubbles:true}));
    panel.open=false;
    const heading=panel.querySelector('summary > span:first-child').getBoundingClientRect();
    const value=document.getElementById('library-filter-summary');
    const valueRect=value.getBoundingClientRect();
    const panelRect=panel.getBoundingClientRect();
    const result={text:value.textContent,title:value.title,aria:value.getAttribute('aria-label')||'',selectLabel:document.getElementById('select-visible')?.textContent||'',overlap:valueRect.left<heading.right+6||valueRect.right>panelRect.right-34};
    document.getElementById('library-reset').click(); panel.open=false;
    return result;
  })()`);
  const mobileTable = await evaluate(client, `(() => {
    document.getElementById('library-view-table').click();
    const view=document.getElementById('library-table');
    const visibleHeaders=Array.from(view.querySelectorAll('th')).filter(function(cell){return getComputedStyle(cell).display!=='none';}).map(function(cell){return cell.textContent.trim();});
    const facts=Array.from(view.querySelectorAll('.table-facts'));
    const preview=view.querySelector('.table-image img');
    const titleActions=Array.from(view.querySelectorAll('.table-title-button[data-open-image]'));
    const result={horizontalOverflow:Math.max(0,view.scrollWidth-view.clientWidth),visibleHeaders:visibleHeaders,hiddenHeaderCount:view.querySelectorAll('th').length-visibleHeaders.length,factsVisible:facts.filter(function(item){return getComputedStyle(item).display!=='none';}).length,factsComplete:facts.every(function(item){return item.textContent.includes('第 ')&&item.textContent.includes('·');}),sourceActionCount:view.querySelectorAll('.table-source .table-link').length,selectionCount:view.querySelectorAll('.table-select input[data-select-image]').length,titleActionCount:titleActions.length,titleActionOverflow:titleActions.filter(function(button){var rect=button.getBoundingClientRect();var cell=button.closest('td').getBoundingClientRect();return rect.left<cell.left-1||rect.right>cell.right+1;}).length,previewWidth:Math.round(preview.getBoundingClientRect().width),rowOverflow:Array.from(view.querySelectorAll('tbody tr')).filter(function(row){var rect=row.getBoundingClientRect();var box=view.getBoundingClientRect();return rect.left<box.left-1||rect.right>box.right+1;}).length};
    document.getElementById('library-view-gallery').click();
    return result;
  })()`);
  const mobileBatchDock = await evaluate(client, `(() => {
    const input=document.querySelector('.library-card:not([hidden]) [data-select-image]');
    input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true}));
    const dock=document.getElementById('mobile-selection-bar');
    const share=document.getElementById('mobile-share-selected');
    const remove=document.getElementById('mobile-delete-selected');
    const clear=document.getElementById('mobile-clear-selection');
    const dockRect=dock.getBoundingClientRect();
    const mainPaddingBottom=Number.parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom)||0;
    const visible=!dock.hidden&&getComputedStyle(dock).display!=='none';
    const controlOverflow=Array.from(dock.querySelectorAll('button')).filter(function(control){var rect=control.getBoundingClientRect();return rect.left<dockRect.left-1||rect.right>dockRect.right+1||rect.top<dockRect.top-1||rect.bottom>dockRect.bottom+1;}).length;
    const other=Array.from(document.querySelectorAll('.library-card')).find(function(card){return card.dataset.category!==input.closest('.library-card').dataset.category;});
    const category=document.getElementById('library-category');
    category.value=other.dataset.category; category.dispatchEvent(new Event('change',{bubbles:true}));
    const hiddenSummary=document.getElementById('mobile-selection-summary').textContent;
    document.getElementById('library-reset').click();
    const delegated=[];
    document.getElementById('share-selected').addEventListener('click',function(event){event.stopImmediatePropagation();delegated.push('share');},{capture:true,once:true});
    document.getElementById('delete-selected').addEventListener('click',function(event){event.stopImmediatePropagation();delegated.push('delete');},{capture:true,once:true});
    share.click(); remove.click();
    const result={visible:visible,summary:document.getElementById('mobile-selection-summary').textContent,hiddenSummary:hiddenSummary,shareLabel:share.textContent,deleteLabel:remove.textContent,shareAria:share.getAttribute('aria-label')||'',bodyClass:document.body.classList.contains('has-mobile-selection-bar'),insideViewport:dockRect.left>=0&&dockRect.right<=window.innerWidth&&dockRect.top>=0&&dockRect.bottom<=window.innerHeight,controlOverflow:controlOverflow,mainPaddingBottom:mainPaddingBottom,dockHeight:Math.round(dockRect.height),delegated:delegated};
    clear.click();
    result.hiddenAfterClear=dock.hidden;
    result.bodyClassAfterClear=document.body.classList.contains('has-mobile-selection-bar');
    result.selectionCleared=!input.checked;
    return result;
  })()`);
  const mobileLibrary = await evaluate(client, `(() => {
    const panel = document.getElementById('library-filter-panel');
    const summary = panel?.querySelector('summary');
    const header = document.querySelector('.app-header');
    const firstCard = document.querySelector('.library-card:not([hidden])');
    const mobileCardLayoutLabel = document.getElementById('library-card-layout')?.textContent || '';
    const mobileCardSizeAria = document.getElementById('library-card-size')?.getAttribute('aria-valuetext') || '';
    const closed = panel?.open === false;
    const headerPosition = getComputedStyle(header).position;
    const headerHeight = Math.round(header.getBoundingClientRect().height);
    const firstCardTop = Math.round(firstCard.getBoundingClientRect().top);
    const compactHiddenActions = ['clear-selection','share-selected','delete-selected','selection-summary'].filter(function(id){return getComputedStyle(document.getElementById(id)).display === 'none';}).length;
    const mobileImportButton = document.getElementById('import-package');
    const mobileImportFits = mobileImportButton.scrollWidth <= mobileImportButton.clientWidth + 1 && mobileImportButton.getBoundingClientRect().right <= window.innerWidth + 1;
    summary?.click();
    const opened = panel?.open === true && getComputedStyle(document.getElementById('library-category')).display !== 'none';
    summary?.click();
    const selection = document.querySelector('.library-card:not([hidden]) [data-select-image]');
    selection.checked = true;
    selection.dispatchEvent(new Event('change', { bubbles:true }));
    const revealedSelectionActions = ['clear-selection','share-selected','delete-selected','selection-summary'].filter(function(id){return getComputedStyle(document.getElementById(id)).display !== 'none';}).length;
    const mobileShareCountLabel = document.getElementById('share-selected')?.textContent || '';
    const mobileDeleteCountLabel = document.getElementById('delete-selected')?.textContent || '';
    const revealedActionOverflow = Array.from(document.querySelectorAll('.batch-row .action')).filter(function(control){if(getComputedStyle(control).display === 'none')return false;var rect=control.getBoundingClientRect();return rect.left < -1 || rect.right > window.innerWidth + 1;}).length;
    selection.checked = false;
    selection.dispatchEvent(new Event('change', { bubbles:true }));
    const obstructedImageCount = Array.from(document.querySelectorAll('.library-card')).filter(function(card){var imageButton=card.querySelector('.image-button');if(!imageButton||imageButton.querySelector(':scope > :not(img)'))return true;var imageRect=imageButton.getBoundingClientRect();return Array.from(card.querySelectorAll('.selection-control,.image-dimensions')).some(function(element){var rect=element.getBoundingClientRect();return rect.left < imageRect.right && rect.right > imageRect.left && rect.top < imageRect.bottom && rect.bottom > imageRect.top;});}).length;
    document.getElementById('library-view-table').click();
    const compactTableHeaderStatic = getComputedStyle(document.querySelector('#library-table th')).position === 'static';
    const compactTableSizeHidden = document.getElementById('library-size-control').hidden;
    document.getElementById('library-view-gallery').click();
    const viewerOpener = firstCard.querySelector('[data-open-image]');
    viewerOpener.click();
    const viewer = document.getElementById('library-viewer');
    const mobileViewerVisible = !viewer.hidden;
    const mobileViewerMetadata = document.getElementById('viewer-meta')?.textContent || '';
    const mobileViewerStage = document.getElementById('viewer-stage');
    const mobileViewerImage = document.getElementById('viewer-image');
    const mobileViewerSelect = document.getElementById('viewer-select');
    const mobileViewerSelectionCount = document.getElementById('viewer-selection-count');
    const mobileViewerClose = document.getElementById('viewer-close');
    const mobileViewerSelectInitial = !mobileViewerSelect.checked;
    const mobileViewerCountInitial = mobileViewerSelectionCount?.textContent || '';
    const mobileViewerCloseInitialText = mobileViewerClose?.textContent || '';
    mobileViewerSelect.checked = true;
    mobileViewerSelect.dispatchEvent(new Event('change', { bubbles:true }));
    const mobileViewerSelectSynced = mobileViewerSelect.checked && firstCard.classList.contains('is-selected');
    const mobileViewerCountAfterAdd = mobileViewerSelectionCount?.textContent || '';
    const mobileViewerFinishText = mobileViewerClose?.textContent || '';
    mobileViewerSelect.checked = false;
    mobileViewerSelect.dispatchEvent(new Event('change', { bubbles:true }));
    const mobileViewerCountAfterRemove = mobileViewerSelectionCount?.textContent || '';
    const mobileViewerCloseAfterRemove = mobileViewerClose?.textContent || '';
    const mobileViewerZoomValue = document.getElementById('viewer-zoom-value');
    const mobileViewerInitialZoom = mobileViewerZoomValue?.textContent || '';
    document.getElementById('viewer-zoom-actual').click();
    const mobileViewerActualZoom = mobileViewerZoomValue?.textContent || '';
    const mobileViewerActualWidth = Math.round(mobileViewerImage.getBoundingClientRect().width);
    const mobileViewerActualScrollable = mobileViewerStage.scrollWidth > mobileViewerStage.clientWidth;
    document.getElementById('viewer-zoom-fit').click();
    const mobileViewerFittedZoom = mobileViewerZoomValue?.textContent || '';
    const mobileViewerFittedWidth = Math.round(mobileViewerImage.getBoundingClientRect().width);
    const mobileViewerControlOverflow = Array.from(viewer.querySelectorAll('button,a,.viewer-selection')).filter(function(control){var rect=control.getBoundingClientRect();return rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1;}).length;
    const mobileViewerCloseSingleLine = getComputedStyle(document.getElementById('viewer-close')).whiteSpace === 'nowrap';
    const mobileViewerStageRect = viewer.querySelector('.viewer-stage').getBoundingClientRect();
    const mobileViewerImageRect = document.getElementById('viewer-image').getBoundingClientRect();
    const mobileViewerHeader = viewer.querySelector('.viewer-header');
    const mobileViewerHeading = viewer.querySelector('.viewer-heading');
    const mobileViewerHeaderActions = viewer.querySelector('.viewer-header-actions');
    const mobileViewerHeaderRect = mobileViewerHeader.getBoundingClientRect();
    const mobileViewerHeadingRect = mobileViewerHeading.getBoundingClientRect();
    const mobileViewerHeaderActionsRect = mobileViewerHeaderActions.getBoundingClientRect();
    const mobileViewerHeaderStacked = getComputedStyle(mobileViewerHeader).flexDirection === 'column' && mobileViewerHeaderActionsRect.top >= mobileViewerHeadingRect.bottom;
    const mobileViewerHeadingFullWidth = mobileViewerHeadingRect.width >= mobileViewerHeaderRect.width - 22;
    const mobileViewerActionsFullWidth = mobileViewerHeaderActionsRect.width >= mobileViewerHeaderRect.width - 22;
    const mobileViewerTitle = document.getElementById('viewer-title');
    const mobileViewerMeta = document.getElementById('viewer-meta');
    const mobileViewerTitleClipped = mobileViewerTitle.scrollHeight > mobileViewerTitle.clientHeight + 1 || mobileViewerTitle.scrollWidth > mobileViewerTitle.clientWidth + 1;
    const mobileViewerMetadataClipped = mobileViewerMeta.scrollHeight > mobileViewerMeta.clientHeight + 1 || mobileViewerMeta.scrollWidth > mobileViewerMeta.clientWidth + 1;
    const mobileViewerImageObstructed = Array.from(viewer.querySelectorAll('.viewer-header,.viewer-footer')).some(function(element){var rect=element.getBoundingClientRect();return rect.left < mobileViewerImageRect.right && rect.right > mobileViewerImageRect.left && rect.top < mobileViewerImageRect.bottom && rect.bottom > mobileViewerImageRect.top;});
    mobileViewerSelect.checked = true;
    mobileViewerSelect.dispatchEvent(new Event('change', { bubbles:true }));
    mobileViewerClose.click();
    const mobileViewerBatchFocus = document.activeElement === document.getElementById('mobile-share-selected');
    const mobileViewerBatchFocusID = document.activeElement?.id || '';
    const mobileBatchRect = document.getElementById('library-batch-row').getBoundingClientRect();
    const mobileViewerBatchVisible = mobileBatchRect.bottom > 0 && mobileBatchRect.top < window.innerHeight;
    document.getElementById('clear-selection').click();
    return {viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,cardOverflow:Array.from(document.querySelectorAll('.library-card')).filter(function(card){var rect=card.getBoundingClientRect();return rect.left < -1 || rect.right > window.innerWidth + 1;}).length,toolbarOverflow:Array.from(document.querySelectorAll('.app-header button,.app-header input,.app-header select')).filter(function(control){var rect=control.getBoundingClientRect();return rect.left < -1 || rect.right > window.innerWidth + 1;}).length,mobileImportFits:mobileImportFits,mobileCardLayoutLabel:mobileCardLayoutLabel,mobileCardSizeAria:mobileCardSizeAria,obstructedImageCount:obstructedImageCount,compactTableHeaderStatic:compactTableHeaderStatic,compactTableSizeHidden:compactTableSizeHidden,mobileViewerVisible:mobileViewerVisible,mobileViewerMetadata:mobileViewerMetadata,mobileViewerSelectInitial:mobileViewerSelectInitial,mobileViewerCountInitial:mobileViewerCountInitial,mobileViewerCloseInitialText:mobileViewerCloseInitialText,mobileViewerSelectSynced:mobileViewerSelectSynced,mobileViewerCountAfterAdd:mobileViewerCountAfterAdd,mobileViewerFinishText:mobileViewerFinishText,mobileViewerCountAfterRemove:mobileViewerCountAfterRemove,mobileViewerCloseAfterRemove:mobileViewerCloseAfterRemove,mobileViewerBatchFocus:mobileViewerBatchFocus,mobileViewerBatchFocusID:mobileViewerBatchFocusID,mobileViewerBatchVisible:mobileViewerBatchVisible,mobileViewerInitialZoom:mobileViewerInitialZoom,mobileViewerActualZoom:mobileViewerActualZoom,mobileViewerActualWidth:mobileViewerActualWidth,mobileViewerActualScrollable:mobileViewerActualScrollable,mobileViewerFittedZoom:mobileViewerFittedZoom,mobileViewerFittedWidth:mobileViewerFittedWidth,mobileViewerControlOverflow:mobileViewerControlOverflow,mobileViewerCloseSingleLine:mobileViewerCloseSingleLine,mobileViewerStageHeight:Math.round(mobileViewerStageRect.height),mobileViewerHeaderStacked:mobileViewerHeaderStacked,mobileViewerHeadingFullWidth:mobileViewerHeadingFullWidth,mobileViewerActionsFullWidth:mobileViewerActionsFullWidth,mobileViewerTitleClipped:mobileViewerTitleClipped,mobileViewerMetadataClipped:mobileViewerMetadataClipped,mobileViewerImageObstructed:mobileViewerImageObstructed,filterPanelClosed:closed,filterPanelOpened:opened,headerPosition:headerPosition,headerHeight:headerHeight,mobileTableOffset:Math.round(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--library-header-height'))||0),firstCardTop:firstCardTop,compactHiddenActions:compactHiddenActions,revealedSelectionActions:revealedSelectionActions,mobileShareCountLabel:mobileShareCountLabel,mobileDeleteCountLabel:mobileDeleteCountLabel,revealedActionOverflow:revealedActionOverflow};
  })()`);
  assert.equal(mobileLibrary.viewport, 390, "mobile audit must use the requested CSS viewport");
  assert.equal(mobileInitialGuidance.text, "勾选图片后使用底部栏批量操作；导入无需选择", "mobile initial guidance must describe the touch workflow without Shift");
  assert.equal(mobileInitialGuidance.isDefault, "true", "mobile initial guidance must remain replaceable until a real action reports feedback");
  assert.ok(mobileInitialGuidance.inputTitles.every((title) => title.includes("底部栏") && !title.includes("Shift")), "mobile selection input titles must describe the bottom batch dock without desktop Shift guidance");
  assert.ok(mobileInitialGuidance.inputAria.every((label) => label.includes("底部栏") && !label.includes("Shift")), "mobile selection accessible names must describe the bottom batch dock without desktop Shift guidance");
  assert.ok(mobileInitialGuidance.cardTitles.every((title) => title.includes("底部栏") && !title.includes("Shift")), "mobile card selection labels must describe the bottom batch dock without desktop Shift guidance");
  assert.ok(mobileLibrary.documentWidth <= mobileLibrary.viewport, `mobile global library overflows horizontally: ${mobileLibrary.documentWidth}px > ${mobileLibrary.viewport}px`);
  assert.equal(mobileLibrary.cardOverflow, 0, "mobile global-library cards must stay inside the viewport");
  assert.equal(mobileLibrary.toolbarOverflow, 0, "mobile global-library controls must stay inside the viewport");
  assert.equal(mobileLibrary.mobileImportFits, true, "mobile import action must expose its complete label without clipping");
  assert.equal(mobileFilterDisclosure.text, "热图／矩阵图 等 2 项", "mobile collapsed filters must expose the active category and total condition count");
  assert.ok(mobileFilterDisclosure.title.includes("热图／矩阵图") && mobileFilterDisclosure.title.includes("可定位本机文献"), "mobile collapsed filter tooltip must retain every active condition");
  assert.equal(mobileFilterDisclosure.aria, mobileFilterDisclosure.title, "mobile collapsed filters must announce the complete condition list accessibly");
  assert.equal(mobileFilterDisclosure.selectLabel, "全选当前 1 张", "mobile filtered selection must expose the exact current-result count");
  assert.equal(mobileFilterDisclosure.overlap, false, "mobile collapsed filter value must not overlap its heading or disclosure action");
  assert.equal(mobileTable.horizontalOverflow, 0, "mobile metadata table must fit without horizontal scrolling");
  assert.deepEqual(mobileTable.visibleHeaders, ["选择", "预览", "论文", "来源"], "mobile metadata table must retain the four workflow columns");
  assert.equal(mobileTable.hiddenHeaderCount, 6, "mobile metadata table must fold six secondary columns, including the description column, into paper facts");
  assert.equal(mobileTable.factsVisible, 8, "mobile metadata table must show compact facts for every image");
  assert.equal(mobileTable.factsComplete, true, "mobile compact facts must preserve category, year, page, size, and source context");
  assert.equal(mobileTable.sourceActionCount, 8, "mobile metadata table must retain every source action");
  assert.equal(mobileTable.selectionCount, 8, "mobile metadata table must retain every batch-selection checkbox");
  assert.equal(mobileTable.titleActionCount, 8, "mobile metadata table must keep every paper title as a full-image viewer action");
  assert.equal(mobileTable.titleActionOverflow, 0, "mobile table title actions must remain inside their paper cells");
  assert.ok(mobileTable.previewWidth >= 64, "mobile metadata table previews must remain recognizable");
  assert.equal(mobileTable.rowOverflow, 0, "mobile metadata rows must stay inside the table viewport");
  assert.equal(mobileLibrary.mobileCardLayoutLabel, "每行最多 1 张", "mobile image-size control must report its actual one-column capacity");
  assert.ok(mobileLibrary.mobileCardSizeAria.includes("窄窗口会自动缩小") && mobileLibrary.mobileCardSizeAria.includes(mobileLibrary.mobileCardLayoutLabel), "mobile image-size control must explain responsive shrinking accessibly");
  assert.equal(mobileLibrary.obstructedImageCount, 0, "mobile gallery controls and metadata must never cover the original image");
  assert.equal(mobileLibrary.compactTableHeaderStatic, true, "compact horizontally scrolling table headings must stay in normal flow");
  assert.equal(mobileLibrary.compactTableSizeHidden, true, "compact table mode must hide the gallery-only image-width control");
  assert.equal(mobileLibrary.mobileViewerVisible, true, "mobile full-image viewer must open from the image card");
  assert.ok(/[\u3400-\u9fff]/.test(mobileLibrary.mobileViewerMetadata), "mobile full-image viewer metadata must remain Chinese and visible");
  assert.equal(mobileLibrary.mobileViewerSelectInitial, true, "mobile full-image selection must start from the current image state");
  assert.equal(mobileLibrary.mobileViewerCountInitial, "0", "mobile full-image viewer must expose the initial total selection count");
  assert.equal(mobileLibrary.mobileViewerCloseInitialText, "关闭", "mobile full-image viewer must start with a plain close action");
  assert.equal(mobileLibrary.mobileViewerSelectSynced, true, "mobile full-image selection must synchronize the image card");
  assert.equal(mobileLibrary.mobileViewerCountAfterAdd, "1", "mobile full-image viewer count must update after selection");
  assert.equal(mobileLibrary.mobileViewerFinishText, "完成选择", "mobile full-image viewer must expose selection completion");
  assert.equal(mobileLibrary.mobileViewerCountAfterRemove, "0", "mobile full-image viewer count must update after deselection");
  assert.equal(mobileLibrary.mobileViewerCloseAfterRemove, "关闭", "mobile full-image viewer must restore plain close after deselection");
  assert.equal(mobileLibrary.mobileViewerBatchFocus, true, `mobile selection completion must focus the bottom dock share action, not the desktop batch row: focused ${mobileLibrary.mobileViewerBatchFocusID || "nothing"}`);
  assert.equal(mobileLibrary.mobileViewerBatchVisible, true, "mobile selection completion must reveal the batch action row");
  assert.equal(mobileLibrary.mobileViewerInitialZoom, "适应窗口", "mobile full-image viewer must initially show the complete image");
  assert.equal(mobileLibrary.mobileViewerActualZoom, "100%", "mobile 1:1 action must expose original-pixel scale");
  assert.equal(mobileLibrary.mobileViewerActualWidth, 1200, "mobile 1:1 action must retain the original image pixel width");
  assert.equal(mobileLibrary.mobileViewerActualScrollable, true, "mobile original-pixel view must be scrollable");
  assert.equal(mobileLibrary.mobileViewerFittedZoom, "适应窗口", "mobile fit action must restore the complete image");
  assert.ok(mobileLibrary.mobileViewerFittedWidth < mobileLibrary.mobileViewerActualWidth, "mobile fit action must reduce a large original to the available width");
  assert.equal(mobileLibrary.mobileViewerControlOverflow, 0, "mobile full-image viewer controls must stay inside the viewport");
  assert.equal(mobileLibrary.mobileViewerCloseSingleLine, true, "mobile full-image Close label must stay on one line");
  assert.equal(mobileLibrary.mobileViewerHeaderStacked, true, "mobile full-image viewer must place facts and actions on separate rows");
  assert.equal(mobileLibrary.mobileViewerHeadingFullWidth, true, "mobile full-image viewer facts must receive the complete header width");
  assert.equal(mobileLibrary.mobileViewerActionsFullWidth, true, "mobile full-image viewer batch actions must receive a stable full-width row");
  assert.equal(mobileLibrary.mobileViewerTitleClipped, false, "mobile full-image viewer title must remain fully readable");
  assert.equal(mobileLibrary.mobileViewerMetadataClipped, false, "mobile full-image viewer facts must remain fully readable");
  assert.ok(mobileLibrary.mobileViewerStageHeight >= 500, `mobile full-image viewer leaves too little image space: ${mobileLibrary.mobileViewerStageHeight}px`);
  assert.equal(mobileLibrary.mobileViewerImageObstructed, false, "mobile full-image viewer chrome must not cover image pixels");
  assert.equal(mobileLibrary.filterPanelClosed, true, "mobile global-library filters must start collapsed when no filter is active");
  assert.equal(mobileLibrary.filterPanelOpened, true, "mobile filter disclosure must open its selectable controls with one tap");
  assert.equal(mobileLibrary.headerPosition, "static", "mobile global-library header must scroll away instead of covering images");
  assert.equal(mobileLibrary.mobileTableOffset, 0, "mobile table header must not reserve space for the non-sticky page header");
  assert.ok(mobileLibrary.headerHeight <= 320, `mobile global-library compact header is too tall: ${mobileLibrary.headerHeight}px`);
  assert.ok(mobileLibrary.firstCardTop <= 360, `mobile global-library first image starts too low: ${mobileLibrary.firstCardTop}px`);
  assert.equal(mobileLibrary.compactHiddenActions, 4, "mobile batch row must hide unavailable selection actions until an image is selected");
  assert.equal(mobileLibrary.revealedSelectionActions, 4, "mobile batch row must reveal every selected-image action after selection");
  assert.equal(mobileLibrary.mobileShareCountLabel, "分享 1 张", "mobile share action must display its selected count");
  assert.equal(mobileLibrary.mobileDeleteCountLabel, "删除 1 张", "mobile delete action must display its selected count");
  assert.equal(mobileLibrary.revealedActionOverflow, 0, "mobile selected-image actions must stay inside the viewport");
  if (screenshotDirectory) {
    await evaluate(client, `(() => { const category=document.getElementById('library-category'); const source=document.getElementById('library-source'); const panel=document.getElementById('library-filter-panel'); category.value='heatmap'; category.dispatchEvent(new Event('change',{bubbles:true})); source.value='linked'; source.dispatchEvent(new Event('change',{bubbles:true})); panel.open=false; window.scrollTo(0,0); return new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});}); })()`);
    const mobileFilterScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-filter-mobile.png"), Buffer.from(mobileFilterScreenshot.data, "base64"));
    await evaluate(client, `document.getElementById('library-reset')?.click(); document.getElementById('library-filter-panel').open=false`);
    await evaluate(client, `document.getElementById('library-view-table')?.click(); window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const mobileTableScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-table-mobile.png"), Buffer.from(mobileTableScreenshot.data, "base64"));
    await evaluate(client, `document.getElementById('library-view-gallery')?.click()`);
    await evaluate(client, `window.scrollTo(0,0); new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});})`);
    const mobileGalleryScreenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-gallery-mobile.png"), Buffer.from(mobileGalleryScreenshot.data, "base64"));
    await evaluate(client, `document.querySelector('.library-card:not([hidden]) [data-open-image]')?.click()`);
    await waitFor(async () => evaluate(client, `(() => { const viewer=document.getElementById('library-viewer'); const image=document.getElementById('viewer-image'); return !viewer?.hidden && image?.complete && image?.naturalWidth > 0; })()`));
    await evaluate(client, `(() => { const input=document.getElementById('viewer-select'); input.checked=true; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "library-viewer-mobile.png"), Buffer.from(screenshot.data, "base64"));
    await evaluate(client, `(() => { const input=document.getElementById('viewer-select'); input.checked=false; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await evaluate(client, `document.getElementById('viewer-close')?.click()`);
  }
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>阅读器交互审计</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#EEF2F7;font:14px system-ui,sans-serif;color:#0F172A}#audit-toolbar{height:48px;display:flex;align-items:center;justify-content:flex-end;padding:0 20px;border-bottom:1px solid #CBD5E1;background:#FFF;box-sizing:border-box;overflow:visible}.page{position:relative;width:1080px;height:720px;margin:44px auto;background:#FFF;box-shadow:0 2px 12px rgba(15,23,42,.16);overflow:hidden}.page canvas{display:block;width:100%;height:100%}</style></head><body><div id="audit-toolbar"></div><div class="page" data-page-number="1"><canvas width="1080" height="720"></canvas></div></body></html>`) });
  await waitFor(async () => evaluate(client, "document.readyState === 'complete'"));
  await evaluate(client, `(() => {
    globalThis.Zotero={Prefs:{values:Object.create(null),get:function(key){return this.values[key]},set:function(key,value){this.values[key]=value}},debug:function(){},logError:function(error){console.error(error)},Promise:{delay:function(){return Promise.resolve()}},Reader:{},Libraries:{userLibraryID:1,get:function(){return null}},Utilities:{randomString:function(){return 'AUDIT01'}}};
    globalThis.Services={prompt:{alert:function(){},confirm:function(){return false}},env:{get:function(){return ''}},appinfo:{OS:'WINNT'}};
    globalThis.IOUtils={}; globalThis.PathUtils={tempDir:'C:/Temp',join:function(){return Array.from(arguments).filter(Boolean).join('/')}};
  })()`);
  await evaluate(client, `(0,eval)(${JSON.stringify(mainSource)})`);
  const readerSetup = await evaluate(client, `(() => {
    const page=document.querySelector('.page'); const canvas=page.querySelector('canvas'); const ctx=canvas.getContext('2d');
    ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,1080,720);ctx.fillStyle='#0F172A';ctx.font='600 28px system-ui';ctx.fillText('科研图像框选预览',52,60);ctx.font='16px system-ui';ctx.fillStyle='#64748B';ctx.fillText('固定视口 CDP 证据，不读取或截取用户桌面',52,90);
    const colors=['#DCFCE7','#BBF7D0','#86EFAC','#4ADE80','#22C55E','#16A34A'];for(let row=0;row<5;row++){for(let col=0;col<8;col++){ctx.fillStyle=colors[(row+col)%colors.length];ctx.fillRect(95+col*105,150+row*82,82,58);ctx.fillStyle='#0F172A';ctx.font='13px system-ui';ctx.fillText(String((row+1)*(col+2)),126+col*105,184+row*82)}}
    ctx.strokeStyle='#CBD5E1';ctx.lineWidth=2;ctx.strokeRect(70,125,900,450);ctx.fillStyle='#0F172A';ctx.font='600 18px system-ui';ctx.fillText('图 3  模型性能热图与结果比较',70,620);
    const pdfPage={imageCoordinates:[],render:function(){}};const app={pdfViewer:{currentPageNumber:1,getPageView:function(){return {div:page,pdfPage:pdfPage}}}};
    const view={_iframeWindow:{document:document},_tool:{type:'pointer'},getActionAtPosition:function(){return {action:{type:'selectText'},selectAnnotations:[]}}};
    const reader={type:'pdf',_iframeWindow:{document:document,PDFViewerApplication:app},_internalReader:{_primaryView:view}};
    const toolbar=document.getElementById('audit-toolbar');PdfImageSaver.__test__.onRenderToolbar({reader:reader,doc:document,append:function(element){toolbar.appendChild(element)}});
    window.__readerAudit={reader:reader,page:page,canvas:canvas,view:view};
    const group=document.getElementById('pdf-image-saver-toolbar-group');return {group:!!group,tool:view._tool.type,labels:Array.from(group?.querySelectorAll(':scope > .pdf-image-saver-toolbar-button')||[]).map(function(button){return button.textContent})};
  })()`);
  assert.equal(readerSetup.group, true, "reader CDP fixture must render the real toolbar implementation");
  assert.equal(readerSetup.tool, "pointer", "reader fixture must start with Zotero pointer tool");
  await waitFor(async () => evaluate(client, `document.getElementById('pdf-image-saver-clip-button')?.textContent === '框选保存'`));
  readerSetup.labels = await evaluate(client, `Array.from(document.querySelectorAll('#pdf-image-saver-toolbar-group > .pdf-image-saver-toolbar-button')).map(function(button){return button.textContent;})`);
  assert.deepEqual(readerSetup.labels, ["框选保存", "本篇图片", "全部图库"], "reader toolbar must retain clip, current-paper, and cross-paper actions in workflow order");
  const toolbarDynamicLabelFit = await evaluate(client, `(() => {
    const cases={
      'pdf-image-saver-clip-button':['请框选','等待确认','保存中…','整页待确认','整页保存中','整页生成中','原图处理中'],
    };
    return Object.entries(cases).flatMap(function(entry){
      const button=document.getElementById(entry[0]);const original=button.textContent;
      const results=entry[1].map(function(label){button.textContent=label;return {id:entry[0],label:label,fits:button.scrollWidth<=button.clientWidth};});
      button.textContent=original;return results;
    });
  })()`);
  assert.deepEqual(toolbarDynamicLabelFit.filter((entry) => !entry.fits), [], "every reader toolbar workflow-state label must fit its stable button width");
  // The capture tier is fixed, so the toolbar slot is a statement of the current mode rather than
  // a menu: assert there is nothing left to open.
  const qualitySlot = await evaluate(client, `(() => {
    const slot=document.querySelector('.pdf-image-saver-toolbar-quality-choice');
    return { text: slot?.textContent || '', menu: !!slot?.querySelector('.pdf-image-saver-toolbar-choice-trigger'), items: slot?.querySelectorAll('.pdf-image-saver-toolbar-choice-item').length || 0 };
  })()`);
  assert.equal(qualitySlot.menu, false, "the fixed capture mode must not render a quality menu trigger");
  assert.equal(qualitySlot.items, 0, "the fixed capture mode must not render any quality option");
  assert.ok(qualitySlot.text.includes("矢量优先"), "the toolbar must state that capture is vector first");

  const readerInteraction = await evaluate(client, `(() => {
        const audit=window.__readerAudit;PdfImageSaver.__test__.installSelectionOverlay(audit.reader,document,audit.page,audit.canvas,'high',0,{});
    const rect=audit.page.getBoundingClientRect();window.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:12,clientX:rect.left+120,clientY:rect.top+130}));window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,button:0,pointerId:12,clientX:rect.left+760,clientY:rect.top+560}));
    const box=document.querySelector('.pdf-image-saver-selection-box');const top=document.querySelector('.pdf-image-saver-selection-dim-top');const style=getComputedStyle(box);
    return {menuHidden:true,left:box.style.left,top:box.style.top,width:box.style.width,height:box.style.height,borderStyle:style.borderStyle,borderColor:style.borderColor,borderWidth:style.borderWidth,dimHeight:top.style.height,overlayConnected:document.getElementById('pdf-image-saver-selection-overlay')?.isConnected===true,tool:audit.view._tool.type};
  })()`);
      assert.equal(readerInteraction.width, "640px", "reader clip boundary must follow horizontal pointer movement");
  assert.equal(readerInteraction.height, "430px", "reader clip boundary must follow vertical pointer movement");
  assert.equal(readerInteraction.borderStyle, "dashed", "reader clip boundary must remain dashed");
  assert.equal(readerInteraction.borderColor, "rgb(22, 163, 74)", "reader clip boundary must use SimpleExperiment success green");
  assert.equal(readerInteraction.borderWidth, "2px", "reader clip boundary must remain clearly visible");
  assert.equal(readerInteraction.dimHeight, "130px", "reader dimming must update around the live selection");
  assert.equal(readerInteraction.overlayConnected, true, "reader selection overlay must remain mounted during the drag");
  assert.equal(readerInteraction.tool, "pointer", "reader clipping must not switch Zotero to its hand-drag tool");
  if (screenshotDirectory) {
    const clipScreenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "reader-live-clip.png"), Buffer.from(clipScreenshot.data, "base64"));
  }
  await evaluate(client, `window.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,button:2}))`);
  const reviewState = await evaluate(client, `(() => {
    const audit=window.__readerAudit;
    const preview={dataURL:audit.canvas.toDataURL('image/png'),pageNumber:1,quality:'high',detector:'pdfjs_record_images',byteCount:184320,renderedWidth:960,renderedHeight:640,imageCategory:'heatmap',styleTags:['matrix','result'],palette:[]};
    window.__readerReviewPromise=PdfImageSaver.__test__.showPreviewReviewDialog(document,preview,{scope:'clip',suggested:'heatmap',initialCategory:'heatmap',evidence:{caption:'图 3 模型性能热图与结果比较'}});
    window.__readerReviewPreview=preview;
    const dialog=document.getElementById('pdf-image-saver-preview-review-dialog');const category=document.getElementById('pdf-image-saver-review-category');const role=document.getElementById('pdf-image-saver-review-role');
    const stop=dialog?.querySelector('.pdf-image-saver-preview-review-stop');const cancel=dialog?.querySelector('.pdf-image-saver-preview-review-cancel');const confirm=dialog?.querySelector('.pdf-image-saver-preview-review-confirm');
    return {dialog:!!dialog,qualitySelectPresent:!!document.getElementById('pdf-image-saver-review-quality'),categoryLabel:category?.getAttribute('aria-label')||'',categoryValue:category?.value||'',categoryOptions:Array.from(category?.options||[]).map(function(option){return option.value}),roleValue:role?.value||'',suggestionText:dialog?.querySelector('.pdf-image-saver-preview-review-suggestion')?.textContent||'',fieldHelp:dialog?.querySelector('.pdf-image-saver-preview-review-field-help')?.textContent||'',describedBy:dialog?.getAttribute('aria-describedby')||'',activeID:document.activeElement?.id||'',stopText:stop?.textContent||'',stopTitle:stop?.title||'',cancelText:cancel?.textContent||'',cancelTitle:cancel?.title||'',confirmText:confirm?.textContent||'',confirmTitle:confirm?.title||''};
  })()`);
  assert.equal(reviewState.dialog, true, "reader CDP fixture must render the real preview review dialog");
  assert.equal(reviewState.qualitySelectPresent, false, "the capture tier is fixed, so the review dialog must not offer a quality menu");
  assert.equal(reviewState.categoryLabel, "保存类别（必选）", "review dialog must name the concrete category decision clearly");
  assert.equal(reviewState.categoryValue, "heatmap", "review dialog must default to the detected concrete category");
  assert.equal(reviewState.categoryOptions.includes("auto"), false, "review dialog must not offer an unresolved automatic saved category");
  assert.ok(reviewState.categoryOptions.length >= 10, "review dialog must retain the complete concrete research-category set");
  assert.equal(reviewState.roleValue, "auto", "review dialog must retain automatic PPT-use inference");
  assert.equal(reviewState.suggestionText, "识别建议：热图／矩阵图。", "automatic review must present one concise inferred category");
  assert.equal(reviewState.fieldHelp, "类别用于图库筛选；PPT 用途用于插入与叙事建议；自定义描述会随图片保存，并可在图库中继续修改。", "review dialog must explain the distinct effect of all three editable decisions, including where the description can be edited later");
  assert.ok(reviewState.describedBy.includes("pdf-image-saver-preview-review-field-help"), "review dialog accessibility description must include the field-effect explanation");
  assert.equal(reviewState.activeID, "pdf-image-saver-review-category", "review dialog must focus the concrete category decision first");
  assert.equal(reviewState.cancelText, "取消", "reader review must expose a concise cancellation action");
  assert.equal(reviewState.cancelTitle, "不保存当前框选图片", "reader review cancellation must name its discarded scope");
  assert.equal(reviewState.stopText, "", "clip review must not expose a queue-stop action");
  assert.equal(reviewState.stopTitle, "", "clip review must not expose a queue-stop tooltip");
  assert.equal(reviewState.confirmText, "确认并保存", "reader review must explain the clip save action");
  assert.equal(reviewState.confirmTitle, "使用当前类别、PPT 用途和自定义描述保存图片", "reader review save tooltip must explain its saved metadata");
  await waitFor(async () => evaluate(client, `(() => { const image=document.querySelector('.pdf-image-saver-preview-review-image'); return !!image?.complete && image.naturalWidth > 0; })()`));
  const reviewLayout = await evaluate(client, `(() => { const dialog=document.getElementById('pdf-image-saver-preview-review-dialog');const panel=dialog.querySelector('.pdf-image-saver-preview-review-panel');const image=dialog.querySelector('.pdf-image-saver-preview-review-image');const actions=dialog.querySelector('.pdf-image-saver-preview-review-actions');const panelRect=panel.getBoundingClientRect();const imageRect=image.getBoundingClientRect();const actionRect=actions.getBoundingClientRect();return {panelTop:panelRect.top,panelBottom:panelRect.bottom,panelClientWidth:panel.clientWidth,panelScrollWidth:panel.scrollWidth,imageWidth:imageRect.width,imageHeight:imageRect.height,actionsTop:actionRect.top,actionsBottom:actionRect.bottom,viewportHeight:innerHeight}; })()`);
  assert.ok(reviewLayout.panelTop >= 0 && reviewLayout.panelBottom <= reviewLayout.viewportHeight, "review panel must fit inside the fixed desktop viewport");
  assert.equal(reviewLayout.panelScrollWidth, reviewLayout.panelClientWidth, "review panel must not require horizontal scrolling");
  assert.ok(reviewLayout.imageWidth >= 480 && reviewLayout.imageHeight >= 300, "review image must remain large enough for visual confirmation");
  assert.ok(reviewLayout.actionsTop > reviewLayout.panelTop && reviewLayout.actionsBottom <= reviewLayout.viewportHeight, "review decision actions must remain visible below the image");
  if (screenshotDirectory) {
    const reviewScreenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "reader-review-dialog.png"), Buffer.from(reviewScreenshot.data, "base64"));
  }
  const reviewResult = await evaluate(client, `(async () => {
    const category=document.getElementById('pdf-image-saver-review-category');const role=document.getElementById('pdf-image-saver-review-role');category.value='table';category.dispatchEvent(new Event('change',{bubbles:true}));role.value='compare';document.querySelector('.pdf-image-saver-preview-review-confirm').click();const result=await window.__readerReviewPromise;return {category:result?.imageCategory||'',role:result?.roleHint||'',dialogRemoved:!document.getElementById('pdf-image-saver-preview-review-dialog')};
  })()`);
  assert.deepEqual(reviewResult, { category: "table", role: "compare", dialogRemoved: true }, "review confirmation must persist changed concrete metadata and close the dialog");
  const prefillReviewState = await evaluate(client, `(() => {
    const preview={...window.__readerReviewPreview,imageCategory:'table',detector:'manual_selection'};window.__prefillReviewPromise=PdfImageSaver.__test__.showPreviewReviewDialog(document,preview,{scope:'clip',requestedCategory:'table',suggested:'heatmap',initialCategory:'table'});const dialog=document.getElementById('pdf-image-saver-preview-review-dialog');return {category:document.getElementById('pdf-image-saver-review-category')?.value||'',suggestion:dialog?.querySelector('.pdf-image-saver-preview-review-suggestion')?.textContent||'',detector:dialog?.querySelector('.pdf-image-saver-preview-review-meta')?.textContent||''};
  })()`);
  assert.deepEqual(prefillReviewState, { category: "table", suggestion: "设置预填：科研表格；识别建议：热图／矩阵图。", detector: "第 1 页 · 手动框选 · 960 × 640 像素 · 预览清晰度：高 · 180 KB" }, "review dialog must explain why a concrete setting and visual inference differ without mislabeling the capture source");
  if (screenshotDirectory) {
    const prefillScreenshot = await captureFixedViewportScreenshot(client);
    fs.writeFileSync(path.join(screenshotDirectory, "reader-review-prefill.png"), Buffer.from(prefillScreenshot.data, "base64"));
  }
  const prefillReviewCleanup = await evaluate(client, `(async () => { document.querySelector('.pdf-image-saver-preview-review-cancel')?.click();const result=await window.__prefillReviewPromise;return {cancelled:result===null,dialogRemoved:!document.getElementById('pdf-image-saver-preview-review-dialog')}; })()`);
  assert.deepEqual(prefillReviewCleanup, { cancelled: true, dialogRemoved: true }, "prefilled review cancellation must remain non-destructive");
  const readerShutdownCleanup = await evaluate(client, `(() => {
    const audit=window.__readerAudit;
    PdfImageSaver.__test__.installSelectionOverlay(audit.reader,document,audit.page,audit.canvas,'high',0,{});
    PdfImageSaver.__test__.showPreviewReviewDialog(document,window.__readerReviewPreview,{scope:'clip',suggested:'heatmap',initialCategory:'heatmap'});
    PdfImageSaver.__test__.showReaderToast(audit.reader,'正在退出 Zotero…','progress');
    PdfImageSaver.__test__.disposeReaderUI(audit.reader);
    return {
      overlayRemoved:!document.getElementById('pdf-image-saver-selection-overlay'),
      dialogRemoved:!document.getElementById('pdf-image-saver-preview-review-dialog'),
      toastRemoved:!document.getElementById('pdf-image-saver-toast'),
      toolbarRemoved:!document.getElementById('pdf-image-saver-toolbar-group'),
      cursorRestored:audit.page.style.cursor==='',
      textSelectionRestored:audit.view.getActionAtPosition().action.type==='selectText'
    };
  })()`);
  assert.deepEqual(readerShutdownCleanup, {
    overlayRemoved: true,
    dialogRemoved: true,
    toastRemoved: true,
    toolbarRemoved: true,
    cursorRestored: true,
    textSelectionRestored: true,
  }, "Zotero shutdown must remove every reader overlay, dialog, toast, and toolbar before chrome teardown");
  const noReaderHelperProbe = await evaluate(client, `(async () => { const report={warnings:['未打开 PDF 阅读器。']};const status=await PdfImageSaver.__test__.probeOptionalHelperAvailability(report,async()=>[{command:'C:/Users/ZLK/.conda/envs/zlk/python.exe',args:[]}]);return {status:status,warnings:report.warnings}; })()`);
  assert.deepEqual(noReaderHelperProbe, { status: "python-available", warnings: ["未打开 PDF 阅读器。"] }, "Tools diagnostics must report available optional Python without requiring an open PDF");
  await client.send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>PDF 图片保存</title><style>html,body{margin:0;min-height:100%;background:#EEF2F7;color:#0F172A;font:14px system-ui,sans-serif}body{padding:28px;box-sizing:border-box}#pdf-image-saver-preferences{display:block;max-width:900px;margin:auto;padding:20px;border:1px solid #CBD5E1;border-radius:8px;background:#FFF}h1{margin:0 0 6px;font-size:20px}.audit-note{margin:0 0 18px;color:#64748B}.pdf-image-saver-prefs-save-notice{display:inline-block;margin-left:8px;color:#16A34A}</style></head><body><main id="pdf-image-saver-preferences"><h1>PDF 图片保存</h1><p class="audit-note">框选保存是主流程；自动识别可选；高级原图提取收在下方。每次打开都会重新读取当前设置并修复异常值。<span id="pdf-image-saver-prefs-save-notice" class="pdf-image-saver-prefs-save-notice" role="status" aria-live="polite">设置修改后自动保存，无需另点确认。</span></p><section class="pdf-image-saver-prefs-section"><h2 class="pdf-image-saver-prefs-section-title">采集方式</h2><div class="pdf-image-saver-prefs-list"><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-default-quality">默认预览质量</label><select id="pdf-image-saver-default-quality"><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select><p>未知旧值恢复为推荐的中清晰度。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-default-category">默认图片类别</label><select id="pdf-image-saver-default-category"><option value="auto">自动判断</option><option value="heatmap">热图／矩阵图</option><option value="table">科研表格</option></select><p>未知旧值恢复为自动判断。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-duplicate-guard">避免重复保存</label><span><input id="pdf-image-saver-duplicate-guard" type="checkbox"> 同时检查本次会话和已保存内容</span><p>旧版 false 字符串保持关闭，而不是被误判为开启。</p></div></div></section><details class="pdf-image-saver-prefs-section pdf-image-saver-prefs-advanced" id="pdf-image-saver-prefs-helper-section" open><summary class="pdf-image-saver-prefs-section-title"><span>高级原图提取（可选）</span><span class="pdf-image-saver-prefs-summary-note">常规采集无需配置</span></summary><div class="pdf-image-saver-prefs-advanced-body"><div class="pdf-image-saver-prefs-list"><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-min-area">最小原图面积比例（占页面）</label><input id="pdf-image-saver-min-area" type="number" step="0.001" min="0.001" max="0.5"><p>留空恢复默认值 0.004。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-max-page-images">每页最多原图数</label><input id="pdf-image-saver-max-page-images" type="number" min="1" max="500"><p>超过上限时按 500 张保存。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-max-document-images">每篇最多原图数</label><input id="pdf-image-saver-max-document-images" type="number" min="1" max="2000"><p>非整数会显示并保存最接近的整数。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-helper-timeout">超时（秒）</label><input id="pdf-image-saver-helper-timeout" type="number" min="5" max="600"><p>低于下限时恢复为 5 秒。</p></div><div class="pdf-image-saver-prefs-row"><label for="pdf-image-saver-python-path">Python 路径（高级）</label><div class="pdf-image-saver-prefs-python-picker"><input id="pdf-image-saver-python-path" type="text" placeholder="留空：自动查找 Python"><button id="pdf-image-saver-python-browse" type="button" title="打开文件资源管理器，选择 python.exe">选择 python.exe…</button></div><p>常规功能无需填写。</p></div></div></div></details></main></body></html>`) });
  await waitFor(async () => evaluate(client, "document.readyState === 'complete'"));
  await evaluate(client, `(() => { document.getElementById('pdf-image-saver-prefs-save-notice').className='pdf-image-saver-prefs-save-notice'; document.querySelector('.audit-note')?.replaceChildren(document.createTextNode('框选保存是唯一常规采集方式；高级原图提取收在下方。每次打开都会重新读取当前设置并修复异常值。'),document.getElementById('pdf-image-saver-prefs-save-notice')); })()`);
  await evaluate(client, `(() => { globalThis.Zotero={Prefs:{values:{'extensions.pdfImageSaver.defaultQuality':'ultra','extensions.pdfImageSaver.defaultImageCategory':'medical_scan','extensions.pdfImageSaver.duplicateGuard':'false','extensions.pdfImageSaver.minImageArea':'','extensions.pdfImageSaver.maxPageImages':999,'extensions.pdfImageSaver.maxDocumentImages':2.7,'extensions.pdfImageSaver.helperTimeoutSeconds':1,'extensions.pdfImageSaver.pythonPath':''},writes:[],reads:[],globalWrites:[],get:function(key,global){this.reads.push({key:key,global:global});return this.values[key]},set:function(key,value,global){this.values[key]=value;this.writes.push({key:key,value:value});this.globalWrites.push(global)}}}; })()`);
  await evaluate(client, `(0,eval)(${JSON.stringify(preferencesSource)})`);
  const readPreferenceControls = `{quality:document.getElementById('pdf-image-saver-default-quality').value,category:document.getElementById('pdf-image-saver-default-category').value,duplicate:document.getElementById('pdf-image-saver-duplicate-guard').checked,area:document.getElementById('pdf-image-saver-min-area').value,page:document.getElementById('pdf-image-saver-max-page-images').value,document:document.getElementById('pdf-image-saver-max-document-images').value,timeout:document.getElementById('pdf-image-saver-helper-timeout').value}`;
  const preferenceNormalization = await evaluate(client, `(() => {
    PdfImageSaverPreferences.init();return Object.assign(${readPreferenceControls},{writes:Zotero.Prefs.writes,reads:Zotero.Prefs.reads,globalWrites:Zotero.Prefs.globalWrites,notice:document.getElementById('pdf-image-saver-prefs-save-notice').textContent,noticeError:document.getElementById('pdf-image-saver-prefs-save-notice').classList.contains('is-error'),documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth});
  })()`);
  assert.equal(preferenceNormalization.quality, "medium", "loading an unknown quality must restore the documented default in a real DOM");
  assert.equal(preferenceNormalization.category, "auto", "loading an unknown category must restore automatic inference in a real DOM");
  assert.equal(preferenceNormalization.duplicate, false, "loading a legacy false string must keep duplicate protection disabled in a real DOM");
  assert.equal(preferenceNormalization.area, "0.004", "loading an empty numeric preference must visibly restore its default in a real DOM");
  assert.equal(preferenceNormalization.page, "500", "loading an out-of-range numeric preference must visibly clamp to its maximum in a real DOM");
  assert.equal(preferenceNormalization.document, "3", "loading a fractional integer preference must visibly round in a real DOM");
  assert.equal(preferenceNormalization.timeout, "5", "loading a below-minimum preference must visibly clamp to its minimum in a real DOM");
  assert.deepEqual(preferenceNormalization.writes.map((write) => write.value), ["medium", "auto", false, 0.004, 500, 3, 5], "loading stale preferences must persist only the normalized effective values shown to the user");
  assert.ok(preferenceNormalization.writes.every((write) => write.key.startsWith("extensions.pdfImageSaver.")), "preference writes must stay on the frozen extension branch");
  assert.ok(preferenceNormalization.reads.length >= 8 && preferenceNormalization.reads.every((read) => read.global === true), "preference DOM must read the canonical global extension branch");
  assert.ok(preferenceNormalization.globalWrites.length === 7 && preferenceNormalization.globalWrites.every((global) => global === true), "preference DOM must write the canonical global extension branch");
  assert.ok(preferenceNormalization.notice.startsWith("已修复上次遗留的异常设置并保存："), `repairing stale preferences must be stated instead of silently rewriting them: ${preferenceNormalization.notice}`);
  assert.ok(preferenceNormalization.notice.includes("等 7 项") && preferenceNormalization.notice.includes("当前显示的就是生效值"), "repair notice must name the repaired count and confirm the shown values are effective");
  assert.equal(preferenceNormalization.noticeError, false, "a successful preference load must not present itself as an error");
  assert.ok(preferenceNormalization.documentWidth <= preferenceNormalization.viewportWidth, "preference normalization fixture must not overflow horizontally");
  if (screenshotDirectory) {
    const preferenceScreenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "preferences-stale-values-normalized.png"), Buffer.from(preferenceScreenshot.data, "base64"));
  }
  const preferenceReopen = await evaluate(client, `(() => {
    Zotero.Prefs.writes.length=0;Object.assign(Zotero.Prefs.values,{'extensions.pdfImageSaver.defaultQuality':'high','extensions.pdfImageSaver.defaultImageCategory':'heatmap','extensions.pdfImageSaver.duplicateGuard':true,'extensions.pdfImageSaver.minImageArea':0.008,'extensions.pdfImageSaver.maxPageImages':22,'extensions.pdfImageSaver.maxDocumentImages':180,'extensions.pdfImageSaver.helperTimeoutSeconds':45});PdfImageSaverPreferences.init();return Object.assign(${readPreferenceControls},{writes:Zotero.Prefs.writes.length,notice:document.getElementById('pdf-image-saver-prefs-save-notice').textContent});
  })()`);
  const { notice: preferenceReopenNotice, ...preferenceReopenValues } = preferenceReopen;
  assert.deepEqual(preferenceReopenValues, {
    quality: "high",
    category: "heatmap",
    duplicate: true,
    area: "0.008",
    page: "22",
    document: "180",
    timeout: "45",
    writes: 0,
  }, "reopening an initialized preference pane must refresh valid values changed elsewhere without rewriting them");
  assert.equal(preferenceReopenNotice, "设置修改后自动保存，无需另点确认。", "reopening a pane whose values are all valid must restore the neutral auto-save notice");
  const preferenceClamp = await evaluate(client, `(() => {
    const control=document.getElementById('pdf-image-saver-max-page-images');control.value='4000';control.dispatchEvent(new Event('change',{bubbles:true}));
    const clamped={value:control.value,notice:document.getElementById('pdf-image-saver-prefs-save-notice').textContent};
    const timeout=document.getElementById('pdf-image-saver-helper-timeout');timeout.value='90';timeout.dispatchEvent(new Event('change',{bubbles:true}));
    return Object.assign(clamped,{acceptedValue:timeout.value,acceptedNotice:document.getElementById('pdf-image-saver-prefs-save-notice').textContent});
  })()`);
  assert.equal(preferenceClamp.value, "500", "an out-of-range typed preference must visibly settle on the enforced bound");
  assert.equal(preferenceClamp.notice, "已自动保存：每页最多原图数；输入的“4000”超出允许范围，已改为 500。", "clamping a typed preference must explain the change in native Chinese");
  assert.equal(preferenceClamp.acceptedValue, "90", "an in-range typed preference must be kept exactly");
  assert.equal(preferenceClamp.acceptedNotice, "已自动保存：高级原图提取超时。", "an unchanged in-range preference must not claim it was adjusted");
  const pickerFeedback = await evaluate(client, `(async () => {
    const originalFactory=PdfImageSaverPreferences.createNativeFilePicker;
    PdfImageSaverPreferences.createNativeFilePicker=function(){return null};
    await PdfImageSaverPreferences.choosePythonExecutable();
    const result={notice:document.getElementById('pdf-image-saver-prefs-save-notice').textContent,error:document.getElementById('pdf-image-saver-prefs-save-notice').classList.contains('is-error')};
    PdfImageSaverPreferences.createNativeFilePicker=originalFactory;
    return result;
  })()`);
  assert.deepEqual(pickerFeedback, {
    notice: "无法打开系统文件选择器；请手动粘贴 Python 解释器路径。",
    error: true,
  }, "an unavailable Python file chooser must explain the manual-path fallback");
  if (screenshotDirectory) {
    const reopenScreenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDirectory, "preferences-reopen-refresh.png"), Buffer.from(reopenScreenshot.data, "base64"));
  }
  const reopenListenerResult = await evaluate(client, `(() => { Zotero.Prefs.writes.length=0;const quality=document.getElementById('pdf-image-saver-default-quality');quality.value='low';quality.dispatchEvent(new Event('change',{bubbles:true}));return Zotero.Prefs.writes; })()`);
  assert.deepEqual(reopenListenerResult, [{ key: "extensions.pdfImageSaver.defaultQuality", value: "low" }], "reopening preferences must not duplicate change listeners");
  const browserExceptions = client.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
  assert.equal(browserExceptions.length, 0, "button audit must not produce browser exceptions");
  assert.equal(countPageTargets(), initialPageTargetCount, "no gallery or index action may open an extra browser tab; every large-image view must stay inside the page");
  console.log(`browser UI audit ok: ${single.buttonCount} saved-page buttons, ${multi.filterButtonCount} filters, ${library.cardCount} global-library images, ${library.buttonCount} library buttons, reader menu + live clip + review`);
} finally {
  client?.close();
  browser?.kill();
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Keep the isolated audit directory for recoverable inspection. A later
  // cleanup may move this exact directory to the Windows Recycle Bin.
}
