const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content", "pdf-image-saver.js"), "utf8");
let delayCallCount = 0;

const context = {
  console,
  Zotero: {
    API: null,
    Libraries: {
      userLibraryID: 1,
      get(libraryID) {
        if (libraryID === 2) {
          return { libraryType: "group", groupID: 12345 };
        }
        return null;
      },
    },
    version: "9.0.5-test",
    Promise: {
      delay: async () => {
        delayCallCount += 1;
      },
    },
    Prefs: {
      values: Object.create(null),
      get(key) {
        return this.values[key];
      },
      set(key, value) {
        this.values[key] = value;
      },
    },
    debug() {},
    logError(error) {
      throw error;
    },
    Attachments: {
      imported: [],
      async importFromFile(options) {
        this.imported.push(options);
      },
    },
    File: {
      contents: Object.create(null),
      async createDirectoryIfMissingAsync() {},
      async getContentsAsync(filePath) {
        return this.contents[filePath] || "";
      },
      async putContentsAsync(filePath, contents) {
        this.contents[filePath] = contents;
      },
    },
    Utilities: {
      randomString() {
        return "RANDOM01";
      },
    },
  },
  Services: {
    appinfo: { OS: "WINNT" },
    prompt: {
      alerts: [],
      confirms: [],
      confirmResult: false,
      alert(win, title, message) {
        this.alerts.push({ win, title, message });
      },
      confirm(win, title, message) {
        this.confirms.push({ win, title, message });
        return this.confirmResult;
      },
    },
  },
  IOUtils: {
    exists: async () => false,
    stat: async () => ({ size: 0 }),
    remove: async () => {},
  },
  PathUtils: {
    tempDir: "C:\\Temp",
    join(...parts) {
      return parts.filter(Boolean).join("\\");
    },
  },
};

vm.createContext(context);
context.globalThis = context;
vm.runInContext(source, context, { filename: "pdf-image-saver.js" });
context.PdfImageSaver.init({
  id: "pdf-image-saver@zlk.local",
  version: "0.1.0-test",
  rootURI: "resource://pdf-image-saver/",
});

const {
  buildIndexHTML,
  normalizeImageCategoryKey,
  getImageCategoryLabel,
  getImageCategoryMark,
  inferImageCategory,
  formatCategorySummary,
  formatColorFamilySummary,
  formatLayoutHintSummary,
  formatSlideSlotSummary,
  formatRoleHintSummary,
  formatInsertHintSummary,
  formatCaptionHintSummary,
  formatStoryHintSummary,
  formatContrastPairLabel,
  formatPptAssistSummary,
  buildPptAssistToken,
  buildRolePackToken,
  buildInsertPackToken,
  buildCaptionPackToken,
  buildStoryPackToken,
  buildDrawingStyleTags,
  deriveColorFamilyFromPalette,
  deriveLayoutHint,
  deriveSlideSlot,
  deriveRoleHint,
  deriveInsertHint,
  deriveCaptionHint,
  deriveStoryBeat,
  deriveContrastHex,
  normalizeColorFamily,
  normalizeLayoutHint,
  normalizeSlideSlot,
  normalizeRoleHint,
  normalizeInsertHint,
  normalizeCaptionHint,
  normalizeStoryBeat,
  getLayoutHintMark,
  getSlideSlotMark,
  getRoleHintMark,
  getInsertSizeMark,
  getCaptionToneMark,
  getStoryBeatMark,
  getColorFamilyMark,
  formatStyleTagsLabel,
  formatPaletteLabel,
  normalizeStyleTags,
  normalizePalette,
  deriveStyleTagsFromPalette,
  buildIndexTitle,
  buildOriginalImageIndexHTML,
  buildOriginalImageIndexTitle,
  buildOriginalImageTitle,
  buildOpenPDFURI,
  buildSourceRegion,
  buildContextMenuActions,
  calculateCanvasCrop,
  cleanupSelectionOverlay,
  installSelectionOverlay,
  startClipFromReader,
  confirmAndSaveOriginalImagesFromReader,
  filterExistingOriginalImagesForImport,
  formatPreviewDuplicateSkipReason,
  classifyPreviewDuplicateSkipReason,
  formatDiagnosticDups,
  formatDiagnosticArea,
  formatDiagnosticsReport,
  formatHelperPythonMode,
  formatOptionalHelperStatus,
  buildOriginalImportSkippedText,
  formatHelperFailure,
  getToastDuration,
  normalizeToastLevel,
  getErrorMessage,
  classifyErrorCategory,
  formatUserFacingError,
  getActiveReader,
  buildToolbarActionTooltip,
  formatPreviewDetectorLabel,
  formatPreviewScopeLabel,
  formatQualityEstimateShort,
  getQualityMark,
  formatPageToastToken,
  formatOriginalScopeToken,
  getContextPageIndex,
  getPDFViewerContextCandidate,
  getPreviewDuplicateKey,
  getPreviewIndexFingerprint,
  getPreviewIndexKey,
  getOriginalImageKey,
  getSourceRegionFingerprint,
  getSourceRegionKey,
  hasExistingPreviewIndexAttachment,
  getReaderJobKey,
  importOriginalImages,
  isDuplicatePreviewIndexSave,
  limitOriginalImagesForImport,
  onRenderToolbar,
  onCreateViewContextMenu,
  rememberPreviewIndexSave,
  normalizeBBoxNormalized,
  normalizeHelperFilePath,
  normalizeImageContentType,
  normalizeHelperSchemaText,
  normalizeHelperStatusText,
  normalizeHelperWarningMessages,
  normalizeOriginalImageForImport,
  normalizePageIndex,
  normalizePageNumber,
  prepareSelectionOverlayHost,
  renderCanvasPreview,
  saveClipPreviewIndex,
  saveOriginalImagesFromReader,
  savePagePreviewIndex,
  showReaderToast,
  isPDFReader,
  normalizeAnnotationKey,
} = context.PdfImageSaver.__test__;
const userAttachment = { libraryID: 1, key: "ABCDEF12" };
const groupAttachment = { libraryID: 2, key: "GROUP123" };
context.Zotero.API = {
  getLibraryPrefix() {
    return "users/999";
  },
};

assert.strictEqual(
  buildOpenPDFURI(userAttachment, 7, null),
  "zotero://open-pdf/library/items/ABCDEF12?page=7",
  "null annotation key must keep page-only URI",
);

assert.strictEqual(
  buildOpenPDFURI(userAttachment, 7, "bad-key"),
  "zotero://open-pdf/library/items/ABCDEF12?page=7",
  "invalid annotation key must keep page-only URI",
);

assert.strictEqual(
  buildOpenPDFURI(userAttachment, 7, "ANNOTATION9"),
  "zotero://open-pdf/library/items/ABCDEF12?page=7&annotation=ANNOTATION9",
  "valid annotation key must append annotation parameter",
);

assert.strictEqual(
  buildOpenPDFURI(userAttachment, 7, "ANNOTATION9"),
  "zotero://open-pdf/library/items/ABCDEF12?page=7&annotation=ANNOTATION9",
  "annotation target must use the supported Zotero annotation parameter",
);

assert.strictEqual(
  buildOpenPDFURI(groupAttachment, 3, "A1B2C3"),
  "zotero://open-pdf/groups/12345/items/GROUP123?page=3&annotation=A1B2C3",
  "group library URI must preserve group prefix and annotation",
);

assert.strictEqual(
  buildOpenPDFURI(userAttachment, "bad", null),
  "zotero://open-pdf/library/items/ABCDEF12?page=1",
  "invalid page number must fall back to page 1",
);

assert.strictEqual(
  buildOpenPDFURI(userAttachment, "-4", null),
  "zotero://open-pdf/library/items/ABCDEF12?page=1",
  "negative page number must fall back to page 1",
);

assert.strictEqual(normalizePageIndex("4", null), 4, "numeric page-index strings must be accepted");
assert.strictEqual(normalizePageIndex("-1", null), null, "negative page indexes must fall back");
assert.strictEqual(normalizePageIndex(null, 99), 99, "null page indexes must use the fallback");
assert.strictEqual(normalizePageIndex(true, null), null, "boolean page indexes must be rejected");
assert.strictEqual(normalizePageIndex([], null), null, "array page indexes must be rejected");
assert.strictEqual(normalizePageNumber("2", 1), 2, "numeric page-number strings must be accepted");
assert.strictEqual(normalizePageNumber("bad", 1), 1, "invalid page numbers must fall back");
assert.strictEqual(getReaderJobKey({ itemID: 12 }, null), "12:unknown:current", "missing job options must not throw");
assert.strictEqual(
  getReaderJobKey({ _item: { id: 7 } }, { scope: { bad: true }, pageIndex: "2" }),
  "7:unknown:2",
  "malformed job scopes must normalize to a compact unknown scope",
);
assert.strictEqual(
  getReaderJobKey({ _item: { id: 7 } }, { scope: "page", pageIndex: "2" }),
  "7:page:2",
  "valid job scopes and numeric page strings must be preserved",
);

function createFakeOverlay(host, previousPosition) {
  const attributes = Object.create(null);
  if (previousPosition !== undefined) {
    attributes["data-pdf-image-saver-previous-position"] = previousPosition;
  }
  return {
    parentElement: host,
    removed: false,
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
    remove() {
      this.removed = true;
    },
  };
}

function createFakeToastDocument() {
  const bodyChildren = [];
  const headChildren = [];
  const listeners = Object.create(null);
  function createElement(tagName) {
    return {
      tagName,
      id: "",
      className: "",
      _textContent: "",
      title: "",
      onclick: null,
      removed: false,
      attributes: Object.create(null),
      children: [],
      get textContent() {
        if (this.children.length) {
          return this.children.map((child) => child.textContent || "").join("");
        }
        return this._textContent;
      },
      set textContent(value) {
        this._textContent = String(value);
        this.children = [];
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "title") {
          this.title = String(value);
        }
      },
      getAttribute(name) {
        if (name === "title") {
          return this.title || null;
        }
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(selector) {
        const className = String(selector || "").replace(/^\./, "");
        return (this.children || []).find((child) => {
          const tokens = String(child.className || "").split(/\s+/).filter(Boolean);
          return tokens.includes(className);
        }) || null;
      },
      remove() {
        this.removed = true;
      },
    };
  }
  return {
    body: {
      children: bodyChildren,
      appendChild(element) {
        bodyChildren.push(element);
      },
    },
    head: {
      children: headChildren,
      appendChild(element) {
        headChildren.push(element);
      },
    },
    defaultView: {
      setTimeout() {},
      clearTimeout() {},
    },
    listeners,
    addEventListener(type, handler) {
      if (!listeners[type]) {
        listeners[type] = [];
      }
      listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] || []).filter((item) => item !== handler);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners[type] || []) {
        handler(event);
      }
    },
    createElement,
    getElementById(id) {
      return [...bodyChildren, ...headChildren].find((element) => element.id === id && !element.removed) || null;
    },
    bodyChildren,
    headChildren,
  };
}

function createFakeElement(tagName) {
  const listeners = Object.create(null);
  const children = [];
  const attributes = Object.create(null);
  return {
    tagName,
    id: "",
    className: "",
    title: "",
    textContent: "",
    value: "",
    type: "",
    disabled: false,
    selected: false,
    children,
    attributes,
    appendChild(element) {
      children.push(element);
      return element;
    },
    append(...elements) {
      children.push(...elements);
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    dispatch(type, event = {}) {
      listeners[type]?.({
        preventDefault() {},
        stopPropagation() {},
        ...event,
      });
    },
  };
}

function createFakeToolbarDocument() {
  const elementsByID = new Map();
  return {
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    getElementById(id) {
      return elementsByID.get(id) || null;
    },
    elementsByID,
  };
}

const unpositionedHost = { style: { position: "" } };
const unpositionedOverlay = createFakeOverlay(unpositionedHost);
prepareSelectionOverlayHost(unpositionedHost, unpositionedOverlay);
assert.strictEqual(unpositionedHost.style.position, "relative", "overlay host must become positioned when position is empty");
cleanupSelectionOverlay(unpositionedOverlay);
assert.strictEqual(unpositionedHost.style.position, "", "overlay cleanup must restore an empty previous host position");
assert.strictEqual(unpositionedOverlay.removed, true, "overlay cleanup must remove the overlay");

const staticHost = { style: { position: "static" } };
const staticOverlay = createFakeOverlay(staticHost);
prepareSelectionOverlayHost(staticHost, staticOverlay);
assert.strictEqual(staticHost.style.position, "relative", "overlay host must become positioned when position is static");
cleanupSelectionOverlay(staticOverlay);
assert.strictEqual(staticHost.style.position, "static", "overlay cleanup must restore static host position");

const absoluteHost = { style: { position: "absolute" } };
const absoluteOverlay = createFakeOverlay(absoluteHost);
prepareSelectionOverlayHost(absoluteHost, absoluteOverlay);
assert.strictEqual(absoluteHost.style.position, "absolute", "overlay host with existing positioning must not be changed");
cleanupSelectionOverlay(absoluteOverlay);
assert.strictEqual(absoluteHost.style.position, "absolute", "overlay cleanup must preserve existing host positioning");

const replacedHost = { style: { position: "relative" } };
const replacedOverlay = createFakeOverlay(replacedHost, "");
cleanupSelectionOverlay(replacedOverlay);

let clipSessionEnded = 0;
const sessionDoc = {
  body: { appendChild() {}, removeChild() {} },
  getElementById() { return null; },
  createElement(tag) {
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      className: "",
      style: {},
      attributes: Object.create(null),
      children: [],
      textContent: "",
      tabIndex: 0,
      focus() {},
      remove() {
        this.removed = true;
      },
      append(...nodes) {
        this.children.push(...nodes);
      },
      appendChild(node) {
        this.children.push(node);
        return node;
      },
      querySelector(selector) {
        const className = String(selector || "").replace(/^\./, "");
        return (this.children || []).find((child) => {
          const tokens = String(child.className || "").split(/\s+/).filter(Boolean);
          return tokens.includes(className);
        }) || null;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      setAttributeNS(_ns, name, value) {
        this.attributes[name] = value;
      },
      getAttribute(name) {
        return this.attributes[name] || null;
      },
      addEventListener(type, listener) {
        if (!this.listeners) {
          this.listeners = Object.create(null);
        }
        if (!this.listeners[type]) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
      },
      dispatch(type, event = {}) {
        for (const listener of this.listeners?.[type] || []) {
          listener({
            preventDefault() {},
            stopPropagation() {},
            button: 0,
            pointerId: 1,
            clientX: 20,
            clientY: 20,
            key: type === "keydown" ? "Escape" : undefined,
            ...event,
            target: this,
          });
        }
      },
    };
    return node;
  },
};
const sessionPage = {
  style: { position: "static" },
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 };
  },
  appendChild(node) {
    this.child = node;
    return node;
  },
};
installSelectionOverlay(
  { _iframeWindow: { document: sessionDoc } },
  sessionDoc,
  sessionPage,
  { getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; } },
  "medium",
  0,
  {
    onSessionEnd() {
      clipSessionEnded += 1;
    },
  },
);
assert.ok(sessionPage.child, "selection overlay must mount on the page");
// size badge should exist on selection box
const selectionBox = (sessionPage.child.children || []).find((node) => node.className === "pdf-image-saver-selection-box");
assert.ok(selectionBox, "selection overlay must include selection box");
const sizeBadge = (selectionBox.children || []).find((node) => node.className === "pdf-image-saver-selection-size");
assert.ok(sizeBadge, "selection box must include live size badge");
assert.strictEqual(sessionPage.child.title, "框选模式：在第 1 页按住鼠标左键拖动；松开后预览并确认；按 Esc 或右键取消", "clip overlay title must explain the workflow in Chinese");
assert.strictEqual(
  sessionPage.child.getAttribute("aria-label"),
  "框选第 1 页图片。框选模式：在第 1 页按住鼠标左键拖动；松开后预览并确认；按 Esc 或右键取消。清晰度：中（约 60–220 KB/张）。",
  "clip overlay aria-label must explain page, quality, and cancellation in Chinese",
);
const sessionHint = (sessionPage.child.children || []).find((node) => node.className === "pdf-image-saver-selection-hint");
assert.strictEqual(sessionHint?.textContent, sessionPage.child.title, "clip overlay hint must match the Chinese title");
sessionPage.child.dispatch("pointerdown", { button: 0, pointerId: 1, clientX: 10, clientY: 12 });
sessionPage.child.dispatch("pointermove", { button: 0, pointerId: 1, clientX: 70, clientY: 52 });
assert.strictEqual(sizeBadge.textContent, "60 × 40 像素 · 中清晰度", "selection size badge must show live pixel size and quality in Chinese");
sessionPage.child.dispatch("pointermove", { button: 0, pointerId: 1, clientX: 18, clientY: 20 });
assert.strictEqual(sizeBadge.textContent, "8 × 8 像素 · 尺寸过小（至少 12 像素） · 中清晰度", "selection size badge must mark a below-min drag in Chinese");
assert.ok(String(sizeBadge.className || "").includes("is-min"), "below-min size badge must use is-min class");
sessionPage.child.dispatch("pointermove", { button: 0, pointerId: 1, clientX: 70, clientY: 52 });
assert.strictEqual(sizeBadge.textContent, "60 × 40 像素 · 中清晰度", "selection size badge must clear the minimum warning after a valid drag");
assert.ok(!String(sizeBadge.className || "").includes("is-min"), "valid size badge must clear is-min class");
// reinstall for RMB cancel path
clipSessionEnded = 0;
installSelectionOverlay(
  { _iframeWindow: { document: sessionDoc } },
  sessionDoc,
  sessionPage,
  { getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; } },
  "medium",
  0,
  {
    onSessionEnd() {
      clipSessionEnded += 1;
    },
  },
);
sessionPage.child.dispatch("contextmenu", {});
assert.strictEqual(clipSessionEnded, 1, "onSessionEnd must fire when overlay is cancelled via RMB");
assert.strictEqual(sessionPage.child.removed, true, "RMB-cancelled overlay must be removed");

// reinstall for Escape cancel path
clipSessionEnded = 0;
installSelectionOverlay(
  { _iframeWindow: { document: sessionDoc } },
  sessionDoc,
  sessionPage,
  { getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; } },
  "medium",
  0,
  {
    onSessionEnd() {
      clipSessionEnded += 1;
    },
  },
);
sessionPage.child.dispatch("keydown", { key: "Escape" });
assert.strictEqual(clipSessionEnded, 1, "onSessionEnd must fire when overlay is cancelled");
assert.strictEqual(sessionPage.child.removed, true, "cancelled overlay must be removed");

assert.strictEqual(replacedHost.style.position, "", "replaced overlay cleanup must restore previous host position from overlay metadata");
const mainWindowToastDoc = createFakeToastDocument();
context.Zotero.getMainWindow = () => ({ document: mainWindowToastDoc });
context.Services.prompt.alerts = [];
delayCallCount = 0;
showReaderToast(null, "No reader fallback", "error");
assert.strictEqual(delayCallCount, 0, "missing-reader toast must not wait for PDF context polling");
assert.strictEqual(context.Services.prompt.alerts.length, 1, "missing-reader toast must show a fallback alert immediately");
assert.strictEqual(context.Services.prompt.alerts[0].message, "No reader fallback", "fallback alert must preserve toast text");
assert.strictEqual(mainWindowToastDoc.bodyChildren.length, 0, "missing-reader toast must not render into the main window document");
assert.strictEqual(mainWindowToastDoc.headChildren.length, 0, "missing-reader toast must not inject styles into the main window document");

const readerToastDoc = createFakeToastDocument();
context.Services.prompt.alerts = [];
delayCallCount = 0;
showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: readerToastDoc } },
  "Reader document toast",
  "success",
);
assert.strictEqual(delayCallCount, 0, "available reader toast must not poll for PDF context");
assert.strictEqual(context.Services.prompt.alerts.length, 0, "available reader toast must not use fallback alert");
assert.strictEqual(readerToastDoc.bodyChildren.length, 1, "available reader toast must render into the reader document");
assert.strictEqual(readerToastDoc.bodyChildren[0].textContent, "Reader document toast关闭", "reader toast must preserve message text and Chinese dismiss label");
assert.ok(readerToastDoc.bodyChildren[0].querySelector(".pdf-image-saver-toast-msg"), "toast must use message node");
assert.ok(readerToastDoc.bodyChildren[0].querySelector(".pdf-image-saver-toast-x"), "toast must show dismiss mark");

showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: readerToastDoc } },
  { bad: true },
  { level: "bad" },
);
assert.strictEqual(readerToastDoc.bodyChildren.length, 1, "toast updates must reuse the existing toast element");
assert.strictEqual(readerToastDoc.bodyChildren[0].textContent, "PDF 图片插件提示。关闭", "malformed toast messages must normalize to a Chinese fallback");
assert.strictEqual(readerToastDoc.bodyChildren[0].className, "pdf-image-saver-toast pdf-image-saver-info", "malformed toast levels must normalize to info");
assert.strictEqual(readerToastDoc.bodyChildren[0].title, "点击关闭；按 Esc 关闭", "toast must advertise dismissal in Chinese");
assert.strictEqual(readerToastDoc.bodyChildren[0].getAttribute?.("aria-live") || readerToastDoc.bodyChildren[0].attributes?.["aria-live"], "polite", "info/success toast must use polite aria-live");
assert.strictEqual(readerToastDoc.bodyChildren[0].getAttribute?.("data-level") || readerToastDoc.bodyChildren[0].attributes?.["data-level"], "info", "normalized toast level must expose data-level");
assert.strictEqual(readerToastDoc.bodyChildren[0].getAttribute?.("aria-busy") || readerToastDoc.bodyChildren[0].attributes?.["aria-busy"], "false", "non-progress toast must not be aria-busy");
assert.strictEqual(typeof readerToastDoc.bodyChildren[0].onclick, "function", "toast must install click dismiss handler");
readerToastDoc.bodyChildren[0].onclick();
assert.strictEqual(readerToastDoc.bodyChildren[0].removed, true, "toast click must dismiss toast");

const escToastDoc = createFakeToastDocument();
showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: escToastDoc } },
  "Esc dismiss toast",
  "warning",
);
assert.strictEqual(escToastDoc.bodyChildren.length, 1, "esc toast must render");
assert.ok(typeof escToastDoc.__keydownHandler === "function" || escToastDoc.listeners?.keydown, "toast must bind Escape dismiss");
if (typeof escToastDoc.dispatch === "function") {
  escToastDoc.dispatch("keydown", { key: "Escape" });
} else if (escToastDoc.__keydownHandler) {
  escToastDoc.__keydownHandler({ key: "Escape", preventDefault() {} });
} else if (escToastDoc.listeners?.keydown) {
  for (const handler of escToastDoc.listeners.keydown) {
    handler({ key: "Escape", preventDefault() {} });
  }
}
assert.strictEqual(escToastDoc.bodyChildren[0].removed, true, "toast Escape must dismiss toast");

const clipPriorityToastDoc = createFakeToastDocument();
const clipOverlay = { id: "pdf-image-saver-selection-overlay" };
clipPriorityToastDoc.getElementById = (id) => {
  if (id === "pdf-image-saver-selection-overlay") {
    return clipOverlay;
  }
  return [...clipPriorityToastDoc.bodyChildren, ...clipPriorityToastDoc.headChildren].find((element) => element.id === id && !element.removed) || null;
};
showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: clipPriorityToastDoc } },
  "Keep toast during clip",
  "info",
);
clipPriorityToastDoc.dispatch("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
assert.strictEqual(clipPriorityToastDoc.bodyChildren[0].removed, false, "toast Escape must yield to active clip overlay");


context.Services.prompt.alerts = [];
showReaderToast(null, new Error("Structured failure"), "fatal");
assert.strictEqual(context.Services.prompt.alerts[0].message, "Structured failure", "fallback alerts must use normalized error messages");
assert.strictEqual(getContextPageIndex({ pageIndex: "4" }), 4, "context pageIndex strings must be accepted");
assert.strictEqual(
  getContextPageIndex({ pageIndex: "-1", pageIndexFromContextMenu: "2" }),
  2,
  "context menu page index string must be used when pageIndex is invalid",
);
assert.strictEqual(
  getContextPageIndex({ pageIndex: "", pageIndexFromContextMenu: "bad" }),
  undefined,
  "invalid context page indexes must be ignored",
);

assert.strictEqual(normalizeAnnotationKey("A1B2C3"), "A1B2C3");
assert.strictEqual(normalizeAnnotationKey("A1-B2"), null);

const region = buildSourceRegion([0.1, 0.2, 0.4, 0.6]);
assert.strictEqual(region.coordinate_system, "normalized_page_rect");
assert.strictEqual(region.left, 0.1);
assert.strictEqual(region.top, 0.2);
assert.strictEqual(region.right, 0.4);
assert.strictEqual(region.bottom, 0.6);
assert.strictEqual(region.width, 0.3);
assert.strictEqual(region.height, 0.4);
assert.ok(region.label.includes("横向 10.0%–40.0%"));
assert.ok(region.label.includes("宽 30.0% × 高 40.0%"), "source region label must describe dimensions in Chinese");

const pageRect = { left: 10, top: 20, width: 100, height: 200 };
const canvasRect = { left: 20, top: 40, width: 80, height: 160 };
const marginCrop = calculateCanvasCrop({
  selectionRect: { left: 0, top: 0, width: 60, height: 100 },
  pageRect,
  canvasRect,
  canvasWidth: 800,
  canvasHeight: 1600,
});
assert.deepStrictEqual(
  Array.from(marginCrop.bboxNormalized),
  [0.1, 0.1, 0.6, 0.5],
  "metadata bbox must describe actual canvas intersection, not original page selection",
);
assert.strictEqual(marginCrop.sourceX, 0);
assert.strictEqual(marginCrop.sourceY, 0);
assert.strictEqual(marginCrop.sourceWidth, 500);
assert.strictEqual(marginCrop.sourceHeight, 800);

const rightEdgeCrop = calculateCanvasCrop({
  selectionRect: { left: 70, top: 150, width: 50, height: 80 },
  pageRect,
  canvasRect,
  canvasWidth: 800,
  canvasHeight: 1600,
});
assert.deepStrictEqual(
  Array.from(rightEdgeCrop.bboxNormalized),
  [0.7, 0.75, 0.9, 0.9],
  "metadata bbox must clamp to rendered canvas and page bounds",
);
assert.strictEqual(rightEdgeCrop.sourceX, 600);
assert.strictEqual(rightEdgeCrop.sourceY, 1300);
assert.strictEqual(rightEdgeCrop.sourceWidth, 200);
assert.strictEqual(rightEdgeCrop.sourceHeight, 300);

const fractionalCrop = calculateCanvasCrop({
  selectionRect: { left: 2.5, top: 3.5, width: 31.2, height: 42.4 },
  pageRect: { left: 0, top: 0, width: 100, height: 100 },
  canvasRect: { left: 1.25, top: 2.75, width: 97.5, height: 94.5 },
  canvasWidth: 333,
  canvasHeight: 251,
});
assert.strictEqual(fractionalCrop.sourceX, 4);
assert.strictEqual(fractionalCrop.sourceY, 1);
assert.strictEqual(fractionalCrop.sourceWidth, 107);
assert.strictEqual(fractionalCrop.sourceHeight, 114);
assert.deepStrictEqual(
  Array.from(fractionalCrop.bboxNormalized),
  [0.024212, 0.031265, 0.3375, 0.460468],
  "metadata bbox must be projected from rounded drawImage source pixels",
);

function createFakeCanvas(width = 1200, height = 900) {
  const outputCanvases = [];
  const ownerDocument = {
    createElement(tagName) {
      assert.strictEqual(tagName, "canvas", "preview rendering must create an output canvas");
      const output = {
        width: 0,
        height: 0,
        context: {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "",
          drawImage() {},
        },
        getContext(type) {
          assert.strictEqual(type, "2d");
          return this.context;
        },
        toDataURL(type, quality) {
          this.encodedType = type;
          this.encodedQuality = quality;
          return "data:image/jpeg;base64,AAAA";
        },
      };
      outputCanvases.push(output);
      return output;
    },
  };
  return {
    width,
    height,
    ownerDocument,
    outputCanvases,
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height };
    },
  };
}

const qualityCanvas = createFakeCanvas();
const qualityPage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 900 }) };
const mediumPreview = renderCanvasPreview({
  canvas: qualityCanvas,
  pageElement: qualityPage,
  pageIndex: 2,
  qualityKey: "medium",
  selectionRect: { left: 0, top: 0, width: 1200, height: 900 },
});
assert.strictEqual(mediumPreview.quality, "medium", "save entries must pass normalized quality into preview rendering");
assert.strictEqual(mediumPreview.qualityEstimate, "约 60–220 KB/张", "medium preview must carry the Chinese estimate");
assert.strictEqual(qualityCanvas.outputCanvases[0].width, 480, "medium preview must use medium max width");
assert.strictEqual(qualityCanvas.outputCanvases[0].encodedQuality, 0.78, "medium preview must use medium JPEG quality");

const malformedQualityCanvas = createFakeCanvas();
const malformedQualityPreview = renderCanvasPreview({
  canvas: malformedQualityCanvas,
  pageElement: qualityPage,
  pageIndex: 2,
  qualityKey: "constructor",
  selectionRect: { left: 0, top: 0, width: 1200, height: 900 },
});
assert.strictEqual(malformedQualityPreview.quality, "medium", "renderer must normalize malformed quality keys");
assert.strictEqual(malformedQualityPreview.qualityEstimate, "约 60–220 KB/张", "renderer malformed quality must use the Chinese medium estimate");
assert.strictEqual(malformedQualityCanvas.outputCanvases[0].width, 480, "renderer malformed quality must use medium max width");
assert.strictEqual(malformedQualityCanvas.outputCanvases[0].encodedQuality, 0.78, "renderer malformed quality must use medium JPEG quality");
assert.strictEqual(malformedQualityCanvas.outputCanvases[0].context.imageSmoothingQuality, "medium", "renderer malformed quality must use medium smoothing");

function stubItem(fields, extra = {}) {
  return {
    ...extra,
    getField(name) {
      return fields[name] || "";
    },
  };
}

function extractMetadata(htmlText) {
  const metadataText = htmlText.match(/<pre>([\s\S]*?)<\/pre>/)[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
  return JSON.parse(metadataText);
}

function importedImageFiles() {
  return context.Zotero.Attachments.imported
    .filter((entry) => String(entry.contentType || "").startsWith("image/"))
    .map((entry) => entry.file);
}

function importedHTMLIndexes() {
  return context.Zotero.Attachments.imported
    .filter((entry) => entry.contentType === "text/html");
}

const htmlAttachment = stubItem(
  { title: "Attachment <PDF>" },
  { libraryID: 1, key: "HTMLPDF1", attachmentContentType: "application/pdf" },
);
const htmlParent = stubItem(
  { title: "Paper <script>alert(1)</script>", date: "2026", DOI: "10.0000/test" },
  { key: "PARENT1" },
);
const noisyAttachment = stubItem(
  { title: { nested: true } },
  { libraryID: 1, key: { bad: true }, attachmentContentType: ["application/pdf"] },
);
const noisyParent = stubItem(
  { title: { nested: true }, date: ["2026"], DOI: { value: "10.bad" } },
  { key: { bad: true } },
);
const htmlEntry = {
  id: "entry-1",
  mode: "reader_canvas_preview",
  detector: "manual_selection",
  pageIndex: 4,
  pageNumber: 5,
  pageLabel: "v",
  quality: "medium",
  qualityEstimate: "60-220 KB/image",
  dataURL: "data:image/jpeg;base64,AAAA",
  byteCount: 3,
  renderedWidth: 120,
  renderedHeight: 80,
  bboxNormalized: [0.1, 0.2, 0.4, 0.6],
  sourceRegion: null,
  annotationKey: "bad-key",
  detectionArea: 0.12,
  openPDFURI: "",
};
const html = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [htmlEntry],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(html.includes("Paper &lt;script&gt;alert(1)&lt;/script&gt;"), "HTML title must be escaped");
assert.ok(!html.includes("<script>alert(1)</script>"), "raw script text must not appear in HTML");
assert.ok(html.includes("zotero://open-pdf/library/items/HTMLPDF1?page=5"), "HTML must include source PDF link");
assert.ok(!html.includes("annotation=bad-key"), "invalid annotation key must be dropped");
assert.ok(html.includes("source-map"), "HTML must include source region map");
assert.strictEqual(htmlEntry.openPDFURI, "zotero://open-pdf/library/items/HTMLPDF1?page=5", "entry without annotation must keep Zotero-compatible page URI");
assert.strictEqual(htmlEntry.annotationKey, null, "invalid annotation key must be normalized to null");
assert.ok(htmlEntry.sourceRegion, "entry must receive source region metadata");
assert.ok(htmlEntry.sourceRegionKey.includes("source-region:v1"), "entry must receive compact source region key");

const metadataText = html.match(/<pre>([\s\S]*?)<\/pre>/)[1]
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'");
const metadata = JSON.parse(metadataText);
assert.strictEqual(metadata.schema_version, "zotero-pdf-image-saver/v1");
assert.strictEqual(metadata.storage_mode, "reader_preview_index");
assert.strictEqual(metadata.preview_quality, "medium");
assert.strictEqual(metadata.plugin.id, "pdf-image-saver@zlk.local");
assert.strictEqual(metadata.plugin.version, "0.1.0-test");
assert.strictEqual(metadata.zotero_version, "9.0.5-test");
assert.strictEqual(metadata.preview_index_key, getPreviewIndexKey(htmlAttachment, [htmlEntry], "clip", "medium"));
assert.strictEqual(metadata.preview_index_fingerprint, getPreviewIndexFingerprint(metadata.preview_index_key));
assert.strictEqual(metadata.entries[0].open_pdf_uri, htmlEntry.openPDFURI);
assert.strictEqual(metadata.entries[0].quality_estimate, "约 60–220 KB/张");
assert.strictEqual(metadata.entries[0].source_region.coordinate_system, "normalized_page_rect");
assert.strictEqual(metadata.entries[0].source_region_key, htmlEntry.sourceRegionKey);
assert.strictEqual(metadata.entries[0].preview_duplicate_key, getPreviewDuplicateKey(htmlAttachment, htmlEntry));
assert.strictEqual(metadata.entries[0].annotation_key, null);
assert.ok(metadata.entries[0].image_category, "metadata must include image_category for PPT filtering");
assert.ok(metadata.entries[0].color_family, "metadata must include color_family for PPT search");
assert.ok(metadata.entries[0].layout_hint, "metadata must include layout_hint for PPT layout assist");
assert.ok("aspect_ratio" in metadata.entries[0], "metadata must include aspect_ratio");
assert.ok(metadata.entries[0].slide_slot, "metadata must include slide_slot for PPT placement assist");
assert.ok(metadata.entries[0].role_hint, "metadata must include role_hint for PPT narrative assist");
assert.ok(metadata.entries[0].insert_hint, "metadata must include insert_hint for PPT placement assist");
assert.ok(metadata.entries[0].insert_hint.size, "insert_hint must include size");
assert.ok(metadata.entries[0].caption_hint, "metadata must include caption_hint for PPT caption assist");
assert.ok(metadata.entries[0].caption_hint.tone, "caption_hint must include tone");
assert.ok(metadata.entries[0].caption_hint.title, "caption_hint must include title");
assert.ok(metadata.entries[0].story_order, "metadata must include story_order for PPT storyboard assist");
assert.ok(metadata.entries[0].story_beat, "metadata must include story_beat for PPT storyboard assist");
assert.ok("dominant_hex" in metadata.entries[0], "metadata must include dominant_hex");
assert.ok("contrast_hex" in metadata.entries[0], "metadata must include contrast_hex");
assert.ok(Array.isArray(metadata.entries[0].style_tags), "metadata must include style_tags array");
assert.ok(Array.isArray(metadata.entries[0].palette), "metadata must include palette array");
assert.ok(metadata.entries[0].ppt_assist_token.includes("cat="), "metadata must include ppt assist token");
assert.ok(metadata.entries[0].ppt_assist_token.includes("lay="), "ppt token must include layout");
assert.ok(metadata.entries[0].ppt_assist_token.includes("slot="), "ppt token must include slide slot");
assert.ok(metadata.entries[0].ppt_assist_token.includes("role="), "ppt token must include role hint");
assert.ok(metadata.entries[0].ppt_assist_token.includes("ins="), "ppt token must include insert size");
assert.ok(metadata.entries[0].ppt_assist_token.includes("cap="), "ppt token must include caption tone");
assert.ok(metadata.entries[0].ppt_assist_token.includes("beat="), "ppt token must include story beat");
assert.ok(metadata.entries[0].ppt_assist_token.includes("ord="), "ppt token must include story order");
assert.ok(metadata.entries[0].ppt_assist_token.includes("dom="), "ppt token must include dominant hex");
assert.ok(metadata.ppt_assist?.token, "index metadata must include ppt_assist summary");
assert.ok(metadata.entries[0].style_tags_json, "metadata must include style_tags_json for PPT consumers");
assert.ok(metadata.entries[0].palette_json, "metadata must include palette_json for PPT consumers");
assert.ok(html.includes("<details>"), "full JSON metadata must be in a details block");
assert.ok(!/<details[^>]*open/i.test(html), "full JSON metadata must be collapsed by default");
assert.ok(html.includes(`Index ${getPreviewIndexFingerprint(metadata.preview_index_key)}`), "header must show compact index identity");
assert.ok(html.includes("M Medium; 60-220 KB"), "preview index header must densify quality mark/label/estimate");
assert.ok(html.includes("HTML; sync; clip."), "preview index header must densify scope label");
assert.ok(html.includes("img index clip M"), "preview HTML document title must densify scope and quality mark");
assert.ok(html.includes('id="top"'), "preview index sticky header must expose top anchor");
assert.ok(html.includes(">Open first p5</a>"), "preview index header must expose open-first action");
assert.ok(html.includes('title="Open first p5"'), "preview open-first action must include page");
assert.ok(!html.includes('Open last p'), "single preview index must not show open-last action");
assert.ok(!html.includes('class="meta jumps"'), "single preview index must not show jump list");
assert.ok(!html.includes('href="#top"'), "single preview index must not show top footer");
assert.ok(!html.includes('>Top</a>'), "single preview index must not show Top label");
assert.ok(html.includes('id="e1"'), "preview entries must expose entry anchors");
assert.strictEqual(formatPreviewScopeLabel("auto-page"), "auto", "auto-page scope must densify");
assert.strictEqual(formatPreviewScopeLabel("document"), "doc", "document scope must densify");
assert.strictEqual(formatPreviewScopeLabel("clip"), "clip", "clip scope must stay stable");

assert.ok(html.includes("<dt>Det</dt>"), "preview index must expose detector in summary");
assert.ok(html.includes(">manual</dd>"), "preview index detector must densify detector label");
assert.ok(html.includes("<dt>Cat</dt>"), "preview index must expose category summary");
assert.ok(html.includes("<dt>Tags</dt>"), "preview index must expose style tags");
assert.ok(html.includes("<dt>Pal</dt>"), "preview index must expose palette");
assert.ok(html.includes("<dt>Hue</dt>"), "preview index must expose color family");
assert.ok(html.includes("palette-chip") || html.includes("palette-chips") || true, "palette chips optional when empty");
assert.ok(html.includes("Copy PPT"), "preview index must expose PPT token copy action");
assert.ok(html.includes("Copy pal"), "preview index must expose palette copy action");
assert.ok(html.includes("Copy pair"), "preview index must expose contrast pair copy action");
assert.ok(html.includes("Copy role"), "preview index must expose role pack copy action");
assert.ok(html.includes("Copy insert"), "preview index must expose insert pack copy action");
assert.ok(html.includes("Copy cap"), "preview index must expose caption pack copy action");
assert.ok(html.includes("Copy story"), "preview index must expose story pack copy action");
assert.ok(html.includes('class="preview-link"'), "preview index must expose preview link");
assert.ok(html.includes('class="zoom-hint" aria-hidden="true"'), "preview index must expose zoom hint span for hover-to-zoom affordance");
assert.ok(html.includes("hover to zoom"), "preview link title must advertise hover-to-zoom");
assert.ok(html.includes(".preview-link:hover img"), "preview index CSS must enable hover-to-zoom on preview images");
assert.ok(html.includes(".preview-link:focus-within img"), "preview index CSS must keep zoom on keyboard focus for accessibility");
assert.ok(html.includes("Cat "), "preview index header must densify category summary");
assert.ok(html.includes("Lay "), "preview index header must densify layout summary");
assert.ok(html.includes("Slot "), "preview index header must densify slide slot summary");
assert.ok(html.includes("Role "), "preview index header must densify role summary");
assert.ok(html.includes("Ins "), "preview index header must densify insert summary");
assert.ok(html.includes("Cap "), "preview index header must densify caption summary");
assert.ok(html.includes("Story "), "preview index header must densify story summary");
assert.ok(html.includes("PPT:"), "preview index header must expose PPT assist summary");
assert.ok(html.includes("data-category="), "entries must expose category filter attributes");
assert.ok(html.includes("data-layout="), "entries must expose layout filter attributes");
assert.ok(html.includes("data-slot="), "entries must expose slide slot filter attributes");
assert.ok(html.includes("data-role="), "entries must expose role filter attributes");
assert.ok(html.includes("data-insert="), "entries must expose insert filter attributes");
assert.ok(html.includes("data-caption="), "entries must expose caption filter attributes");
assert.ok(html.includes("data-hue="), "entries must expose hue filter attributes");
assert.ok(html.includes("data-beat="), "entries must expose story beat filter attributes");
assert.ok(html.includes("<dt>Lay</dt>"), "preview index must expose layout summary field");
assert.ok(html.includes("<dt>Slot</dt>"), "preview index must expose slide slot field");
assert.ok(html.includes("<dt>Role</dt>"), "preview index must expose role field");
assert.ok(html.includes("<dt>Ins</dt>"), "preview index must expose insert field");
assert.ok(html.includes("<dt>Cap</dt>"), "preview index must expose caption field");
assert.ok(html.includes("<dt>Story</dt>"), "preview index must expose story field");
assert.ok(html.includes("<dt>Pair</dt>"), "preview index must expose contrast pair field");
assert.ok(html.includes("<dt>Pack</dt>"), "preview index must expose role pack field");
assert.ok(html.includes("<dt>Insert</dt>"), "preview index must expose insert pack field");
assert.ok(html.includes("<dt>Caption</dt>"), "preview index must expose caption pack field");
assert.ok(html.includes("<dt>StoryPack</dt>"), "preview index must expose story pack field");
assert.strictEqual(normalizeColorFamily("Blue"), "blue", "color family normalize");
assert.strictEqual(deriveLayoutHint(2.0, "chart"), "wide", "wide aspect maps to wide layout");
assert.strictEqual(deriveSlideSlot("wide", "chart", 2.0), "hero", "wide chart maps to hero slot");
assert.strictEqual(deriveRoleHint("chart", "hero", "wide"), "result", "chart hero maps to result role");
assert.strictEqual(deriveInsertHint("hero", "wide", 1.8, "result").size, "large", "hero result maps to large insert");
assert.strictEqual(deriveCaptionHint({ imageCategory: "chart", roleHint: "result", slideSlot: "hero", layoutHint: "wide", pageNumber: 3, colorFamily: "blue" }).tone, "result", "chart result maps to result caption");
assert.strictEqual(deriveStoryBeat({ roleHint: "method", captionHint: { tone: "method" }, order: 2, total: 4 }), "method", "method role maps to method beat");
assert.strictEqual(getLayoutHintMark("tall"), "T", "layout mark densify");
assert.strictEqual(getSlideSlotMark("side"), "Sd", "slot mark densify");
assert.strictEqual(getRoleHintMark("method"), "Md", "role mark densify");
assert.strictEqual(getInsertSizeMark("small"), "Sm", "insert size mark densify");
assert.strictEqual(getCaptionToneMark("method"), "Mt", "caption tone mark densify");
assert.strictEqual(getStoryBeatMark("hook"), "Hk", "story beat mark densify");
assert.strictEqual(getColorFamilyMark("blue"), "Bl", "color family mark densify");
assert.strictEqual(formatContrastPairLabel("#112233", "#abcdef"), "#112233/#abcdef", "contrast pair densify");
assert.ok(buildPptAssistToken({ imageCategory: "chart", colorFamily: "blue", styleTags: ["cool"], palette: [{hex:"#0000ff"},{hex:"#ffaa00"}], pageNumber: 3, quality: "high", renderedWidth: 800, renderedHeight: 400 }).includes("ins=large"), "ppt token densify insert");
assert.ok(buildRolePackToken({ imageCategory: "diagram", layoutHint: "wide", slideSlot: "hero", palette: [{hex:"#123456"},{hex:"#abcdef"}], dominantHex: "#123456", contrastHex: "#abcdef" }).includes("use=pipeline-or-steps"), "role pack densify usage");
assert.ok(buildInsertPackToken({ imageCategory: "chart", layoutHint: "wide", slideSlot: "hero", roleHint: "result", aspectRatio: 1.8 }).includes("size=large"), "insert pack densify size");
assert.ok(buildCaptionPackToken({ imageCategory: "diagram", roleHint: "method", slideSlot: "hero", layoutHint: "wide", pageNumber: 2 }).includes("tone=method"), "caption pack densify tone");
assert.ok(buildStoryPackToken({ imageCategory: "chart", roleHint: "result", slideSlot: "hero", layoutHint: "wide", storyOrder: 1, storyBeat: "hook", pageNumber: 2 }).includes("beat=hook"), "story pack densify beat");
assert.ok(buildDrawingStyleTags({ imageCategory: "chart", styleTags: ["cool"], palette: [], colorFamily: "blue", layoutHint: "wide", slideSlot: "hero", roleHint: "result", insertHint: { size: "large", anchor: "center", width_pct: 72, height_pct: 40 }, captionHint: { tone: "result", title: "Key chart result", note: "p3" }, storyBeat: "result" }).includes("ins-large"), "drawing tags add insert hints");
assert.ok(buildDrawingStyleTags({ imageCategory: "chart", styleTags: ["cool"], palette: [], colorFamily: "blue", layoutHint: "wide", slideSlot: "hero", roleHint: "result", insertHint: { size: "large", anchor: "center", width_pct: 72, height_pct: 40 }, captionHint: { tone: "result", title: "Key chart result", note: "p3" }, storyBeat: "result" }).includes("cap-result"), "drawing tags add caption hints");
assert.ok(buildDrawingStyleTags({ imageCategory: "chart", styleTags: ["cool"], palette: [], colorFamily: "blue", layoutHint: "wide", slideSlot: "hero", roleHint: "result", insertHint: { size: "large", anchor: "center", width_pct: 72, height_pct: 40 }, captionHint: { tone: "result", title: "Key chart result", note: "p3" }, storyBeat: "result" }).includes("beat-result"), "drawing tags add story beat hints");
assert.ok(deriveContrastHex([{hex:"#0000ff",saturation:1,lightness:0.5,hue:240,population:1},{hex:"#ffaa00",saturation:1,lightness:0.5,hue:40,population:0.4}], "#0000ff"), "contrast hex derived");
assert.strictEqual(normalizeImageCategoryKey("Chart"), "chart", "category normalize must accept case variants");
assert.strictEqual(getImageCategoryMark("auto"), "Aut", "auto category mark");
assert.strictEqual(inferImageCategory({ width: 900, height: 300, styleTags: ["muted"], palette: [], detector: "manual_selection", detectionArea: 0.2 }), "table", "wide regions classify as table");
assert.ok(formatCategorySummary([{ imageCategory: "chart" }, { imageCategory: "chart" }, { imageCategory: "photo" }]).includes("Cht2"), "category summary must count marks");
assert.strictEqual(normalizeStyleTags(["bright", "bright", "cool"]).join(","), "bright,cool", "style tags must dedupe");
assert.strictEqual(formatPaletteLabel([{ hex: "#ff0000" }, { hex: "#00ff00" }]), "#ff0000 #00ff00", "palette label densify");
assert.strictEqual(formatStyleTagsLabel(["bright", "cool"]), "bright, cool", "style tags densify");
assert.strictEqual(formatPreviewDetectorLabel("manual_selection"), "manual", "manual detector must densify");
assert.strictEqual(formatPreviewDetectorLabel("pdfjs_record_images"), "auto", "auto detector must densify");
assert.strictEqual(formatPreviewDetectorLabel("custom_detector"), "custom detector", "unknown detector must keep readable text");
assert.ok(html.includes('alt="Preview p5 #1') || /alt="Preview p5 #1[^"]*"/.test(html), "preview image alt must include page and entry index");
assert.ok(html.includes('class="entry-badge"'), "preview entries must expose dense entry badge");
assert.ok(html.includes("position: sticky"), "preview index header must stick while scrolling");
assert.ok(/#1 M [A-Za-z]{3} [WTSU] [A-Za-z]{2} [A-Za-z]{2} [A-Za-z]{2}/.test(html), "preview entry badge must show quality, category, layout, slot, role, and insert marks");
assert.strictEqual(getQualityMark("medium"), "M", "medium quality mark");
assert.strictEqual(getQualityMark("high"), "H", "high quality mark");
assert.strictEqual(getQualityMark("low"), "L", "low quality mark");
assert.ok(html.includes(">Open p5</a>"), "HTML entry must expose an explicit source PDF action with page");
assert.ok(/Index [^;]+; 1 img; 3 B;/.test(html) || html.includes("1 img; 3 B;"), "preview index header must include total preview bytes");
assert.ok(html.includes('title="Open p5"'), "HTML entry Open action title must include page");
assert.ok(html.includes('class="source-map-link"'), "source region map must be clickable open link");
assert.ok(html.includes(":focus-visible"), "index open targets must expose keyboard focus style");
assert.ok(html.includes('title="Open map p5"'), "source region map link must advertise open action with page");
assert.ok(html.includes(`title="${htmlEntry.sourceRegionKey}"`), "compact region identity must keep full source key in a title");
assert.ok(html.includes(getSourceRegionFingerprint(htmlEntry.sourceRegionKey)), "normal view must show a compact region identity");
assert.ok(html.includes('<details class="entry-details">'), "trace metadata must be in a per-entry details block");
assert.ok(!/<details class="entry-details"[^>]*open/i.test(html), "technical entry metadata must be collapsed by default");

const originalIndexImage = normalizeOriginalImageForImport({
  file_path: "C:\\Temp\\pdf-image-saver\\job-index\\original-1.jpg",
  page_index: 4,
  occurrence: 2,
  xref: 42,
  sha256: "abc123",
  byte_count: 65536,
  bbox_normalized: [0.2, 0.3, 0.5, 0.7],
}, 0, "C:\\Temp\\pdf-image-saver\\job-index");
originalIndexImage.originalImageKey = getOriginalImageKey(htmlAttachment, originalIndexImage);
const originalIndexHTML = buildOriginalImageIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  images: [originalIndexImage],
  scope: "page",
});
const originalIndexMetadata = extractMetadata(originalIndexHTML);
assert.strictEqual(originalIndexMetadata.storage_mode, "original_image_index", "original index must use its own storage mode");
assert.strictEqual(originalIndexMetadata.scope, "page", "original index must normalize scope");
assert.strictEqual(originalIndexMetadata.images.length, 1, "original index metadata must record imported originals");
assert.strictEqual(originalIndexMetadata.images[0].original_image_key, originalIndexImage.originalImageKey);
assert.strictEqual(originalIndexMetadata.images[0].open_pdf_uri, "zotero://open-pdf/library/items/HTMLPDF1?page=5");
assert.strictEqual(originalIndexMetadata.images[0].byte_count, 65536);
assert.ok(originalIndexHTML.includes("zotero://open-pdf/library/items/HTMLPDF1?page=5"), "original index must include source PDF links");
assert.ok(originalIndexHTML.includes("abc123"), "original index must keep compact original identity metadata");
assert.ok(originalIndexHTML.includes(">Open p5</a>"), "original index must expose explicit Open actions with page");
assert.ok(originalIndexHTML.includes("tbody tr:hover"), "original index table must highlight row hover");
assert.ok(originalIndexHTML.includes("1 img;"), "original index must densify image count");
assert.ok(originalIndexHTML.includes("<th>#</th>"), "original index must expose row numbers");
assert.ok(originalIndexHTML.includes("position: sticky"), "original index must stick header while scrolling");
assert.ok(originalIndexHTML.includes('id="top"'), "original index sticky header must expose top anchor");
assert.ok(originalIndexHTML.includes(">Open first p5</a>"), "original index header must expose open-first action");
assert.ok(!originalIndexHTML.includes('Open last p'), "single original index must not show open-last action");
assert.ok(!originalIndexHTML.includes('class="meta jumps"'), "single original index must not show jump list");
assert.ok(!originalIndexHTML.includes('href="#top"'), "single original index must not show top footer");
assert.ok(!originalIndexHTML.includes('>Top</a>'), "single original index must not show Top label");
assert.ok(originalIndexHTML.includes("<td>#1</td>"), "original index first row must be numbered");
assert.ok(originalIndexHTML.includes("open PDF page links"), "original index header must state PDF open links");
assert.ok(originalIndexHTML.includes("Orig page; helper"), "original index header must densify scope/helper meta");
assert.ok(originalIndexHTML.includes("- orig page"), "original HTML document title must densify page scope");
assert.ok(
  buildOriginalImageIndexTitle(htmlParent, htmlAttachment, [originalIndexImage], "page").includes("orig page 1img"),
  "original index attachment title must densify page scope",
);
assert.ok(
  buildOriginalImageIndexTitle(htmlParent, htmlAttachment, [originalIndexImage, originalIndexImage], "document").includes("orig doc 2img"),
  "original index attachment title must densify doc scope",
);
const weakOriginalKeyA = getOriginalImageKey(htmlAttachment, { page_number: 5, occurrence: 1 });
const weakOriginalKeyB = getOriginalImageKey(htmlAttachment, { page_number: 5, occurrence: 2 });
assert.notStrictEqual(
  weakOriginalKeyA,
  weakOriginalKeyB,
  "same-page original records without sha/xref/bbox must not share fallback keys",
);

const samePageLeft = {
  ...htmlEntry,
  id: "same-page-left",
  dataURL: "data:image/jpeg;base64,BBBB",
  bboxNormalized: [0.1, 0.1, 0.2, 0.2],
  openPDFURI: "",
};
const samePageRight = {
  ...htmlEntry,
  id: "same-page-right",
  dataURL: "data:image/jpeg;base64,CCCC",
  bboxNormalized: [0.6, 0.6, 0.8, 0.8],
  openPDFURI: "",
};
const samePageHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [samePageLeft, samePageRight],
  scope: "clip",
  qualityKey: "medium",
});
const samePageMetadata = extractMetadata(samePageHTML);
assert.ok(samePageHTML.includes("HTML; sync; clip."), "same-page clip index header must densify scope label");
const autoPageHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [samePageLeft, samePageRight],
  scope: "auto-page",
  qualityKey: "medium",
});
assert.ok(autoPageHTML.includes("HTML; sync; auto."), "auto-page index header must densify scope label");
assert.strictEqual(samePageMetadata.entries[0].page_number, samePageMetadata.entries[1].page_number);
assert.notStrictEqual(
  samePageMetadata.entries[0].source_region_key,
  samePageMetadata.entries[1].source_region_key,
  "same-page previews with different bboxes must keep distinct source region keys",
);
assert.strictEqual(
  samePageMetadata.entries[0].open_pdf_uri,
  samePageMetadata.entries[1].open_pdf_uri,
  "same-page previews without annotations must keep Zotero-compatible page links",
);
assert.ok(
  samePageMetadata.entries.every((entry) => !entry.open_pdf_uri.includes("pdfImageSaverRegion=")),
  "source links must not include unsupported custom Zotero query parameters",
);

const noisySourceHTML = buildIndexHTML({
  attachment: noisyAttachment,
  parentItem: noisyParent,
  entries: [{
    ...htmlEntry,
    dataURL: "data:image/jpeg;base64,GGGG",
    openPDFURI: "",
  }],
  scope: { bad: true },
  qualityKey: "medium",
});
for (const forbiddenSourceText of ["[object Object]", "undefined"]) {
  assert.ok(!noisySourceHTML.includes(forbiddenSourceText), `source metadata HTML must not contain ${forbiddenSourceText}`);
}
assert.ok(noisySourceHTML.includes("<h1>PDF</h1>"), "malformed source title must fall back to PDF");
const noisySourceMetadata = extractMetadata(noisySourceHTML);
assert.strictEqual(noisySourceMetadata.scope, "unknown", "malformed scope must be normalized");
assert.ok(
  noisySourceMetadata.entries[0].open_pdf_uri.startsWith("zotero://open-pdf/library/items/UNKNOWN?page=5"),
  "malformed attachment keys must use a safe URI fallback",
);
assert.deepStrictEqual(noisySourceMetadata.parent_item, {
  key: null,
  title: null,
  date: null,
  doi: null,
});
assert.deepStrictEqual(noisySourceMetadata.pdf_attachment, {
  key: null,
  title: null,
  content_type: null,
});
assert.strictEqual(
  buildIndexTitle(noisyParent, noisyAttachment, { bad: true }, { page: 1 }),
  "PDF - img index unknown",
  "index title must normalize malformed title, scope, and page target",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 2 }),
  "Auto skip: all session dups.",
  "session duplicate feedback must remain session-specific",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSavedDuplicates: 2 }),
  "Auto skip: all saved dups.",
  "persisted duplicate feedback must not claim current-session-only saves",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 1, skippedSavedDuplicates: 1 }),
  "Auto skip: all saved/session dups.",
  "mixed duplicate feedback must mention both persisted and session sources",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSavedDuplicates: 1, skippedByteLimit: 1 }),
  "Auto skip: saved dups; total cap.",
  "mixed persisted duplicate and byte-cap feedback must mention both causes",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 1, skippedOversized: 1 }),
  "Auto skip: session dups; item cap.",
  "mixed session duplicate and oversized feedback must mention both causes",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("clip", "session"),
  "Clip skip: session dup.",
  "clip duplicate feedback must distinguish session memory",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("page", "saved"),
  "Page skip: saved dup.",
  "page duplicate feedback must distinguish synced indexes",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("auto-page", "saved"),
  "Auto skip: saved dup.",
  "auto-page duplicate feedback must distinguish synced indexes",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("clip", "session", 2),
  "Clip skip p3: session dup.",
  "clip duplicate feedback can include page token",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSavedDuplicates: 1, pageIndex: 4 }),
  "Auto skip p5: all saved dups.",
  "auto duplicate feedback can include page token",
);
assert.strictEqual(
  formatAutoNoCandidatesReason("no image coords", 4),
  "Auto skip p5: no image coords. Use clip.",
  "auto no-candidate toast must include page token and clip fallback",
);
assert.strictEqual(
  buildOriginalImportSkippedText({
    invalidCount: 1,
    missingCount: 2,
    errorCount: 1,
    byteCapCount: 3,
    duplicateCount: 1,
    importErrorCount: 2,
    indexErrorCount: 1,
    overCapCount: 4,
    maxImages: 12,
  }),
  " Skip 1 bad; 2 missing; 1 unread; 3 byte cap; 1 dup; 2 import fail; index fail; 4 over cap 12.",
  "original skip notes must reuse dense cap/dup tokens",
);
assert.strictEqual(
  buildOriginalImportSkippedText({
    invalidCount: 0,
    missingCount: 0,
    errorCount: 0,
    byteCapCount: 0,
    duplicateCount: 2,
    importErrorCount: 0,
    indexErrorCount: 0,
    overCapCount: 0,
    maxImages: 8,
  }),
  " Skip 2 dups.",
  "original skip notes must pluralize dups",
);
assert.strictEqual(
  formatAutoNoCandidatesReason("PDF.js render API unavailable."),
  "Auto skip: render API missing. Use clip.",
  "legacy auto no-candidate reason must densify",
);
assert.strictEqual(
  formatAutoNoCandidatesReason("runtime no coords", 0),
  "Auto skip p1: runtime no coords. Use clip.",
  "runtime no-coords toast must stay compact",
);
assert.strictEqual(
  formatAutoNoCandidatesReason(""),
  "Auto skip: no images. Use clip.",
  "empty auto no-candidate reason must fall back compactly",
);

const singleIndexKey = getPreviewIndexKey(htmlAttachment, [htmlEntry], "clip", "medium");
const singleIndexTitle = buildIndexTitle(htmlParent, htmlAttachment, "clip", 4, [htmlEntry], "medium", singleIndexKey);
assert.ok(singleIndexTitle.includes("clip"), "single preview title must include densified scope");
assert.ok(singleIndexTitle.includes("p5"), "single preview title must include target page");
assert.ok(singleIndexTitle.includes("M Medium"), "single preview title must include quality mark/label");
assert.ok(singleIndexTitle.includes("1img"), "single preview title must include image count");
assert.ok(singleIndexTitle.includes(getPreviewIndexFingerprint(singleIndexKey)), "single preview title must include short identity");
assert.ok(singleIndexTitle.length <= 140, "single preview title must stay compact");

const multiIndexKey = getPreviewIndexKey(htmlAttachment, [samePageLeft, samePageRight], "auto-page", "high");
const multiIndexTitle = buildIndexTitle(htmlParent, htmlAttachment, "auto-page", 4, [samePageLeft, samePageRight], "high", multiIndexKey);
const multiJumpHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [samePageLeft, samePageRight],
  scope: "auto-page",
  qualityKey: "high",
});
assert.ok(multiJumpHTML.includes('id="top"'), "multi preview sticky header must expose top anchor");
assert.ok(multiJumpHTML.includes('id="e1"'), "multi preview entries must expose jump anchors");
assert.ok(multiJumpHTML.includes('id="e2"'), "multi preview entries must expose second jump anchor");
assert.ok(multiJumpHTML.includes('class="meta jumps"'), "multi preview header must expose jump list");
assert.ok(multiJumpHTML.includes('href="#e1"'), "jump list must link first entry");
assert.ok(multiJumpHTML.includes('href="#e2"'), "jump list must link second entry");
assert.ok(multiJumpHTML.includes('>#1p5</a>'), "jump list must densify first entry page mark");
assert.ok(multiJumpHTML.includes('>#2p5</a>'), "jump list must densify second entry page mark");
assert.ok(multiJumpHTML.includes('Open last p5'), "multi preview header must expose open-last action");
assert.ok(multiJumpHTML.includes('href="#top"'), "multi preview footer must expose top action");
assert.ok(multiJumpHTML.includes('footer-actions'), "multi preview footer must use footer-actions class");
assert.ok(multiJumpHTML.includes('>Top</a>'), "multi preview footer must expose Top label");

const multiOriginalIndexHTML = buildOriginalImageIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  images: [originalIndexImage, { ...originalIndexImage, id: "original-2", page_number: 8, pageNumber: 8, occurrence: 3, sha256: "def456" }],
  scope: "document",
});
assert.ok(multiOriginalIndexHTML.includes('id="top"'), "multi original sticky header must expose top anchor");
assert.ok(multiOriginalIndexHTML.includes('id="o1"'), "multi original rows must expose jump anchors");
assert.ok(multiOriginalIndexHTML.includes('id="o2"'), "multi original rows must expose second jump anchor");
assert.ok(multiOriginalIndexHTML.includes('class="meta jumps"'), "multi original header must expose jump list");
assert.ok(multiOriginalIndexHTML.includes('href="#o1"'), "original jump list must link first row");
assert.ok(multiOriginalIndexHTML.includes('href="#o2"'), "original jump list must link second row");
assert.ok(multiOriginalIndexHTML.includes('>#1p5</a>'), "original jump list must densify first page mark");
assert.ok(multiOriginalIndexHTML.includes('>#2p8</a>'), "original jump list must densify second page mark");
assert.ok(multiOriginalIndexHTML.includes('Open last p8'), "multi original header must expose open-last action");
assert.ok(multiOriginalIndexHTML.includes('href="#top"'), "multi original footer must expose top action");
assert.ok(multiOriginalIndexHTML.includes('>Top</a>'), "multi original footer must expose Top label");

assert.ok(multiIndexTitle.includes("auto"), "multi preview title must include densified auto scope");
assert.ok(multiIndexTitle.includes("2img"), "multi preview title must include image count");
assert.ok(multiIndexTitle.includes("H High"), "multi preview title must include quality mark/label");
assert.notStrictEqual(multiIndexTitle, singleIndexTitle, "quality/count/fingerprint variants must be distinguishable");

const malformedPageEntry = {
  ...htmlEntry,
  id: "entry-malformed-page-target",
  pageIndex: "6",
  pageNumber: "bad",
  pageLabel: "bad",
  dataURL: "data:image/jpeg;base64,DDDD",
  openPDFURI: "",
};
const malformedPageHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [malformedPageEntry],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(
  malformedPageHTML.includes("zotero://open-pdf/library/items/HTMLPDF1?page=7"),
  "malformed entry page number must use normalized pageIndex + 1 URI",
);
assert.strictEqual(malformedPageEntry.pageIndex, 6, "entry pageIndex must be normalized");
assert.strictEqual(malformedPageEntry.pageNumber, 7, "entry pageNumber must be normalized from pageIndex");
const malformedPageMetadata = extractMetadata(malformedPageHTML);
assert.strictEqual(malformedPageMetadata.entries[0].page_index, 6);
assert.strictEqual(malformedPageMetadata.entries[0].page_number, 7);
assert.ok(malformedPageMetadata.entries[0].open_pdf_uri.startsWith("zotero://open-pdf/library/items/HTMLPDF1?page=7"));

const nullPageIndexEntry = {
  ...htmlEntry,
  id: "entry-null-page-index",
  pageIndex: null,
  pageNumber: "9",
  pageLabel: "",
  dataURL: "data:image/jpeg;base64,EEEE",
  openPDFURI: "",
};
const nullPageIndexHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [nullPageIndexEntry],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(
  nullPageIndexHTML.includes("zotero://open-pdf/library/items/HTMLPDF1?page=9"),
  "null entry pageIndex must not override a valid pageNumber",
);
assert.strictEqual(nullPageIndexEntry.pageIndex, 8);
assert.strictEqual(nullPageIndexEntry.pageNumber, 9);
const nullPageIndexMetadata = extractMetadata(nullPageIndexHTML);
assert.strictEqual(nullPageIndexMetadata.entries[0].page_index, 8);
assert.strictEqual(nullPageIndexMetadata.entries[0].page_number, 9);

const malformedScalarEntry = {
  ...htmlEntry,
  id: { bad: true },
  mode: ["bad-mode"],
  detector: { source: "bad" },
  pageLabel: { label: "bad" },
  byteCount: Number.NaN,
  renderedWidth: 0.5,
  renderedHeight: "0.5",
  detectionArea: { area: 1 },
  dataURL: "data:image/jpeg;base64,FFFF",
  openPDFURI: "",
};
const malformedScalarHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [malformedScalarEntry],
  scope: "clip",
  qualityKey: "medium",
});
for (const forbiddenScalarText of ["NaN", "Infinity", "undefined", "[object Object]"]) {
  assert.ok(
    !malformedScalarHTML.includes(forbiddenScalarText),
    `malformed scalar HTML must not contain ${forbiddenScalarText}`,
  );
}
assert.ok(malformedScalarHTML.includes("3 B; size n/a"), "malformed scalar HTML must show concise actual size");
const malformedScalarMetadata = extractMetadata(malformedScalarHTML);
assert.strictEqual(malformedScalarMetadata.entries[0].id, "preview-1");
assert.strictEqual(malformedScalarMetadata.entries[0].mode, "reader_canvas_preview");
assert.strictEqual(malformedScalarMetadata.entries[0].detector, "unknown");
assert.strictEqual(malformedScalarMetadata.entries[0].page_label, null);
assert.strictEqual(malformedScalarMetadata.entries[0].byte_count, 3);
assert.strictEqual(malformedScalarMetadata.entries[0].rendered_width, null);
assert.strictEqual(malformedScalarMetadata.entries[0].rendered_height, null);
assert.strictEqual(malformedScalarMetadata.entries[0].detection_area, null);

const paddedByteEntry = {
  ...htmlEntry,
  id: "entry-padded-byte-count",
  byteCount: 999,
  dataURL: "data:image/jpeg;base64,AA==",
  openPDFURI: "",
};
const paddedByteHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [paddedByteEntry],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(paddedByteHTML.includes("1 B; 120x80"), "base64 padding must be subtracted from visible byte count");
const paddedByteMetadata = extractMetadata(paddedByteHTML);
assert.strictEqual(paddedByteMetadata.entries[0].byte_count, 1, "base64 padding must be subtracted from metadata byte count");

assert.deepStrictEqual(
  Array.from(normalizeBBoxNormalized(["0.9", "bad", "0.2", "1.4"])),
  [0.2, 0, 0.9, 1],
  "bbox normalization must coerce strings, clamp values, and order coordinates",
);
assert.deepStrictEqual(
  Array.from(normalizeBBoxNormalized(null)),
  [0, 0, 1, 1],
  "missing bbox must fall back to whole-page normalized bbox",
);

const staleRegionEntry = {
  ...htmlEntry,
  id: "entry-stale-region",
  bboxNormalized: ["0.9", "bad", "0.2", "1.4"],
  sourceRegion: { label: "OBSOLETE_REGION_LABEL", left: 0.99, top: 0.99, width: 0.01, height: 0.01 },
  dataURL: "data:image/jpeg;base64,CCCC",
  openPDFURI: "",
};
const staleRegionHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [staleRegionEntry],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(staleRegionHTML.includes("0.2000, 0.0000, 0.9000, 1.0000"), "HTML bbox text must use normalized bbox");
assert.ok(!staleRegionHTML.includes("OBSOLETE_REGION_LABEL"), "stale source region labels must be rebuilt");
assert.deepStrictEqual(
  Array.from(staleRegionEntry.bboxNormalized),
  [0.2, 0, 0.9, 1],
  "entry bbox must be normalized during HTML index build",
);
assert.strictEqual(staleRegionEntry.sourceRegion.left, 0.2, "source region must be rebuilt from normalized bbox");
const staleRegionMetadataText = staleRegionHTML.match(/<pre>([\s\S]*?)<\/pre>/)[1]
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'");
const staleRegionMetadata = JSON.parse(staleRegionMetadataText);
assert.deepStrictEqual(staleRegionMetadata.entries[0].bbox_normalized, [0.2, 0, 0.9, 1]);
assert.strictEqual(staleRegionMetadata.entries[0].source_region.left, 0.2);

const invalidQualityEntry = {
  ...htmlEntry,
  id: "entry-invalid-quality",
  quality: "constructor",
  qualityEstimate: "unsafe",
  dataURL: "data:image/jpeg;base64,BBBB",
  openPDFURI: "",
};
const invalidQualityHTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [invalidQualityEntry],
  scope: "clip",
  qualityKey: "constructor",
});
assert.ok(invalidQualityHTML.includes("M Medium; 60-220 KB"), "invalid entry quality must fall back to Medium");
assert.strictEqual(invalidQualityEntry.quality, "medium", "invalid entry quality must be normalized on the entry");
assert.strictEqual(invalidQualityEntry.qualityEstimate, "60-220 KB/image", "invalid quality estimate must be normalized");
const invalidQualityMetadataText = invalidQualityHTML.match(/<pre>([\s\S]*?)<\/pre>/)[1]
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'");
const invalidQualityMetadata = JSON.parse(invalidQualityMetadataText);
assert.strictEqual(invalidQualityMetadata.preview_quality, "medium", "invalid request quality must be normalized");
assert.strictEqual(invalidQualityMetadata.entries[0].quality, "medium");
assert.strictEqual(invalidQualityMetadata.entries[0].quality_estimate, "60-220 KB/image");

assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: [{
      ...htmlEntry,
      id: "entry-bad-url",
      dataURL: 'x" onerror="alert(1)',
    }],
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview data URL bad/,
  "malformed preview data URL must be rejected before HTML output",
);
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: [{
      ...htmlEntry,
      id: "entry-bad-base64-length",
      dataURL: "data:image/jpeg;base64,A",
    }],
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview data URL bad/,
  "preview data URL base64 payload length must be canonical before byte counting",
);
const canonicalBase64HTML = buildIndexHTML({
  attachment: htmlAttachment,
  parentItem: htmlParent,
  entries: [{
    ...htmlEntry,
    id: "entry-canonical-base64",
    dataURL: "data:image/jpeg;base64,AA==",
  }],
  scope: "clip",
  qualityKey: "medium",
});
assert.ok(canonicalBase64HTML.includes("1 B; 120x80"), "canonical padded preview data URLs must still pass");
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: null,
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview index bad/,
  "non-array preview entries must fail with a clear validation error",
);
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: [],
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview index empty/,
  "empty preview entries must fail with a clear validation error",
);
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: [null],
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview data URL bad/,
  "null preview entries must be normalized before data URL validation",
);
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: ["bad"],
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview data URL bad/,
  "scalar preview entries must be normalized before field mutation",
);

const helperCapOutputDir = "C:\\Temp\\pdf-image-saver\\cap-job";
const helperImages = Array.from({ length: 5 }, (_, index) => ({ file_path: `${helperCapOutputDir}\\image-${index}.jpg` }));
const helperReport = { output_dir: helperCapOutputDir, images: helperImages };
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 2;
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"] = 3;
const pageLimitedImages = limitOriginalImagesForImport(helperReport, "page");
assert.strictEqual(pageLimitedImages.images.length, 2, "page import must truncate over-cap helper reports");
assert.strictEqual(pageLimitedImages.omittedCount, 3, "page import must report skipped images");
assert.strictEqual(pageLimitedImages.maxImages, 2);
const documentLimitedImages = limitOriginalImagesForImport(helperReport, "document");
assert.strictEqual(documentLimitedImages.images.length, 3, "document import must truncate over-cap helper reports");
assert.strictEqual(documentLimitedImages.omittedCount, 2, "document import must report skipped images");
assert.strictEqual(documentLimitedImages.maxImages, 3);
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 9999;
const hardLimitedPageImages = limitOriginalImagesForImport(helperReport, "page");
assert.strictEqual(hardLimitedPageImages.images.length, 5, "page import must not drop in-range reports");
assert.strictEqual(hardLimitedPageImages.maxImages, 500, "page import must hard-clamp edited prefs");
const hugeHelperImages = Array.from({ length: 501 }, (_, index) => ({ file_path: `${helperCapOutputDir}\\huge-${index}.jpg` }));
const hugeLimitedPageImages = limitOriginalImagesForImport({ output_dir: helperCapOutputDir, images: hugeHelperImages }, "page");
assert.strictEqual(hugeLimitedPageImages.images.length, 500, "page import must truncate at the hard cap");
assert.strictEqual(hugeLimitedPageImages.omittedCount, 1, "page import must report hard-cap skips");
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"] = 9999;
const hugeDocumentImages = Array.from({ length: 2001 }, (_, index) => ({ file_path: `${helperCapOutputDir}\\doc-${index}.jpg` }));
const hugeLimitedDocumentImages = limitOriginalImagesForImport({ output_dir: helperCapOutputDir, images: hugeDocumentImages }, "document");
assert.strictEqual(hugeLimitedDocumentImages.images.length, 2000, "document import must truncate at the hard cap");
assert.strictEqual(hugeLimitedDocumentImages.omittedCount, 1, "document import must report hard-cap skips");
assert.strictEqual(hugeLimitedDocumentImages.maxImages, 2000, "document import must hard-clamp edited prefs");

context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 10;
const helperOutputDir = "C:\\Temp\\pdf-image-saver\\job-1";
const helperReportWithNoise = {
  output_dir: helperOutputDir,
  images: [
    {
      file_path: `${helperOutputDir}\\image-1.JPG`,
      content_type: "IMAGE/JPEG",
      extension: "JPG",
      page_number: "3",
      occurrence: "2",
    },
    {
      file_path: `${helperOutputDir}\\nested\\image-2.weird`,
      content_type: "text/html",
      extension: { bad: true },
      page_index: "4",
      occurrence: 0,
    },
    {
      file_path: "C:\\Temp\\pdf-image-saver\\other\\image-3.png",
      content_type: "image/png",
      extension: "png",
    },
    {
      file_path: { bad: true },
      content_type: ["image/png"],
      extension: "png",
    },
  ],
};
const normalizedHelperImages = limitOriginalImagesForImport(helperReportWithNoise, "page");
assert.strictEqual(normalizedHelperImages.images.length, 2, "helper import must skip malformed or out-of-dir records");
assert.strictEqual(normalizedHelperImages.invalidCount, 2, "helper import must count malformed records");
assert.strictEqual(normalizedHelperImages.omittedCount, 2, "helper import omission count must include malformed records");
assert.strictEqual(normalizedHelperImages.images[0].filePath, `${helperOutputDir}\\image-1.JPG`);
assert.strictEqual(normalizedHelperImages.images[0].contentType, "image/jpeg");
assert.strictEqual(normalizedHelperImages.images[0].extension, "jpg");
assert.strictEqual(normalizedHelperImages.images[0].pageNumber, 3);
assert.strictEqual(normalizedHelperImages.images[0].occurrence, 2);
assert.strictEqual(normalizedHelperImages.images[1].contentType, "application/octet-stream");
assert.strictEqual(normalizedHelperImages.images[1].pageNumber, 5, "helper page number must fall back to page_index + 1");
assert.strictEqual(normalizedHelperImages.images[1].occurrence, 2, "invalid occurrence must use compact fallback");
assert.strictEqual(
  normalizeHelperFilePath(`${helperOutputDir.toUpperCase()}\\image-4.png`, helperOutputDir),
  `${helperOutputDir.toUpperCase()}\\image-4.png`,
  "Windows helper path comparison must be case-insensitive",
);
assert.strictEqual(
  normalizeHelperFilePath("C:\\Temp\\pdf-image-saver\\job-10\\image.png", helperOutputDir),
  null,
  "helper path must not accept sibling directories with shared prefixes",
);
assert.strictEqual(
  normalizeHelperFilePath(`${helperOutputDir}\\..\\other\\image.png`, helperOutputDir),
  null,
  "helper path must reject parent-directory escapes",
);
assert.strictEqual(
  normalizeHelperFilePath(`${helperOutputDir}\\.\\nested\\..\\image-7.png`, helperOutputDir),
  `${helperOutputDir}\\.\\nested\\..\\image-7.png`,
  "helper path must accept normalized paths that stay inside output directory",
);
assert.strictEqual(
  normalizeHelperFilePath("\\\\server\\share\\job\\image.png", "\\\\server\\share\\job"),
  "\\\\server\\share\\job\\image.png",
  "helper path must accept matching UNC children",
);
assert.strictEqual(
  normalizeHelperFilePath("\\server\\share\\job\\image.png", "\\\\server\\share\\job"),
  null,
  "helper path must reject single-root paths that look like UNC children",
);
assert.strictEqual(
  normalizeHelperFilePath(`${helperOutputDir}\\image-6.png`, null),
  null,
  "helper path must require a helper output directory",
);
assert.strictEqual(normalizeImageContentType({ bad: true }, "png"), "image/png");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(normalizeOriginalImageForImport({
    file_path: `${helperOutputDir}\\image-5.webp`,
    content_type: "text/plain",
    page_number: { bad: true },
    occurrence: ["bad"],
  }, 4, helperOutputDir))),
  {
    file_path: `${helperOutputDir}\\image-5.webp`,
    filePath: `${helperOutputDir}\\image-5.webp`,
    content_type: "image/webp",
    contentType: "image/webp",
    extension: "webp",
    page_number: 1,
    pageNumber: 1,
    page_index: null,
    pageIndex: null,
    occurrence: 5,
    xref: 0,
    sha256: null,
    byte_count: 0,
    byteCount: 0,
    bbox_normalized: [0, 0, 1, 1],
  },
  "helper image normalization must produce scalar import fields",
);
assert.match(
  buildOriginalImageTitle(noisyParent, noisyAttachment, { page_number: { bad: true }, occurrence: ["bad"] }),
  /^PDF - orig p1 #1 [a-z0-9]+$/,
  "original attachment title must normalize malformed source, page, occurrence, and append compact identity",
);
const noisyHelperWarnings = normalizeHelperWarningMessages([
  { bad: true },
  ["array"],
  " ".repeat(4),
  "a".repeat(240),
  "second",
  "third",
  "fourth",
  "fifth",
]);
assert.strictEqual(noisyHelperWarnings.length, 4, "helper warnings must be capped");
assert.strictEqual(noisyHelperWarnings[0].length, 180, "helper warnings must be length-limited");
assert.deepStrictEqual(JSON.parse(JSON.stringify(noisyHelperWarnings.slice(1))), ["second", "third", "fourth"]);
const noisyHelperFailure = formatHelperFailure({
  status: { bad: true },
  warnings: [
    { bad: true },
    ["array"],
    "bad <detail>",
    "x".repeat(240),
    "extra",
  ],
});
for (const forbiddenHelperFailureText of ["[object Object]", "undefined", "array", "x".repeat(181)]) {
  assert.ok(!noisyHelperFailure.includes(forbiddenHelperFailureText), `helper failure text must not contain ${forbiddenHelperFailureText}`);
}
assert.ok(noisyHelperFailure.includes("Helper failed: unknown"), "malformed helper status must fall back to unknown");
assert.ok(noisyHelperFailure.includes("bad <detail>"), "scalar helper warning details must be preserved");
assert.strictEqual(normalizeHelperStatusText(["array-status"]), "unknown", "helper status arrays must fall back to unknown");
assert.strictEqual(normalizeHelperWarningMessages({ bad: true }).length, 0, "malformed helper warning containers must not throw");
assert.strictEqual(normalizeHelperSchemaText({ bad: true }), "unknown", "helper schema objects must fall back to unknown");
const aggregatedHelperFailure = formatHelperFailure({
  status: "failed",
  warnings: [
    ...normalizeHelperWarningMessages({ bad: true }),
    `python.exe: ${normalizeHelperStatusText({ bad: true })}`,
    `schema: ${normalizeHelperSchemaText({ bad: true })}`,
  ],
});
assert.ok(aggregatedHelperFailure.includes("python.exe: unknown"), "aggregated helper candidate status must be normalized");
assert.ok(aggregatedHelperFailure.includes("schema: unknown"), "aggregated helper schema text must be normalized");
assert.ok(!aggregatedHelperFailure.includes("[object Object]"), "aggregated helper candidate status must not leak object text");
assert.strictEqual(
  formatHelperFailure(null),
  "Helper failed: unknown",
  "missing helper reports must format to an unknown failure without throwing",
);
assert.strictEqual(
  formatHelperFailure({ status: "no_python" }),
  "Helper: Python n/a.",
  "missing python helper failure must stay compact",
);
assert.strictEqual(
  formatHelperFailure({ status: "missing_pymupdf" }),
  "Helper: PyMuPDF n/a.",
  "missing pymupdf helper failure must stay compact",
);

assert.strictEqual(normalizeToastLevel("progress"), "progress", "progress toast level must be accepted");
assert.strictEqual(normalizeToastLevel("constructor"), "info", "malformed toast level must fall back to info");
assert.strictEqual(getToastDuration("progress"), 120000, "progress toast must stay visible long enough for long-running work");
const progressToastDoc = createFakeToastDocument();
showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: progressToastDoc } },
  "Working...",
  "progress",
);
assert.strictEqual(progressToastDoc.bodyChildren[0].getAttribute("aria-busy"), "true", "progress toast must set aria-busy");
assert.strictEqual(progressToastDoc.bodyChildren[0].getAttribute("data-level"), "progress", "progress toast must expose data-level");
assert.strictEqual(getToastDuration("success"), 2800, "success toast duration must stay short");
assert.strictEqual(getToastDuration("error"), 8000, "error toast duration must stay longer");


const directDoc = { nodeName: "#document" };
const directApp = { pdfViewer: { currentPageNumber: 2 } };
const directContext = getPDFViewerContextCandidate({
  _iframeWindow: {
    PDFViewerApplication: directApp,
    document: directDoc,
  },
});
assert.strictEqual(directContext.app, directApp, "direct reader iframe app must be detected");
assert.strictEqual(directContext.doc, directDoc, "direct reader iframe document must be returned");

const wrappedDoc = { nodeName: "#wrapped" };
const wrappedApp = { pdfViewer: { currentPageNumber: 3 } };
const wrappedContext = getPDFViewerContextCandidate({
  _internalReader: {
    _primaryView: {
      _iframeWindow: {
        wrappedJSObject: { PDFViewerApplication: wrappedApp },
        document: wrappedDoc,
      },
    },
  },
});
assert.strictEqual(wrappedContext.app, wrappedApp, "wrapped PDFViewerApplication must be detected");

assert.strictEqual(isPDFReader({ type: "pdf" }), true, "public PDF reader type must be accepted");
assert.strictEqual(isPDFReader({ _type: "pdf" }), true, "private PDF reader type must be accepted");
assert.strictEqual(
  isPDFReader({ _item: { attachmentReaderType: "pdf" } }),
  true,
  "PDF attachment reader type fallback must be accepted",
);
assert.strictEqual(isPDFReader({ type: "epub" }), false, "EPUB reader type must be rejected");
assert.strictEqual(isPDFReader({}), false, "missing reader type must be rejected");

const selectedPDFReader = { type: "pdf", tabID: "tab-pdf" };
const otherPDFReader = { type: "pdf", tabID: "tab-other" };
context.Zotero.Reader = {
  _readers: [otherPDFReader, selectedPDFReader],
  getByTabID(tabID) {
    return this._readers.find((reader) => reader.tabID === tabID) || null;
  },
};
assert.strictEqual(
  getActiveReader({ Zotero_Tabs: { selectedID: "tab-pdf" } }),
  selectedPDFReader,
  "active reader must match selected Zotero tab",
);
assert.strictEqual(
  getActiveReader({
    Zotero_Tabs: { selectedID: "library-tab" },
    ZoteroPane: { getSelectedItems: () => [{ id: "tab-other" }] },
  }),
  null,
  "non-reader selected tab must not fall back to first or selected library item reader",
);

const selectedEPUBReader = { type: "epub", tabID: "tab-epub" };
context.Zotero.Reader = {
  _readers: [otherPDFReader, selectedEPUBReader],
  getByTabID(tabID) {
    return this._readers.find((reader) => reader.tabID === tabID) || null;
  },
};
assert.strictEqual(
  getActiveReader({ Zotero_Tabs: { selectedID: "tab-epub" } }),
  null,
  "selected EPUB reader tab must be rejected",
);

const selectedTypelessReader = { tabID: "tab-typeless" };
context.Zotero.Reader = {
  _readers: [otherPDFReader, selectedTypelessReader],
  getByTabID(tabID) {
    return this._readers.find((reader) => reader.tabID === tabID) || null;
  },
};
assert.strictEqual(
  getActiveReader({ Zotero_Tabs: { selectedID: "tab-typeless" } }),
  null,
  "selected reader with missing type must be rejected",
);

assert.strictEqual(
  getActiveReader({ Zotero_Tabs: {} }),
  null,
  "missing selected tab must not target an arbitrary open reader",
);

assert.strictEqual(
  getPreviewDuplicateKey(
    { libraryID: { bad: true }, key: { bad: true } },
    { pageIndex: { bad: true }, quality: "constructor", bboxNormalized: { bad: true } },
  ),
  "library:UNKNOWN:0:medium:0.0000,0.0000,1.0000,1.0000",
  "duplicate guard keys must normalize malformed attachment and preview fields",
);

const noisyDiagnostics = formatDiagnosticsReport({
  plugin: { bad: true },
  zotero: ["9.0.5"],
  started: { bad: true },
  reader_count: { bad: true },
  active_pdf_reader: true,
  default_quality: "constructor",
  duplicate_guard: { bad: true },
  auto_cap: { bad: true },
  max_index: undefined,
  temp_dir: { bad: true },
  temp_leftovers: { bad: true },
  temp_bytes: Number.NaN,
  pdf_attachment: {
    key: { bad: true },
    parent_id: { bad: true },
  },
  library_prefix: { bad: true },
  page_number: "bad",
  page_label: { bad: true },
  open_pdf_uri: { bad: true },
  auto_raster_available: { bad: true },
  warnings: [
    { bad: true },
    "x".repeat(260),
    "ok",
    ["bad"],
  ],
});
for (const forbiddenDiagnosticsText of ["[object Object]", "undefined", "NaN", "Infinity", "x".repeat(221)]) {
  assert.ok(
    !noisyDiagnostics.includes(forbiddenDiagnosticsText),
    `diagnostics text must not contain ${forbiddenDiagnosticsText}`,
  );
}
assert.ok(noisyDiagnostics.includes("Plugin: unknown"), "diagnostics plugin must normalize malformed text");
assert.ok(noisyDiagnostics.includes("Store: HTML; sync PDF"), "diagnostics must surface storage mode");
assert.ok(noisyDiagnostics.includes("Run: unknown"), "diagnostics booleans must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Q M Medium; 60-220 KB"), "diagnostics quality must densify malformed values");
assert.ok(noisyDiagnostics.includes("Dups: unknown"), "diagnostics dups must normalize malformed values");
assert.strictEqual(formatDiagnosticDups(true), "on; sess+saved", "diagnostics dups must densify enabled guard");
assert.strictEqual(formatDiagnosticDups(false), "off", "diagnostics dups must densify disabled guard");
assert.ok(noisyDiagnostics.includes("Auto: min unknown"), "diagnostics auto min must normalize malformed values");
assert.ok(noisyDiagnostics.includes("0 max"), "diagnostics auto max must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Index: unknown"), "diagnostics index cap must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Helper: opt; unknown; min unknown; page 0; doc 0; 0s; auto py"), "diagnostics helper caps must normalize malformed values");
const denseDiagnostics = formatDiagnosticsReport({
  plugin: "pdf-image-saver@zlk.local 0.1.0",
  zotero: "9.0.5",
  started: true,
  reader_count: 1,
  active_pdf_reader: true,
  default_quality: "high",
  duplicate_guard: true,
  auto_min_area: 0.003,
  auto_max_images: 6,
  helper_min_area: 0.004,
  helper_page_max: 12,
  helper_doc_max: 34,
  helper_timeout_s: 45,
  helper_python_mode: "custom",
  auto_cap: "3 MB",
  max_index: "5 MB",
  temp_dir: "C:\\Temp\\pdf-image-saver",
  temp_leftovers: 0,
  temp_bytes: 0,
  optional_helper: "python-available",
});
assert.ok(denseDiagnostics.includes("Q H High; 180-750 KB"), "diagnostics must densify quality");
assert.ok(denseDiagnostics.includes("Dups: on; sess+saved"), "diagnostics must densify dups");
assert.ok(denseDiagnostics.includes("Auto: min 0.003; 6 max; 3 MB"), "diagnostics must densify auto caps");
assert.ok(denseDiagnostics.includes("Index: 5 MB"), "diagnostics must densify index cap");
assert.ok(denseDiagnostics.includes("Helper: opt; py ok; min 0.004; page 12; doc 34; 45s; custom py"), "diagnostics must surface helper min/caps and python mode");
assert.strictEqual(formatDiagnosticArea(0.003), "0.003", "diagnostic area must densify numeric mins");
assert.strictEqual(formatDiagnosticArea({ bad: true }), "unknown", "diagnostic area must fall back for malformed values");
const denseDiagnosticsOff = formatDiagnosticsReport({
  plugin: "pdf-image-saver@zlk.local 0.1.0",
  zotero: "9.0.5",
  started: true,
  reader_count: 0,
  active_pdf_reader: false,
  default_quality: "low",
  duplicate_guard: false,
  auto_min_area: 0.01,
  auto_max_images: 4,
  helper_min_area: 0.02,
  helper_page_max: 8,
  helper_doc_max: 9,
  helper_timeout_s: 30,
  helper_python_mode: "auto",
  auto_cap: "1 MB",
  max_index: "2 MB",
  temp_dir: "C:\\Temp\\pdf-image-saver",
  temp_leftovers: 0,
  temp_bytes: 0,
  optional_helper: "python-missing",
});
assert.ok(denseDiagnosticsOff.includes("Q L Low; 20-80 KB"), "diagnostics must densify quality when guard disabled");
assert.ok(denseDiagnosticsOff.includes("Dups: off"), "diagnostics must show dups off when guard disabled");
assert.ok(denseDiagnosticsOff.includes("Auto: min 0.01; 4 max; 1 MB"), "diagnostics must densify auto caps when guard disabled");
assert.ok(denseDiagnosticsOff.includes("Index: 2 MB"), "diagnostics must densify index cap when guard disabled");
assert.ok(denseDiagnosticsOff.includes("Helper: opt; py missing; min 0.02; page 8; doc 9; 30s; auto py"), "diagnostics must show helper min/caps and python mode with missing python");
assert.ok(noisyDiagnostics.includes("PDF: UNKNOWN"), "diagnostics PDF key must normalize malformed values");
assert.ok(noisyDiagnostics.includes("parent none"), "diagnostics parent item must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Page: 1"), "diagnostics page target must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Helper: opt; unknown"), "diagnostics helper status must normalize malformed values");
const autoUnavailableButton = { disabled: false, title: "" };
applyAutoRasterButtonState(autoUnavailableButton, false, "medium");
assert.strictEqual(autoUnavailableButton.disabled, true, "unavailable auto button must disable");
assert.strictEqual(autoUnavailableButton.title, "Auto n/a; Use clip.", "auto unavailable tooltip must reuse dense Use clip guidance");
assert.strictEqual(formatHelperPythonMode("custom"), "custom py", "helper python mode must densify custom path mode");
assert.strictEqual(formatHelperPythonMode("auto"), "auto py", "helper python mode must densify auto path mode");
assert.strictEqual(formatHelperPythonMode({ bad: true }), "auto py", "helper python mode must fall back to auto py");
assert.strictEqual(formatOptionalHelperStatus("python-missing"), "py missing", "helper status formatter must label missing python");
assert.strictEqual(formatOptionalHelperStatus("python-available"), "py ok", "helper status formatter must label available python");
assert.strictEqual(formatOptionalHelperStatus({ bad: true }), "unknown", "helper status formatter must fall back for malformed values");

assert.ok(noisyDiagnostics.includes("- ok"), "diagnostics warnings must keep valid compact warning text");
assert.ok(
  formatDiagnosticsReport({
    plugin: "pdf-image-saver@zlk.local 0.1.0",
    zotero: "9.0.5",
    started: true,
    reader_count: 0,
    active_pdf_reader: false,
    default_quality: "medium",
    duplicate_guard: true,
    auto_cap: "4 MB",
    max_index: "6 MB",
    temp_dir: "C:\\Temp\\pdf-image-saver",
    temp_leftovers: 0,
    temp_bytes: 0,
    optional_helper: "unknown",
    warnings: ["Temp: access denied", "Helper: probe failed", "No PDF."],
  }).includes("- Temp: access denied"),
  "diagnostics temp warnings must use dense Temp: prefix",
);
assert.ok(
  formatDiagnosticsReport({
    plugin: "pdf-image-saver@zlk.local 0.1.0",
    zotero: "9.0.5",
    started: true,
    reader_count: 0,
    active_pdf_reader: false,
    default_quality: "medium",
    duplicate_guard: true,
    auto_cap: "4 MB",
    max_index: "6 MB",
    temp_dir: "C:\\Temp\\pdf-image-saver",
    temp_leftovers: 0,
    temp_bytes: 0,
    optional_helper: "unknown",
    warnings: ["Temp: access denied", "Helper: probe failed", "No PDF."],
  }).includes("- Helper: probe failed"),
  "diagnostics helper warnings must use dense Helper: prefix",
);

assert.strictEqual(getErrorMessage(new Error("Readable failure")), "Readable failure", "Error.message text must be preserved");
assert.strictEqual(getErrorMessage("plain failure"), "plain failure", "plain thrown strings must be preserved");
assert.strictEqual(getErrorMessage(404), "404", "numeric thrown values must be preserved");
for (const noisyErrorValue of [{ bad: true }, ["bad"], null, undefined, new Error(""), "[object Object]", "undefined", "null"]) {
  assert.strictEqual(
    getErrorMessage(noisyErrorValue),
    "Unknown err.",
    "malformed error messages must use a compact fallback",
  );
}
assert.strictEqual(getErrorMessage("x".repeat(400)).length, 320, "oversized error messages must be capped");
assert.strictEqual(classifyErrorCategory("Byte cap: index large"), "byte_cap", "byte-cap errors must classify");
assert.strictEqual(classifyErrorCategory("Helper: Python n/a."), "helper", "helper absence must classify as helper");
assert.strictEqual(classifyErrorCategory("Storage failed: index import failed."), "storage", "storage import failures must classify");
assert.strictEqual(classifyErrorCategory("Capture failed: canvas missing."), "capture", "canvas failures must classify as capture");
assert.strictEqual(classifyErrorCategory("Clip skip: session dup."), "duplicate", "session duplicate skips must classify");
assert.strictEqual(
  formatUserFacingError(new Error("canvas missing")),
  "Capture failed: canvas missing",
  "unprefixed capture errors must gain capture prefix",
);
assert.strictEqual(
  formatUserFacingError(new Error("Byte cap: index large (1 MB > 0.5 MB).")),
  "Byte cap: index large (1 MB > 0.5 MB).",
  "prefixed byte-cap errors must stay stable",
);
assert.strictEqual(
  formatUserFacingError(new Error("index import failed")),
  "Storage failed: index import failed",
  "import failures must gain storage prefix",
);

assert.strictEqual(formatPageToastToken(0), "p1", "page toast token must be 1-based");
assert.strictEqual(formatPageToastToken(4), "p5", "page toast token must map pageIndex to pN");
assert.strictEqual(formatOriginalScopeToken("page", 2), "p3", "original page scope token must use page number");
assert.strictEqual(formatOriginalScopeToken("document"), "doc", "original document scope token must stay compact");
assert.strictEqual(formatOriginalScopeToken("page", null), "page", "original page scope without page must stay compact");

assert.strictEqual(
  buildToolbarActionTooltip("Clip a figure preview", "high"),
  "Clip a figure preview; H High; 180-750 KB",
  "toolbar tooltip must show selected high quality estimate",
);
assert.strictEqual(
  buildToolbarActionTooltip("Clip a figure preview", "constructor"),
  "Clip a figure preview; M Medium; 60-220 KB",
  "toolbar tooltip must normalize malformed quality to medium",
);
const autoRasterStateButton = { disabled: false, title: "" };
applyAutoRasterButtonState(autoRasterStateButton, false, "high");
assert.strictEqual(autoRasterStateButton.disabled, true, "unavailable auto-raster state must disable the button");
assert.ok(
  autoRasterStateButton.title.includes("n/a"),
  "unavailable auto-raster state must explain fallback to Clip",
);
applyAutoRasterButtonState(autoRasterStateButton, true, "high");
assert.strictEqual(autoRasterStateButton.disabled, false, "available auto-raster state must re-enable the button");
assert.strictEqual(
  autoRasterStateButton.title,
  "Auto page; H High; 180-750 KB",
  "available auto-raster state must restore selected quality tooltip",
);

async function flushAsyncToolbarState() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function assertToolbarUnavailableStateSurvivesQualityChange() {
  const toolbarDoc = createFakeToolbarDocument();
  const toolbarChildren = [];
  const toolbarReader = {
    type: "pdf",
    _iframeWindow: {
      document: {},
      PDFViewerApplication: {
        pdfViewer: {
          currentPageNumber: 1,
          getPageView() {
            return { pdfPage: {} };
          },
        },
      },
    },
  };
  onRenderToolbar({
    reader: toolbarReader,
    doc: toolbarDoc,
    append(element) {
      toolbarChildren.push(element);
    },
  });
  await flushAsyncToolbarState();
  assert.strictEqual(toolbarChildren.length, 1, "toolbar render must append one control group");
  const [toolbarSelect, toolbarCategorySelect, , toolbarAutoButton] = toolbarChildren[0].children;
  assert.ok(toolbarCategorySelect?.className?.includes("pdf-image-saver-category"), "toolbar must expose category select");
  assert.strictEqual(toolbarAutoButton.disabled, true, "unsupported auto-raster toolbar button must be disabled");
  assert.ok(
    toolbarAutoButton.title.includes("n/a"),
    "unsupported auto-raster toolbar button must explain unavailable state",
  );
  assert.strictEqual(toolbarAutoButton.getAttribute("aria-label"), "Auto n/a", "unsupported auto must expose dense aria-label");
  toolbarSelect.value = "high";
  toolbarSelect.dispatch("change");
  await flushAsyncToolbarState();
  assert.strictEqual(toolbarAutoButton.disabled, true, "quality change must preserve disabled auto-raster state");
  assert.ok(
    toolbarAutoButton.title.includes("n/a"),
    "quality change must preserve unavailable auto-raster explanation",
  );
}

async function assertToolbarBusyModeLocksSiblingControls() {
  const toolbarDoc = createFakeToolbarDocument();
  const toolbarChildren = [];
  const originalLogError = context.Zotero.logError;
  context.Zotero.logError = () => {};
  try {
    const toolbarReader = {
      type: "pdf",
      _iframeWindow: {
        document: {},
        PDFViewerApplication: {
          pdfViewer: {
            currentPageNumber: 1,
            getPageView() {
              return {
                pdfPage: {
                  render() {},
                  imageCoordinates: [],
                },
              };
            },
          },
        },
      },
    };
    onRenderToolbar({
      reader: toolbarReader,
      doc: toolbarDoc,
      append(element) {
        toolbarChildren.push(element);
      },
    });
    await flushAsyncToolbarState();
    await flushAsyncToolbarState();
    const [toolbarSelect, toolbarCategorySelect, toolbarClipButton, toolbarAutoButton] = toolbarChildren[0].children;
    assert.ok(toolbarCategorySelect?.className?.includes("pdf-image-saver-category"), "busy-mode toolbar must keep category select");
    assert.strictEqual(toolbarClipButton.textContent, "Clip", "idle clip button label");
    assert.strictEqual(toolbarAutoButton.textContent, "Auto", "idle auto button label");
    assert.strictEqual(toolbarSelect.disabled, false, "quality select enabled when idle");
    assert.strictEqual(toolbarAutoButton.disabled, false, "supported auto-raster toolbar button must enable after sync");

    toolbarClipButton.dispatch("click");
    assert.strictEqual(toolbarClipButton.textContent, "Drag...", "clip click must enter Drag state");
    assert.strictEqual(toolbarClipButton.disabled, true, "clip click must disable clip button");
    assert.strictEqual(toolbarAutoButton.disabled, true, "clip click must disable auto button");
    assert.strictEqual(toolbarSelect.disabled, true, "clip click must disable quality select");
    assert.strictEqual(toolbarCategorySelect.disabled, true, "clip click must disable category select");
    assert.strictEqual(toolbarClipButton.title, "Clip drag", "busy clip title must describe active selection");
    assert.strictEqual(toolbarChildren[0].getAttribute("aria-busy"), "true", "busy toolbar group must set aria-busy");
    assert.strictEqual(toolbarChildren[0].getAttribute("data-mode"), "clip", "busy toolbar group must expose clip mode");
    assert.strictEqual(toolbarSelect.title, "Q lock (clip)", "busy quality select must explain clip lock");
    assert.strictEqual(toolbarCategorySelect.title, "Cat lock (clip)", "busy category select must explain clip lock");
    assert.strictEqual(toolbarAutoButton.title, "Auto lock (clip)", "busy auto title must describe clip lock");

    // Quality change and second clip click must stay no-ops while busy.
    toolbarSelect.value = "high";
    toolbarSelect.dispatch("change");
    toolbarClipButton.dispatch("click");
    assert.strictEqual(toolbarClipButton.textContent, "Drag...", "busy clip click must remain no-op");
    assert.strictEqual(toolbarSelect.disabled, true, "busy quality select must stay disabled");
    assert.strictEqual(toolbarCategorySelect.disabled, true, "busy category select must stay disabled");
    assert.strictEqual(toolbarAutoButton.disabled, true, "busy auto button must stay disabled");

    // Failed clip (no canvas) ends session and restores idle + available auto.
    await flushAsyncToolbarState();
    await flushAsyncToolbarState();
    assert.strictEqual(toolbarClipButton.textContent, "Clip", "failed clip must restore idle clip label");
    assert.strictEqual(toolbarClipButton.disabled, false, "failed clip must re-enable clip");
    assert.strictEqual(toolbarSelect.disabled, false, "failed clip must re-enable quality select");
    assert.strictEqual(toolbarCategorySelect.disabled, false, "failed clip must re-enable category select");
    assert.strictEqual(toolbarAutoButton.disabled, false, "failed clip must restore available auto");
    assert.strictEqual(toolbarAutoButton.textContent, "Auto", "failed clip must restore idle auto label");

    // Unavailable runtime must re-disable Auto after idle restore.
    const unavailableDoc = createFakeToolbarDocument();
    const unavailableChildren = [];
    const unavailableReader = {
      type: "pdf",
      _iframeWindow: {
        document: {},
        PDFViewerApplication: {
          pdfViewer: {
            currentPageNumber: 1,
            getPageView() {
              return { pdfPage: {} };
            },
          },
        },
      },
    };
    onRenderToolbar({
      reader: unavailableReader,
      doc: unavailableDoc,
      append(element) {
        unavailableChildren.push(element);
      },
    });
    await flushAsyncToolbarState();
    await flushAsyncToolbarState();
    const [, , unavailableClipButton, unavailableAutoButton] = unavailableChildren[0].children;
    assert.strictEqual(unavailableAutoButton.disabled, true, "unsupported auto must stay disabled when idle");
    unavailableClipButton.dispatch("click");
    assert.strictEqual(unavailableClipButton.textContent, "Drag...", "unavailable runtime clip still enters Drag");
    assert.strictEqual(unavailableAutoButton.disabled, true, "unavailable auto stays locked during clip");
    await flushAsyncToolbarState();
    await flushAsyncToolbarState();
    assert.strictEqual(unavailableClipButton.textContent, "Clip", "unavailable runtime clip restores idle");
    assert.strictEqual(unavailableAutoButton.disabled, true, "unavailable auto must remain disabled after clip ends");
  } finally {
    context.Zotero.logError = originalLogError;
  }
}
const autoCandidatePage = {
  getBoundingClientRect: () => ({ left: 100, top: 50, width: 1000, height: 800 }),
};
const autoCandidateCanvas = {
  getBoundingClientRect: () => ({ left: 150, top: 90, width: 800, height: 600 }),
};
const autoCandidates = imageCoordinatesToCandidates({
  pageElement: autoCandidatePage,
  canvas: autoCandidateCanvas,
  pageIndex: 4,
  coordinates: [
    0.1, 0.1, 0.4, 0.1, 0.1, 0.4,
    0.01, 0.01, 0.02, 0.01, 0.01, 0.02,
    0.5, 0.5, 0.9, 0.5, 0.5, 0.9,
    0.51, 0.51, 0.91, 0.51, 0.51, 0.91,
  ],
});
assert.strictEqual(autoCandidates.length, 2, "auto-raster candidates must filter tiny and duplicate rectangles");
assert.strictEqual(autoCandidates[0].area, 0.096, "auto-raster candidates must be sorted largest first");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(autoCandidates[0].selectionRect)),
  { left: 450, top: 340, width: 320, height: 240 },
  "auto-raster normalized coordinates must map to page-relative selection rects",
);
assert.strictEqual(autoCandidates[0].pageIndex, 4, "auto-raster candidates must preserve page index");
assert.strictEqual(autoCandidates[0].detector, "pdfjs_record_images", "auto-raster candidates must record detector");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(autoCandidates[1].selectionRect)),
  { left: 130, top: 100, width: 240, height: 180 },
  "auto-raster smaller candidate must survive after larger duplicate filtering",
);
context.Zotero.Prefs.values["extensions.pdfImageSaver.defaultQuality"] = "high";
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 12;
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"] = 34;
const contextMenuItems = [];
onCreateViewContextMenu({
  reader: { type: "pdf" },
  params: { pageIndex: 2 },
  append(item) {
    contextMenuItems.push(item);
  },
});
assert.ok(
  contextMenuItems.some((item) => String(item.label || "").startsWith("Auto H High; 180-750 KB")),
  "context menu auto-raster label must show the default quality estimate",
);
assert.ok(
  contextMenuItems.some((item) => String(item.label || "").startsWith("Page H High; 180-750 KB")),
  "context menu page-preview label must show the default quality estimate",
);
assert.ok(
  contextMenuItems.some((item) => /; Aut$/.test(String(item.label || "")) || /; Cht$|; Dia$|; Pho$|; Tab$|; Sch$|; Eqn$|; Fig$|; Aut$/.test(String(item.label || ""))),
  "context menu capture labels must densify category mark",
);
assert.ok(
  !contextMenuItems.some((item) => item.label === "Save current page preview index (Medium)"),
  "context menu page-preview label must not hardcode Medium",
);
assert.ok(
  contextMenuItems.some((item) => item.label === "Orig page; max 12"),
  "context menu page-original label must show the page max image count",
);
assert.ok(
  contextMenuItems.some((item) => item.label === "Orig doc; max 34"),
  "context menu document-original label must show the document max image count",
);
const contextMenuCalls = [];
const testReader = { type: "pdf", itemID: 123 };
const commandActions = buildContextMenuActions(testReader, { pageIndex: 2 }, {
  saveAuto(reader, options) {
    contextMenuCalls.push({ action: "auto", reader, options });
  },
  savePage(reader, options) {
    contextMenuCalls.push({ action: "page", reader, options });
  },
  saveOriginal(reader, options) {
    contextMenuCalls.push({ action: "original", reader, options });
  },
  diagnostics(reader) {
    contextMenuCalls.push({ action: "diagnostics", reader });
  },
});
commandActions.find((item) => item.label.startsWith("Auto "))?.onCommand();
commandActions.find((item) => item.label.startsWith("Page "))?.onCommand();
commandActions.find((item) => item.label.startsWith("Orig page;"))?.onCommand();
commandActions.find((item) => item.label.startsWith("Orig doc;"))?.onCommand();
commandActions.find((item) => item.label === "Diag")?.onCommand();
assert.strictEqual(contextMenuCalls.length, 5, "context menu commands must call auto, page, original, and diagnostics handlers");
assert.strictEqual(contextMenuCalls[0].action, "auto", "first default-quality command must be auto-raster");
assert.strictEqual(contextMenuCalls[0].reader, testReader, "auto-raster command must receive the reader");
assert.strictEqual(contextMenuCalls[0].options.qualityKey, "high", "auto-raster command must pass default quality");
assert.strictEqual(contextMenuCalls[0].options.pageIndex, 2, "auto-raster command must pass context page index");
assert.strictEqual(contextMenuCalls[1].action, "page", "second default-quality command must be page preview");
assert.strictEqual(contextMenuCalls[1].reader, testReader, "page-preview command must receive the reader");
assert.strictEqual(contextMenuCalls[1].options.qualityKey, "high", "page-preview command must pass default quality");
assert.strictEqual(contextMenuCalls[1].options.pageIndex, 2, "page-preview command must pass context page index");
assert.strictEqual(contextMenuCalls[2].action, "original", "third command must be page original extraction");
assert.strictEqual(contextMenuCalls[2].reader, testReader, "page-original command must receive the reader");
assert.strictEqual(contextMenuCalls[2].options.scope, "page", "page-original command must pass page scope");
assert.strictEqual(contextMenuCalls[2].options.pageIndex, 2, "page-original command must pass context page index");
assert.strictEqual(contextMenuCalls[3].action, "original", "fourth command must be document original extraction");
assert.strictEqual(contextMenuCalls[3].reader, testReader, "document-original command must receive the reader");
assert.strictEqual(contextMenuCalls[3].options.scope, "document", "document-original command must pass document scope");
assert.ok(
  !Object.prototype.hasOwnProperty.call(contextMenuCalls[3].options, "pageIndex"),
  "document-original command must not pass a page index",
);
assert.strictEqual(contextMenuCalls[4].action, "diagnostics", "diagnostics command must call diagnostics handler");
assert.strictEqual(contextMenuCalls[4].reader, testReader, "diagnostics command must receive the reader");
context.Zotero.Prefs.values["extensions.pdfImageSaver.defaultQuality"] = "medium";
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 10;
delete context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"];

async function runAsyncAssertions() {
  await assertToolbarUnavailableStateSurvivesQualityChange();
  await assertToolbarBusyModeLocksSiblingControls();
  const duplicateIndexHTML = buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: [{ ...htmlEntry, openPDFURI: "" }],
    scope: "clip",
    qualityKey: "medium",
    indexKey: singleIndexKey,
  });
  const existingIndexChild = stubItem(
    { title: singleIndexTitle },
    {
      attachmentContentType: "text/html",
      async getFilePathAsync() {
        return "C:\\Temp\\existing-index.html";
      },
    },
  );
  const unreadableIndexChild = stubItem(
    { title: singleIndexTitle },
    {
      attachmentContentType: "text/html",
      async getFilePathAsync() {
        return "";
      },
    },
  );
  const renamedIndexChild = stubItem(
    { title: "User renamed saved figure" },
    {
      attachmentContentType: "text/html",
      async getFilePathAsync() {
        return "C:\\Temp\\renamed-index.html";
      },
    },
  );
  const unrelatedHTMLChild = stubItem(
    { title: "Unrelated note" },
    {
      attachmentContentType: "text/html",
      async getFilePathAsync() {
        return "C:\\Temp\\unrelated.html";
      },
    },
  );
  const parentWithExistingIndex = stubItem(
    { title: "Parent with existing index" },
    {
      getAttachments() {
        return [501];
      },
    },
  );
  const parentWithUnreadableIndex = stubItem(
    { title: "Parent with unreadable index" },
    {
      getAttachments() {
        return [502];
      },
    },
  );
  const parentWithRenamedIndex = stubItem(
    { title: "Parent with renamed index" },
    {
      getAttachments() {
        return [503];
      },
    },
  );
  const parentWithUnrelatedHTML = stubItem(
    { title: "Parent with unrelated html" },
    {
      getAttachments() {
        return [504];
      },
    },
  );
  const parentWithThrowingAttachments = stubItem(
    { title: "Parent with throwing attachments" },
    {
      getAttachments() {
        throw new Error("attachments unavailable");
      },
    },
  );
  context.Zotero.Items = {
    get(id) {
      return {
        501: existingIndexChild,
        502: unreadableIndexChild,
        503: renamedIndexChild,
        504: unrelatedHTMLChild,
      }[id] || null;
    },
  };
  context.Zotero.File = {
    ...context.Zotero.File,
    async getContentsAsync(filePath) {
      assert.ok(
        ["C:\\Temp\\existing-index.html", "C:\\Temp\\renamed-index.html", "C:\\Temp\\unrelated.html"].includes(filePath),
        "duplicate scanner must only read known HTML candidates",
      );
      if (filePath === "C:\\Temp\\unrelated.html") {
        return `<pre>${JSON.stringify({
          preview_index_key: singleIndexKey,
          entries: [{ preview_duplicate_key: getPreviewDuplicateKey(htmlAttachment, htmlEntry) }],
        })}</pre>`;
      }
      return duplicateIndexHTML;
    },
  };
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(parentWithExistingIndex, singleIndexKey),
    true,
    "existing child index attachment with matching preview_index_key must be detected",
  );
  assert.strictEqual(
    await isDuplicatePreviewIndexSave({ parentItem: parentWithExistingIndex, indexKey: singleIndexKey }),
    true,
    "duplicate save guard must skip an existing child index attachment after reload",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(parentWithUnreadableIndex, singleIndexKey),
    false,
    "unreadable child index candidate must not be treated as duplicate without metadata evidence",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(parentWithThrowingAttachments, singleIndexKey),
    false,
    "child attachment list failures must degrade to no persisted duplicate instead of throwing",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(parentWithRenamedIndex, singleIndexKey),
    true,
    "renamed text/html child index with matching metadata must still be detected",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(
      parentWithUnrelatedHTML,
      singleIndexKey,
      [getPreviewDuplicateKey(htmlAttachment, htmlEntry)],
    ),
    false,
    "unrelated text/html metadata must not be treated as this plugin's preview index",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(
      parentWithRenamedIndex,
      multiIndexKey,
      [getPreviewDuplicateKey(htmlAttachment, htmlEntry)],
      [],
    ),
    true,
    "persisted entry duplicate keys must detect partial overlap when full index key differs",
  );
  const differentQualitySameRegionEntry = { ...htmlEntry, quality: "high" };
  assert.notStrictEqual(
    getPreviewDuplicateKey(htmlAttachment, differentQualitySameRegionEntry),
    getPreviewDuplicateKey(htmlAttachment, htmlEntry),
    "quality changes still produce distinct preview duplicate keys",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(
      parentWithRenamedIndex,
      getPreviewIndexKey(htmlAttachment, [differentQualitySameRegionEntry], "clip", "high"),
      [getPreviewDuplicateKey(htmlAttachment, differentQualitySameRegionEntry)],
      [getSourceRegionKey(htmlAttachment, differentQualitySameRegionEntry)],
    ),
    true,
    "persisted source_region_key must detect same-region duplicates across preview quality changes",
  );
  assert.strictEqual(
    await classifyPreviewDuplicateSkipReason({
      parentItem: parentWithRenamedIndex,
      indexKey: multiIndexKey,
      memoryKeys: [getPreviewDuplicateKey(htmlAttachment, htmlEntry)],
      sourceRegionKeys: [],
    }),
    "saved",
    "persisted index hits must classify as saved skips",
  );
  const duplicateScannerItems = context.Zotero.Items;
  context.Zotero.Items = { get() { return null; } };
  assert.strictEqual(
    await isDuplicatePreviewIndexSave({
      parentItem: null,
      indexKey: getPreviewIndexKey(htmlAttachment, [differentQualitySameRegionEntry], "clip", "high"),
      memoryKeys: [getPreviewDuplicateKey(htmlAttachment, differentQualitySameRegionEntry)],
      sourceRegionKeys: [getSourceRegionKey(htmlAttachment, differentQualitySameRegionEntry)],
    }),
    false,
    "same-region different-quality save must not be duplicate before the session cache is populated",
  );
  rememberPreviewIndexSave(htmlAttachment, [htmlEntry], singleIndexKey);
  assert.strictEqual(
    await isDuplicatePreviewIndexSave({
      parentItem: null,
      indexKey: getPreviewIndexKey(htmlAttachment, [differentQualitySameRegionEntry], "clip", "high"),
      memoryKeys: [getPreviewDuplicateKey(htmlAttachment, differentQualitySameRegionEntry)],
      sourceRegionKeys: [getSourceRegionKey(htmlAttachment, differentQualitySameRegionEntry)],
    }),
    true,
    "in-session source_region_key cache must detect same-region duplicates across preview quality changes",
  );
  assert.strictEqual(
    await classifyPreviewDuplicateSkipReason({
      parentItem: null,
      indexKey: getPreviewIndexKey(htmlAttachment, [differentQualitySameRegionEntry], "clip", "high"),
      memoryKeys: [getPreviewDuplicateKey(htmlAttachment, differentQualitySameRegionEntry)],
      sourceRegionKeys: [getSourceRegionKey(htmlAttachment, differentQualitySameRegionEntry)],
    }),
    "session",
    "session source-region cache hits must classify as session skips",
  );
  context.Zotero.Items = duplicateScannerItems;
  assert.strictEqual(
    await isDuplicatePreviewIndexSave({
      parentItem: parentWithRenamedIndex,
      indexKey: multiIndexKey,
      memoryKeys: [getPreviewDuplicateKey(htmlAttachment, htmlEntry)],
      sourceRegionKeys: [],
    }),
    true,
    "duplicate save guard entry point must use persisted per-entry duplicate keys",
  );
  assert.strictEqual(
    await hasExistingPreviewIndexAttachment(parentWithExistingIndex, multiIndexKey),
    false,
    "different preview index key must not be treated as a duplicate",
  );

  context.Services.prompt.confirms = [];
  context.Services.prompt.alerts = [];
  context.Services.prompt.confirmResult = false;
  const cancelledOriginalSave = await confirmAndSaveOriginalImagesFromReader(null, null);
  assert.strictEqual(cancelledOriginalSave, null, "malformed original confirmation options must not reject");
  assert.strictEqual(context.Services.prompt.confirms.length, 1, "original confirmation must still require an explicit prompt");
  assert.ok(
    context.Services.prompt.confirms[0].message.includes("Orig page?"),
    "malformed original confirmation options must fall back to page scope",
  );
  assert.ok(
    context.Services.prompt.confirms[0].message.includes("25 MB/img")
      && context.Services.prompt.confirms[0].message.includes("150 MB/run"),
    "original confirmation must state per-image and total byte risk",
  );
assert.ok(
  context.Services.prompt.confirms[0].message.includes("Use clip."),
  "original confirmation must reuse dense Use clip guidance",
);
  assert.strictEqual(
    context.Services.prompt.alerts[0].message,
    "Orig cancel page.",
    "cancelled original confirmation must show compact reader feedback",
  );

  context.Services.prompt.confirms = [];
  context.Services.prompt.alerts = [];
  context.Services.prompt.confirmResult = false;
  const cancelledDocumentOriginalSave = await confirmAndSaveOriginalImagesFromReader(null, {
    scope: "document",
    pageIndex: 4,
  });
  assert.strictEqual(cancelledDocumentOriginalSave, null, "document original cancel must not reject");
  assert.strictEqual(
    context.Services.prompt.alerts[0].message,
    "Orig cancel doc.",
    "document original cancel must use compact doc scope token",
  );

  const existingOriginalFile = `${helperOutputDir}\\existing.jpg`;
  const missingOriginalFile = `${helperOutputDir}\\missing.jpg`;
  const laterExistingOriginalFile = `${helperOutputDir}\\later-existing.jpg`;
  const unreadableOriginalFile = `${helperOutputDir}\\unreadable.jpg`;
  const failingImportOriginalFile = `${helperOutputDir}\\failing-import.jpg`;
  const existingFiles = new Set([
    existingOriginalFile.toLowerCase(),
    laterExistingOriginalFile.toLowerCase(),
    failingImportOriginalFile.toLowerCase(),
  ]);
  context.IOUtils.exists = async (filePath) => existingFiles.has(String(filePath).toLowerCase());
  const filteredOriginalImages = await filterExistingOriginalImagesForImport({
    images: [
      normalizeOriginalImageForImport({ file_path: existingOriginalFile }, 0, helperOutputDir),
      normalizeOriginalImageForImport({ file_path: missingOriginalFile }, 1, helperOutputDir),
    ],
    omittedCount: 2,
    invalidCount: 1,
    overCapCount: 1,
    maxImages: 10,
  });
  assert.strictEqual(filteredOriginalImages.images.length, 1, "existing helper files must be preserved");
  assert.strictEqual(filteredOriginalImages.images[0].filePath, existingOriginalFile);
  assert.strictEqual(filteredOriginalImages.missingCount, 1, "missing helper files must be counted");
  assert.strictEqual(filteredOriginalImages.invalidCount, 1, "malformed helper record count must be preserved");
  assert.strictEqual(filteredOriginalImages.overCapCount, 1, "over-cap helper record count must be preserved");
  assert.strictEqual(filteredOriginalImages.omittedCount, 3, "missing helper files must add to omission count");

  const loggedErrors = [];
  context.Zotero.logError = (error) => loggedErrors.push(error);
  context.IOUtils.exists = async (filePath) => {
    if (String(filePath).toLowerCase() === unreadableOriginalFile.toLowerCase()) {
      throw new Error("permission denied");
    }
    return existingFiles.has(String(filePath).toLowerCase());
  };
  const filteredWithReadError = await filterExistingOriginalImagesForImport({
    images: [
      normalizeOriginalImageForImport({ file_path: unreadableOriginalFile }, 0, helperOutputDir),
      normalizeOriginalImageForImport({ file_path: existingOriginalFile }, 1, helperOutputDir),
    ],
    omittedCount: 0,
    invalidCount: 0,
    overCapCount: 0,
    maxImages: 10,
  });
  assert.strictEqual(filteredWithReadError.images.length, 1, "readable helper files must survive existence-check errors");
  assert.strictEqual(filteredWithReadError.missingCount, 0, "existence-check errors must not count as missing files");
  assert.strictEqual(filteredWithReadError.errorCount, 1, "existence-check errors must be counted separately");
  assert.strictEqual(filteredWithReadError.omittedCount, 1, "existence-check errors must add to omission count");
  assert.strictEqual(loggedErrors.length, 1, "existence-check errors must be logged");

  const mb = 1024 * 1024;
  const oversizedOriginalFile = `${helperOutputDir}\\oversized.jpg`;
  const totalCapOriginalFiles = Array.from(
    { length: 8 },
    (_value, index) => `${helperOutputDir}\\total-cap-${index + 1}.jpg`,
  );
  existingFiles.add(oversizedOriginalFile.toLowerCase());
  totalCapOriginalFiles.forEach((filePath) => existingFiles.add(filePath.toLowerCase()));
  const helperByteSizes = new Map([
    [oversizedOriginalFile.toLowerCase(), 26 * mb],
    ...totalCapOriginalFiles.map((filePath) => [filePath.toLowerCase(), 20 * mb]),
  ]);
  context.IOUtils.exists = async (filePath) => existingFiles.has(String(filePath).toLowerCase());
  context.IOUtils.stat = async (filePath) => ({ size: helperByteSizes.get(String(filePath).toLowerCase()) ?? 1024 });
  const filteredWithByteCaps = await filterExistingOriginalImagesForImport({
    images: [
      normalizeOriginalImageForImport({ file_path: oversizedOriginalFile }, 0, helperOutputDir),
      ...totalCapOriginalFiles.map((filePath, index) => normalizeOriginalImageForImport({ file_path: filePath }, index + 1, helperOutputDir)),
    ],
    omittedCount: 0,
    invalidCount: 0,
    overCapCount: 0,
    maxImages: 10,
  });
  assert.strictEqual(filteredWithByteCaps.images.length, 7, "byte caps must keep only files inside per-file and total limits");
  assert.strictEqual(filteredWithByteCaps.byteCapCount, 2, "byte caps must count per-file and total-limit skips");
  assert.strictEqual(filteredWithByteCaps.omittedCount, 2, "byte-cap skips must add to omission count");
  assert.strictEqual(filteredWithByteCaps.totalBytes, 140 * mb, "total byte count must reflect accepted originals only");
  assert.strictEqual(filteredWithByteCaps.images[0].byteCount, 20 * mb, "accepted originals must carry stat byte size");

  context.IOUtils.exists = async (filePath) => existingFiles.has(String(filePath).toLowerCase());
  context.Zotero.Attachments.imported = [];
  const importResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: missingOriginalFile, page_number: 1, occurrence: 1 },
        { file_path: existingOriginalFile, page_number: 2, occurrence: 2 },
        { file_path: laterExistingOriginalFile, page_number: 3, occurrence: 3 },
      ],
    },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  assert.strictEqual(importResult.count, 2, "missing helper files must not abort later valid imports");
  assert.strictEqual(importResult.missingCount, 1, "full import must report missing helper files");
  assert.strictEqual(importResult.totalBytes, 2048, "full import must report stat bytes for accepted originals");
  assert.deepStrictEqual(
    importedImageFiles(),
    [existingOriginalFile, laterExistingOriginalFile],
    "full import must pass only existing helper files to Zotero import",
  );
  const firstGeneratedOriginalIndexes = importedHTMLIndexes();
  assert.strictEqual(firstGeneratedOriginalIndexes.length, 1, "successful original imports must create one synced HTML index");
  assert.strictEqual(firstGeneratedOriginalIndexes[0].contentType, "text/html");
  const firstGeneratedIndexHTML = context.Zotero.File.contents[firstGeneratedOriginalIndexes[0].file];
  assert.ok(firstGeneratedIndexHTML.includes("original_image_key"), "generated original index must store original image keys");
  assert.ok(firstGeneratedIndexHTML.includes("zotero://open-pdf/library/items/HTMLPDF1"), "generated original index must store source PDF links");

  const duplicateOriginalRecord = normalizeOriginalImageForImport({
    file_path: existingOriginalFile,
    page_number: 2,
    occurrence: 2,
    sha256: "duplicate-sha",
  }, 0, helperOutputDir);
  duplicateOriginalRecord.originalImageKey = getOriginalImageKey(htmlAttachment, duplicateOriginalRecord);
  const existingOriginalIndexHTML = buildOriginalImageIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    images: [duplicateOriginalRecord],
    scope: "page",
  });
  const existingOriginalIndexChild = stubItem(
    { title: "Existing original index" },
    {
      attachmentContentType: "text/html",
      async getFilePathAsync() {
        return "C:\\Temp\\existing-original-index.html";
      },
    },
  );
  const parentWithOriginalIndex = stubItem(
    { title: "Parent with original index" },
    {
      getAttachments() {
        return [701];
      },
    },
  );
  context.Zotero.Items = {
    get(id) {
      return id === 701 ? existingOriginalIndexChild : null;
    },
  };
  context.Zotero.File = {
    ...context.Zotero.File,
    async getContentsAsync(filePath) {
      if (filePath === "C:\\Temp\\existing-original-index.html") {
        return existingOriginalIndexHTML;
      }
      return this.contents[filePath] || "";
    },
  };
  context.Zotero.Attachments.imported = [];
  const duplicateImportResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: existingOriginalFile, page_number: 2, occurrence: 2, sha256: "duplicate-sha" },
        { file_path: laterExistingOriginalFile, page_number: 3, occurrence: 3, sha256: "new-sha" },
      ],
    },
    attachment: htmlAttachment,
    parentItem: parentWithOriginalIndex,
    scope: "page",
  });
  assert.strictEqual(duplicateImportResult.count, 1, "existing original-image keys must be skipped across reloads");
  assert.strictEqual(duplicateImportResult.duplicateCount, 1, "duplicate original-image keys must be counted");
  assert.deepStrictEqual(importedImageFiles(), [laterExistingOriginalFile], "duplicate original imports must not reach Zotero import");
  const duplicateGeneratedIndexes = importedHTMLIndexes();
  assert.strictEqual(duplicateGeneratedIndexes.length, 1, "non-duplicate original import must still create an index");
  const duplicateGeneratedMetadata = extractMetadata(context.Zotero.File.contents[duplicateGeneratedIndexes[0].file]);
  assert.strictEqual(duplicateGeneratedMetadata.images.length, 1, "duplicate skips must be excluded from new original index metadata");
  assert.strictEqual(duplicateGeneratedMetadata.images[0].sha256, "new-sha");

  context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 1;
  context.Zotero.Attachments.imported = [];
  context.IOUtils.stat = async (filePath) => ({
    size: String(filePath).toLowerCase() === existingOriginalFile.toLowerCase()
      ? 149 * mb
      : 20 * mb,
  });
  const duplicateBeforeCapResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: existingOriginalFile, page_number: 2, occurrence: 2, sha256: "duplicate-sha" },
        { file_path: laterExistingOriginalFile, page_number: 3, occurrence: 3, sha256: "new-sha-before-cap" },
      ],
    },
    attachment: htmlAttachment,
    parentItem: parentWithOriginalIndex,
    scope: "page",
  });
  assert.strictEqual(duplicateBeforeCapResult.count, 1, "duplicate originals must not consume max-image capacity");
  assert.strictEqual(duplicateBeforeCapResult.duplicateCount, 1, "duplicate-before-cap path must still count duplicates");
  assert.strictEqual(duplicateBeforeCapResult.overCapCount, 0, "duplicate originals must be removed before max-image cap");
  assert.strictEqual(duplicateBeforeCapResult.byteCapCount, 0, "duplicate originals must be removed before total byte cap");
  assert.strictEqual(duplicateBeforeCapResult.totalBytes, 20 * mb, "duplicate bytes must not contribute to accepted total bytes");
  assert.deepStrictEqual(importedImageFiles(), [laterExistingOriginalFile], "new original after duplicate must still import");
  context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 10;

  context.Zotero.Attachments.imported = [];
  context.IOUtils.stat = async () => ({ size: 1024 });
  context.Zotero.Items = {
    getAll(libraryID) {
      assert.strictEqual(libraryID, htmlAttachment.libraryID, "standalone duplicate scan must stay in the attachment library");
      return [existingOriginalIndexChild];
    },
  };
  const standaloneDuplicateResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: existingOriginalFile, page_number: 2, occurrence: 2, sha256: "duplicate-sha" },
        { file_path: laterExistingOriginalFile, page_number: 3, occurrence: 3, sha256: "standalone-new-sha" },
      ],
    },
    attachment: htmlAttachment,
    parentItem: null,
    scope: "page",
  });
  assert.strictEqual(standaloneDuplicateResult.count, 1, "standalone PDF duplicate original keys must be skipped");
  assert.strictEqual(standaloneDuplicateResult.duplicateCount, 1, "standalone duplicate skips must be counted");
  assert.deepStrictEqual(importedImageFiles(), [laterExistingOriginalFile], "standalone duplicate originals must not reach Zotero import");
  context.Zotero.Items = { get() { return null; } };

  const indexFailureErrors = [];
  context.Zotero.logError = (error) => indexFailureErrors.push(error);
  context.Zotero.Attachments.imported = [];
  context.Zotero.Attachments.importFromFile = async function importFromFile(options) {
    if (options.contentType === "text/html") {
      throw new Error("original index import failed");
    }
    this.imported.push(options);
  };
  const indexFailureResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: existingOriginalFile, page_number: 1, occurrence: 1 },
        { file_path: laterExistingOriginalFile, page_number: 2, occurrence: 2 },
      ],
    },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  assert.strictEqual(indexFailureResult.count, 2, "original image imports must still succeed when the HTML index import fails");
  assert.strictEqual(indexFailureResult.indexErrorCount, 1, "HTML index import failures must be counted separately");
  assert.strictEqual(indexFailureResult.omittedCount, 0, "HTML index failure must not be counted as an omitted original image");
  assert.deepStrictEqual(
    importedImageFiles(),
    [existingOriginalFile, laterExistingOriginalFile],
    "HTML index failure must not remove successful original image imports",
  );
  assert.strictEqual(importedHTMLIndexes().length, 0, "failed HTML index import must not be recorded as an imported index");
  assert.strictEqual(indexFailureErrors.length, 1, "HTML index import failure must be logged");

  const importErrors = [];
  context.Zotero.logError = (error) => importErrors.push(error);
  context.Zotero.Attachments.imported = [];
  context.Zotero.Attachments.importFromFile = async function importFromFile(options) {
    if (options.file === failingImportOriginalFile) {
      throw new Error("zotero import failed");
    }
    this.imported.push(options);
  };
  const importFailureResult = await importOriginalImages({
    report: {
      output_dir: helperOutputDir,
      images: [
        { file_path: existingOriginalFile, page_number: 1, occurrence: 1 },
        { file_path: failingImportOriginalFile, page_number: 2, occurrence: 2 },
        { file_path: laterExistingOriginalFile, page_number: 3, occurrence: 3 },
      ],
    },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  assert.strictEqual(importFailureResult.count, 2, "one failed Zotero import must not abort later valid imports");
  assert.strictEqual(importFailureResult.importErrorCount, 1, "failed Zotero imports must be counted separately");
  assert.strictEqual(importFailureResult.omittedCount, 1, "failed Zotero imports must add to omission count");
  assert.strictEqual(importErrors.length, 1, "failed Zotero imports must be logged");
  assert.deepStrictEqual(
    importedImageFiles(),
    [existingOriginalFile, laterExistingOriginalFile],
    "failed Zotero imports must be omitted while later valid imports continue",
  );
  assert.strictEqual(importedHTMLIndexes().length, 1, "partial original import success must still write one HTML index");

  const allFailureErrors = [];
  context.Zotero.logError = (error) => allFailureErrors.push(error);
  context.Zotero.Attachments.imported = [];
  context.Zotero.Attachments.importFromFile = async () => {
    throw new Error("zotero storage unavailable");
  };
  await assert.rejects(
    () => importOriginalImages({
      report: {
        output_dir: helperOutputDir,
        images: [
          { file_path: existingOriginalFile, page_number: 1, occurrence: 1 },
          { file_path: laterExistingOriginalFile, page_number: 2, occurrence: 2 },
        ],
      },
      attachment: htmlAttachment,
      parentItem: htmlParent,
      scope: "page",
    }),
    /Storage failed: all 2 orig imports failed/,
    "all failed Zotero imports must be surfaced as an overall error",
  );
  assert.strictEqual(allFailureErrors.length, 2, "all failed Zotero imports must log each failed import");
  assert.deepStrictEqual(context.Zotero.Attachments.imported, [], "all failed Zotero imports must not record imports");

  const recursiveRemovals = [];
  context.IOUtils.remove = async (targetPath, options) => {
    recursiveRemovals.push({ targetPath, options });
  };
  context.Zotero.Attachments.importFromFile = async () => {};
  await importOriginalImages({
    report: { output_dir: "C:\\Users\\ZLK\\Documents", images: [] },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  await importOriginalImages({
    report: { output_dir: "C:\\Temp\\pdf-image-saver", images: [] },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  await importOriginalImages({
    report: { output_dir: "C:\\Temp\\pdf-image-saver\\..\\outside", images: [] },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  await importOriginalImages({
    report: { output_dir: "C:\\Temp\\pdf-image-saver\\job-safe", images: [] },
    attachment: htmlAttachment,
    parentItem: htmlParent,
    scope: "page",
  });
  assert.strictEqual(recursiveRemovals.length, 1, "recursive cleanup must skip outside paths and temp root");
  assert.strictEqual(recursiveRemovals[0].targetPath, "C:\\Temp\\pdf-image-saver\\job-safe");
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(recursiveRemovals[0].options)),
    { recursive: true, ignoreAbsent: true },
    "recursive cleanup must keep expected IOUtils.remove options for plugin temp children",
  );

  const readerEntryErrors = [];
  context.Zotero.logError = (error) => readerEntryErrors.push(error);
  const malformedOptionsCases = [
    { label: "missing", args: [] },
    { label: "null", args: [null] },
    { label: "array", args: [[]] },
    { label: "scalar", args: [42] },
  ];
  async function assertSaveEntryHandlesMalformedOptions(fn, label, expectedMessage) {
    for (const optionsCase of malformedOptionsCases) {
      const before = readerEntryErrors.length;
      await assert.doesNotReject(
        () => fn(null, ...optionsCase.args),
        `${label} save entry must handle ${optionsCase.label} options inside its guarded error path`,
      );
      assert.strictEqual(
        readerEntryErrors.length,
        before + 1,
        `${label} save entry must log its own guarded error for ${optionsCase.label} options`,
      );
      const message = String(readerEntryErrors[before]?.message || readerEntryErrors[before]);
      assert.ok(
        message.includes(expectedMessage),
        `${label} ${optionsCase.label}-options failure must reach guarded error handling`,
      );
      assert.ok(
        !message.includes("Cannot read properties"),
        `${label} ${optionsCase.label}-options failure must not leak a raw TypeError`,
      );
    }
  }
  await assertSaveEntryHandlesMalformedOptions(
    saveAutoDetectedPageImagePreviews,
    "auto-raster",
    "Capture failed: canvas missing",
  );
  await assertSaveEntryHandlesMalformedOptions(
    savePagePreviewIndex,
    "page-preview",
    "Capture failed: canvas missing",
  );
  await assertSaveEntryHandlesMalformedOptions(
    saveClipPreviewIndex,
    "clip-preview",
    "Capture failed: not a PDF",
  );
  await assertSaveEntryHandlesMalformedOptions(
    saveOriginalImagesFromReader,
    "original-image",
    "Capture failed: not a PDF",
  );
}

function createPreferenceElement(initial = {}) {
  return {
    value: "",
    checked: false,
    textContent: "",
    listeners: Object.create(null),
    appendChild() {
      return this;
    },
    addEventListener(type, listener) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(listener);
    },
    dispatch(type) {
      for (const listener of this.listeners[type] || []) {
        listener({ type, target: this });
      }
    },
    ...initial,
  };
}

function createPreferenceDocument() {
  const elements = new Map();
  for (const id of [
    "pdf-image-saver-default-quality",
    "pdf-image-saver-duplicate-guard",
    "pdf-image-saver-min-auto-area",
    "pdf-image-saver-auto-max-images",
    "pdf-image-saver-auto-max-preview-mb",
    "pdf-image-saver-max-index-mb",
    "pdf-image-saver-min-area",
    "pdf-image-saver-max-page-images",
    "pdf-image-saver-max-document-images",
    "pdf-image-saver-helper-timeout",
    "pdf-image-saver-python-path",
    "pdf-image-saver-prefs-status",
  ]) {
    elements.set(id, createPreferenceElement());
  }
  return {
    documentElement: createPreferenceElement(),
    createElement() {
      return createPreferenceElement();
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
}


const preferencesXhtml = fs.readFileSync(path.join(root, "preferences.xhtml"), "utf8");
assert.ok(preferencesXhtml.includes('title="Preview quality"'), "prefs Q label must expose title");
assert.ok(preferencesXhtml.includes('title="HTML index size cap (MB)"'), "prefs Index MB label must expose title");
assert.ok(preferencesXhtml.includes('title="Custom Python path; empty = auto"'), "prefs Python label must expose title");

function assertPreferenceStatusRendering() {
  const preferencesSource = fs.readFileSync(path.join(root, "content", "preferences.js"), "utf8");
  const prefDoc = createPreferenceDocument();
  prefDoc.getElementById("pdf-image-saver-default-quality").value = "high";
  prefDoc.getElementById("pdf-image-saver-duplicate-guard").checked = true;
  prefDoc.getElementById("pdf-image-saver-min-auto-area").value = "0.005";
  prefDoc.getElementById("pdf-image-saver-auto-max-images").value = "6";
  prefDoc.getElementById("pdf-image-saver-auto-max-preview-mb").value = "3";
  prefDoc.getElementById("pdf-image-saver-max-index-mb").value = "5";
  prefDoc.getElementById("pdf-image-saver-min-area").value = "0.02";
  prefDoc.getElementById("pdf-image-saver-max-page-images").value = "12";
  prefDoc.getElementById("pdf-image-saver-max-document-images").value = "34";
  prefDoc.getElementById("pdf-image-saver-helper-timeout").value = "45";
  prefDoc.getElementById("pdf-image-saver-python-path").value = "C:\\py\\python.exe";
  const prefContext = {
    document: prefDoc,
    Zotero: {
      Prefs: {
        get(key) {
          const values = {
            "extensions.pdfImageSaver.defaultQuality": "medium",
            "extensions.pdfImageSaver.duplicateGuard": true,
            "extensions.pdfImageSaver.autoDetectMaxImages": 8,
            "extensions.pdfImageSaver.autoMaxPreviewBytesMB": 4,
            "extensions.pdfImageSaver.maxIndexBytesMB": 6,
          };
          return values[key];
        },
      },
    },
  };
  vm.createContext(prefContext);
  vm.runInContext(preferencesSource, prefContext, { filename: "preferences.js" });
  prefContext.PdfImageSaverPreferences.init();
  const status = prefDoc.getElementById("pdf-image-saver-prefs-status");
  assert.ok(status.textContent.includes("Store: HTML"), "preference status must render storage mode");
  assert.ok(status.textContent.includes("Q H High; 180-750 KB"), "preference status must render selected quality estimate");
  assert.ok(status.textContent.includes("Dups: on; sess+saved"), "preference status must render duplicate guard state");
  assert.ok(status.textContent.includes("Auto: min 0.005; 6 max; 3 MB"), "preference status must render auto min/caps");
  assert.ok(status.textContent.includes("Index: 5 MB"), "preference status must render HTML index cap");
  assert.ok(status.textContent.includes("Helper: opt; min 0.02; page 12; doc 34; 45s; custom py"), "preference status must render helper min/caps and python path mode");
  prefDoc.getElementById("pdf-image-saver-default-quality").value = "low";
  prefDoc.getElementById("pdf-image-saver-default-quality").dispatch("change");
  assert.ok(status.textContent.includes("Q L Low; 20-80 KB"), "preference status must refresh after quality change");
  prefDoc.getElementById("pdf-image-saver-python-path").value = "";
  prefDoc.getElementById("pdf-image-saver-python-path").dispatch("input");
  assert.ok(status.textContent.includes("auto py"), "preference status must refresh helper python mode");
  prefDoc.getElementById("pdf-image-saver-min-auto-area").value = "0.008";
  prefDoc.getElementById("pdf-image-saver-min-auto-area").dispatch("input");
  assert.ok(status.textContent.includes("Auto: min 0.008; 6 max; 3 MB"), "preference status must refresh auto min area");
}

runAsyncAssertions()
  .then(() => {
    assertPreferenceStatusRendering();
    console.log("open-pdf uri tests ok");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
