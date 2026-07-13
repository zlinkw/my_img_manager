var PdfImageSaver = (() => {
  const ADDON_REF = "pdf-image-saver";
  const HELPER_SCHEMA_VERSION = "zotero-pdf-image-saver/v1";
  const PREF_BRANCH = "extensions.pdfImageSaver.";
  const DEFAULT_MIN_AREA = 0.004;
  const DEFAULT_MIN_AUTO_IMAGE_AREA = 0.003;
  const DEFAULT_AUTO_DETECT_MAX_IMAGES = 8;
  const DEFAULT_AUTO_MAX_PREVIEW_BYTES_MB = 4;
  const DEFAULT_MAX_INDEX_BYTES_MB = 6;
  const HARD_MAX_AUTO_PREVIEW_BYTES_MB = 8;
  const HARD_MAX_INDEX_BYTES_MB = 12;
  const DEFAULT_MAX_PAGE_IMAGES = 80;
  const DEFAULT_MAX_DOCUMENT_IMAGES = 250;
  const DEFAULT_HELPER_TIMEOUT_SECONDS = 60;
  const HARD_MAX_PAGE_IMAGES = 500;
  const HARD_MAX_DOCUMENT_IMAGES = 2000;
  const HARD_MAX_HELPER_TIMEOUT_SECONDS = 600;
  const ORIGINAL_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const ORIGINAL_MAX_TOTAL_BYTES = 150 * 1024 * 1024;
  const QUALITY = {
    low: { label: "Low", maxWidth: 240, jpegQuality: 0.62, estimate: "20-80 KB/image" },
    medium: { label: "Medium", maxWidth: 480, jpegQuality: 0.78, estimate: "60-220 KB/image" },
    high: { label: "High", maxWidth: 960, jpegQuality: 0.9, estimate: "180-750 KB/image" },
  };
  const IMAGE_CATEGORIES = {
    auto: { label: "Auto", mark: "Aut" },
    chart: { label: "Chart", mark: "Cht" },
    diagram: { label: "Diagram", mark: "Dia" },
    photo: { label: "Photo", mark: "Pho" },
    table: { label: "Table", mark: "Tab" },
    schematic: { label: "Schematic", mark: "Sch" },
    equation: { label: "Equation", mark: "Eqn" },
    figure: { label: "Figure", mark: "Fig" },
  };
  const readerHandlers = [];
  const windowState = new WeakMap();
  const activeJobs = new Set();
  const recentIndexSaves = new Map();

  let config = null;
  let helperScriptPathPromise = null;
  let pythonCommandPromise = null;
  let started = false;

  function init(data) {
    config = data;
  }

  async function startup() {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    registerReaderHandlers();
    await cleanupStaleTempDirectories();
    for (const win of Zotero.getMainWindows()) {
      await addToWindow(win);
    }
    started = true;
    log("Started");
  }

  async function shutdown() {
    unregisterReaderHandlers();
    for (const win of Zotero.getMainWindows()) {
      await removeFromWindow(win);
    }
    activeJobs.clear();
    helperScriptPathPromise = null;
    pythonCommandPromise = null;
    started = false;
    log("Stopped");
  }

  async function addToWindow(win) {
    if (!win || windowState.has(win)) {
      return;
    }

    const doc = win.document;
    const toolsPopup = doc.getElementById("menu_ToolsPopup");
    doc.getElementById("pdf-image-saver-tools-menuitem")?.remove();
    doc.getElementById("pdf-image-saver-diagnostics-menuitem")?.remove();
    const menuitem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    menuitem.id = "pdf-image-saver-tools-menuitem";
    menuitem.setAttribute("label", "PDF Img Clip");
    menuitem.setAttribute("tooltiptext", "Clip HTML");
    menuitem.addEventListener("command", () => {
      void startClipFromActiveReader(win, getDefaultQualityKey());
    });
    const diagnosticsItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    diagnosticsItem.id = "pdf-image-saver-diagnostics-menuitem";
    diagnosticsItem.setAttribute("label", "PDF Img Diag");
    diagnosticsItem.setAttribute("tooltiptext", "Runtime/open/helper");
    diagnosticsItem.addEventListener("command", () => {
      void showDiagnostics(win);
    });
    toolsPopup?.appendChild(menuitem);
    toolsPopup?.appendChild(diagnosticsItem);
    windowState.set(win, { menuitems: [menuitem, diagnosticsItem] });
  }

  async function removeFromWindow(win) {
    const state = windowState.get(win);
    if (!state) {
      return;
    }
    for (const menuitem of state.menuitems || []) {
      menuitem?.remove();
    }
    windowState.delete(win);
  }

  function registerReaderHandlers() {
    if (readerHandlers.length) {
      return;
    }
    addReaderHandler("renderToolbar", onRenderToolbar);
    addReaderHandler("createViewContextMenu", onCreateViewContextMenu);
  }

  function unregisterReaderHandlers() {
    try {
      if (typeof Zotero.Reader?._unregisterEventListenerByPluginID === "function" && config?.id) {
        Zotero.Reader._unregisterEventListenerByPluginID(config.id);
      } else if (Array.isArray(Zotero.Reader?._registeredListeners) && config?.id) {
        Zotero.Reader._registeredListeners = Zotero.Reader._registeredListeners
          .filter((listener) => listener.pluginID !== config.id);
      } else {
        for (const { type, handler } of readerHandlers) {
          Zotero.Reader.unregisterEventListener(type, handler);
        }
      }
    } catch (error) {
      logError(error);
    }
    readerHandlers.length = 0;
  }

  function addReaderHandler(type, handler) {
    Zotero.Reader.registerEventListener(type, handler, config.id);
    readerHandlers.push({ type, handler });
  }

  function onRenderToolbar(event) {
    const { reader, doc, append } = event;
    if (!isPDFReader(reader) || !doc || typeof append !== "function") {
      return;
    }

    ensureReaderStyles(doc);
    doc.getElementById("pdf-image-saver-toolbar-group")?.remove();
    const group = doc.createElement("span");
    group.id = "pdf-image-saver-toolbar-group";
    group.className = "pdf-image-saver-toolbar-group";
    const select = doc.createElement("select");
    select.className = "pdf-image-saver-quality";
    select.setAttribute?.("aria-label", "Q");
    select.title = "Q; size est";
    for (const key of Object.keys(QUALITY)) {
      const option = doc.createElement("option");
      option.value = key;
      option.textContent = getQualityLabelWithEstimate(key);
      option.selected = key === getDefaultQualityKey();
      select.appendChild(option);
    }

    const categorySelect = doc.createElement("select");
    categorySelect.className = "pdf-image-saver-category";
    categorySelect.setAttribute?.("aria-label", "Cat");
    categorySelect.title = "Cat; figure class";
    for (const key of Object.keys(IMAGE_CATEGORIES)) {
      const option = doc.createElement("option");
      option.value = key;
      option.textContent = getImageCategoryLabel(key);
      option.selected = key === getDefaultImageCategoryKey();
      categorySelect.appendChild(option);
    }

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "pdf-image-saver-toolbar-button";
    button.textContent = "Clip";
    button.setAttribute?.("aria-label", "Clip");
    const autoButton = doc.createElement("button");
    autoButton.type = "button";
    autoButton.className = "pdf-image-saver-toolbar-button";
    autoButton.textContent = "Auto";
    autoButton.setAttribute?.("aria-label", "Auto");

    let toolbarMode = "idle";
    let autoRasterAvailable = false;
    const refreshAutoButtonState = (qualityKey = normalizeQualityKey(select.value)) => {
      const normalizedQualityKey = normalizeQualityKey(qualityKey);
      if (toolbarMode !== "idle") {
        if (toolbarMode === "clip") {
          autoButton.title = "Auto lock (clip)";
        } else if (toolbarMode === "auto") {
          autoButton.title = "Auto running";
        }
        return;
      }
      applyAutoRasterButtonState(autoButton, autoRasterAvailable, normalizedQualityKey);
    };
    const syncAutoRasterAvailability = async (qualityKey = normalizeQualityKey(select.value)) => {
      try {
        const pageIndex = await getCurrentPageIndex(reader);
        const context = await getPDFViewerContext(reader);
        const pageView = getPageView(context, pageIndex);
        const pdfPage = pageView?.pdfPage || await context?.app?.pdfDocument?.getPage?.(pageIndex + 1);
        if (pdfPage) {
          autoRasterAvailable = supportsPDFJSImageCoordinates(pdfPage);
        }
      } catch (error) {
        logError(error);
      }
      refreshAutoButtonState(qualityKey);
    };
    const setToolbarMode = (mode) => {
      toolbarMode = mode === "clip" || mode === "auto" ? mode : "idle";
      const busy = toolbarMode !== "idle";
      select.disabled = busy;
      categorySelect.disabled = busy;
      group.setAttribute?.("aria-busy", busy ? "true" : "false");
      group.setAttribute?.("data-mode", toolbarMode);
      if (toolbarMode === "clip") {
        button.disabled = true;
        button.textContent = "Drag...";
        button.setAttribute?.("aria-label", "Clip drag");
        button.title = "Clip drag";
        autoButton.disabled = true;
        autoButton.textContent = "Auto";
        autoButton.setAttribute?.("aria-label", "Auto lock (clip)");
        select.title = "Q lock (clip)";
        categorySelect.title = "Cat lock (clip)";
        refreshAutoButtonState();
        return;
      }
      if (toolbarMode === "auto") {
        button.disabled = true;
        button.textContent = "Clip";
        button.setAttribute?.("aria-label", "Clip lock (auto)");
        button.title = "Clip lock (auto)";
        autoButton.disabled = true;
        autoButton.textContent = "Auto...";
        autoButton.setAttribute?.("aria-label", "Auto running");
        select.title = "Q lock (auto)";
        categorySelect.title = "Cat lock (auto)";
        refreshAutoButtonState();
        return;
      }
      button.disabled = false;
      button.textContent = "Clip";
      button.setAttribute?.("aria-label", "Clip");
      autoButton.textContent = "Auto";
      autoButton.setAttribute?.("aria-label", "Auto");
      refreshAutoButtonState();
      updateQualityTooltips();
    };

    button.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      if (toolbarMode !== "idle" || button.disabled) {
        return;
      }
      setToolbarMode("clip");
      void startClipFromReader(reader, normalizeQualityKey(select.value), null, {
        imageCategory: normalizeImageCategoryKey(categorySelect.value),
        onSessionEnd() {
          setToolbarMode("idle");
          void syncAutoRasterAvailability(normalizeQualityKey(select.value));
        },
      });
    });

    autoButton.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      if (toolbarMode !== "idle" || autoButton.disabled) {
        return;
      }
      setToolbarMode("auto");
      Promise.resolve(saveAutoDetectedPageImagePreviews(reader, {
        qualityKey: normalizeQualityKey(select.value),
        imageCategory: normalizeImageCategoryKey(categorySelect.value),
      })).finally(() => {
        setToolbarMode("idle");
        void syncAutoRasterAvailability(normalizeQualityKey(select.value));
      });
    });
    const updateQualityTooltips = () => {
      const qualityKey = normalizeQualityKey(select.value);
      const categoryKey = normalizeImageCategoryKey(categorySelect.value);
      if (toolbarMode !== "idle") {
        return;
      }
      select.title = `Q ${getQualityLabelWithEstimate(qualityKey)}`;
      categorySelect.title = `Cat ${getImageCategoryLabel(categoryKey)}`;
      button.title = `${buildToolbarActionTooltip("Clip HTML", qualityKey)}; ${getImageCategoryMark(categoryKey)}`;
      refreshAutoButtonState(qualityKey);
    };
    select.addEventListener("change", () => {
      if (toolbarMode !== "idle") {
        return;
      }
      const qualityKey = normalizeQualityKey(select.value);
      setStringPref("defaultQuality", qualityKey);
      updateQualityTooltips();
      void syncAutoRasterAvailability(qualityKey);
    });
    categorySelect.addEventListener("change", () => {
      if (toolbarMode !== "idle") {
        return;
      }
      setStringPref("defaultImageCategory", normalizeImageCategoryKey(categorySelect.value));
      updateQualityTooltips();
    });
    updateQualityTooltips();
    void syncAutoRasterAvailability(normalizeQualityKey(select.value));
    group.append(select, categorySelect, button, autoButton);
    append(group);
  }

  function onCreateViewContextMenu(event) {
    const { reader, params, append } = event;
    if (!isPDFReader(reader) || typeof append !== "function") {
      return;
    }
    for (const action of buildContextMenuActions(reader, params)) {
      append(action);
    }
  }

  function buildContextMenuActions(reader, params, commands = {}) {
    const handlers = normalizeOptionsObject(commands);
    const startClip = typeof handlers.startClip === "function" ? handlers.startClip : startClipFromReader;
    const saveAuto = typeof handlers.saveAuto === "function" ? handlers.saveAuto : saveAutoDetectedPageImagePreviews;
    const savePage = typeof handlers.savePage === "function" ? handlers.savePage : savePagePreviewIndex;
    const saveOriginal = typeof handlers.saveOriginal === "function" ? handlers.saveOriginal : confirmAndSaveOriginalImagesFromReader;
    const diagnostics = typeof handlers.diagnostics === "function" ? handlers.diagnostics : showReaderDiagnostics;
    const actions = [];
    const defaultQualityKey = getDefaultQualityKey();
    const defaultQuality = QUALITY[defaultQualityKey];
    const defaultCategoryKey = getDefaultImageCategoryKey();
    const pageOriginalMaxImages = getHelperMaxImages("page");
    const documentOriginalMaxImages = getHelperMaxImages("document");

    for (const key of ["low", "medium", "high"]) {
      actions.push({
        label: `Clip ${getQualityMark(key)} ${QUALITY[key].label}; ${formatQualityEstimateShort(key)}; ${getImageCategoryMark(defaultCategoryKey)}`,
        onCommand() {
          void startClip(reader, key, getContextPageIndex(params), {
            imageCategory: defaultCategoryKey,
          });
        },
      });
    }

    actions.push({
      label: `Auto ${getQualityMark(defaultQualityKey)} ${defaultQuality.label}; ${formatQualityEstimateShort(defaultQualityKey)}; ${getImageCategoryMark(defaultCategoryKey)}`,
      onCommand() {
        void saveAuto(reader, {
          qualityKey: defaultQualityKey,
          imageCategory: defaultCategoryKey,
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Page ${getQualityMark(defaultQualityKey)} ${defaultQuality.label}; ${formatQualityEstimateShort(defaultQualityKey)}; ${getImageCategoryMark(defaultCategoryKey)}`,
      onCommand() {
        void savePage(reader, {
          qualityKey: defaultQualityKey,
          imageCategory: defaultCategoryKey,
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Orig page; max ${pageOriginalMaxImages}`,
      onCommand() {
        void saveOriginal(reader, {
          scope: "page",
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Orig doc; max ${documentOriginalMaxImages}`,
      onCommand() {
        void saveOriginal(reader, {
          scope: "document",
        });
      },
    });

    actions.push({
      label: "Diag",
      onCommand() {
        void diagnostics(reader);
      },
    });
    return actions;
  }

  async function startClipFromActiveReader(win, qualityKey) {
    const reader = getActiveReader(win);
    if (!reader) {
      Services.prompt.alert(win, "PDF Img", "Capture failed: no PDF.");
      return;
    }
    await startClipFromReader(reader, qualityKey);
  }

  async function showDiagnostics(win) {
    const reader = getActiveReader(win);
    const report = reader
      ? await buildRuntimeDiagnostics(reader)
      : await buildRuntimeDiagnostics(null);
    Services.prompt.alert(win, "PDF Img Diag", formatDiagnosticsReport(report));
  }

  async function showReaderDiagnostics(reader) {
    const report = await buildRuntimeDiagnostics(reader);
    const win = Zotero.getMainWindow?.();
    Services.prompt.alert(win, "PDF Img Diag", formatDiagnosticsReport(report));
  }

  async function buildRuntimeDiagnostics(reader) {
    const report = {
      plugin: `${config.id} ${config.version}`,
      zotero: Zotero.version,
      started,
      reader_count: Zotero.Reader?._readers?.length || 0,
      active_pdf_reader: false,
      temp_dir: PathUtils.join(PathUtils.tempDir, ADDON_REF),
      temp_leftovers: 0,
      temp_bytes: 0,
      default_quality: getDefaultQualityKey(),
      default_image_category: getDefaultImageCategoryKey(),
      max_index: formatBytes(getMaxIndexBytes()),
      auto_cap: formatBytes(getAutoMaxPreviewBytes()),
      auto_max_images: clamp(getIntegerPref("autoDetectMaxImages", DEFAULT_AUTO_DETECT_MAX_IMAGES), 1, 50),
      auto_min_area: clamp(getNumberPref("minAutoImageArea", DEFAULT_MIN_AUTO_IMAGE_AREA), 0.0001, 0.5),
      helper_min_area: clamp(getNumberPref("minImageArea", DEFAULT_MIN_AREA), 0.0001, 0.5),
      helper_page_max: getHelperMaxImages("page"),
      helper_doc_max: getHelperMaxImages("document"),
      helper_timeout_s: getHelperTimeoutSeconds(),
      helper_python_mode: getStringPref("pythonPath", "").trim() ? "custom" : "auto",
      duplicate_guard: getBoolPref("duplicateGuard", true),
      warnings: [],
    };

    try {
      const tempStats = await getTempDirectoryStats(report.temp_dir);
      report.temp_leftovers = tempStats.count;
      report.temp_bytes = tempStats.bytes;
    } catch (error) {
      report.warnings.push(`Temp: ${getErrorMessage(error)}`);
    }

    if (!reader || !isPDFReader(reader)) {
      report.warnings.push("No PDF.");
      return report;
    }

    report.active_pdf_reader = true;
    try {
      const attachment = getReaderPDFAttachment(reader);
      report.pdf_attachment = {
        id: attachment.id,
        key: attachment.key,
        library_id: attachment.libraryID,
        parent_id: attachment.parentID || null,
        title: attachment.getField("title"),
      };
      report.library_prefix = getLibraryURIPath(attachment.libraryID);
      const pageIndex = await getCurrentPageIndex(reader);
      report.page_number = pageIndex + 1;
      report.open_pdf_uri = buildOpenPDFURI(attachment, pageIndex + 1);
      const context = await getPDFViewerContext(reader);
      const pageView = getPageView(context, pageIndex);
      const pdfPage = pageView?.pdfPage || await context?.app?.pdfDocument?.getPage?.(pageIndex + 1);
      report.auto_raster_available = !!(pdfPage && supportsPDFJSImageCoordinates(pdfPage));
      report.page_label = getPageLabel(context, pageIndex);
    } catch (error) {
      report.warnings.push(getErrorMessage(error));
    }

    try {
      const pythonCommands = await getPythonCommands();
      report.optional_helper = pythonCommands.length ? "python-available" : "python-missing";
    } catch (error) {
      report.optional_helper = "unknown";
      report.warnings.push(`Helper: ${getErrorMessage(error)}`);
    }
    return report;
  }

  function formatDiagnosticsReport(report) {
    const safeReport = normalizeOptionsObject(report);
    const pdfAttachment = normalizeOptionsObject(safeReport.pdf_attachment);
    const pageNumber = normalizePageNumber(safeReport.page_number, 1);
    const pageLabel = normalizeDiagnosticText(safeReport.page_label, null, 80);
    const warnings = normalizeDiagnosticWarningMessages(safeReport.warnings);
    const lines = [
      `Plugin: ${normalizeDiagnosticText(safeReport.plugin, "unknown", 120)}; Zotero ${normalizeDiagnosticText(safeReport.zotero, "unknown", 80)}`,
      "Store: HTML; sync PDF",
      `Run: ${formatDiagnosticBoolean(safeReport.started)}; readers ${normalizeNonNegativeInteger(safeReport.reader_count, 0)}; PDF ${formatDiagnosticBoolean(safeReport.active_pdf_reader)}`,
      `Q ${getQualityLabelWithEstimate(safeReport.default_quality)}`,
      `Dups: ${formatDiagnosticDups(safeReport.duplicate_guard)}`,
      `Auto: min ${formatDiagnosticArea(safeReport.auto_min_area)}; ${normalizeNonNegativeInteger(safeReport.auto_max_images, 0)} max; ${normalizeDiagnosticText(safeReport.auto_cap, "unknown", 80)}`,
      `Index: ${normalizeDiagnosticText(safeReport.max_index, "unknown", 80)}`,
      `Helper: opt; ${formatOptionalHelperStatus(safeReport.optional_helper)}; min ${formatDiagnosticArea(safeReport.helper_min_area)}; page ${normalizeNonNegativeInteger(safeReport.helper_page_max, 0)}; doc ${normalizeNonNegativeInteger(safeReport.helper_doc_max, 0)}; ${normalizeNonNegativeInteger(safeReport.helper_timeout_s, 0)}s; ${formatHelperPythonMode(safeReport.helper_python_mode)}`,
      `Temp: ${normalizeNonNegativeInteger(safeReport.temp_leftovers, 0)} (${formatBytes(safeReport.temp_bytes)}); ${normalizeDiagnosticText(safeReport.temp_dir, "unknown", 160)}`,
    ];
    if (safeReport.pdf_attachment) {
      lines.push(
        `PDF: ${normalizeItemKey(pdfAttachment.key, "UNKNOWN")}; lib ${normalizeDiagnosticText(safeReport.library_prefix, "library", 80)}; parent ${normalizeDiagnosticText(pdfAttachment.parent_id, "none", 80)}`,
        `Page: ${pageNumber}${pageLabel ? ` (${pageLabel})` : ""}; auto ${formatDiagnosticBoolean(safeReport.auto_raster_available)}`,
        `Open: ${normalizeDiagnosticText(safeReport.open_pdf_uri, "n/a", 240)}`,
      );
    }
    if (warnings.length) {
      lines.push("Warn:", ...warnings.map((warning) => `- ${warning}`));
    }
    return lines.join("\n");
  }

  function normalizeDiagnosticText(value, fallback = "unknown", maxLength = 220) {
    return normalizeMetadataText(value, fallback, maxLength);
  }

  function normalizeDiagnosticWarningMessages(warnings) {
    const values = Array.isArray(warnings) ? warnings : [];
    const normalized = [];
    for (const warning of values) {
      const text = normalizeDiagnosticText(warning, null, 220);
      if (text) {
        normalized.push(text);
      }
      if (normalized.length >= 6) {
        break;
      }
    }
    return normalized;
  }

  function formatDiagnosticBoolean(value) {
    return value === true ? "on" : value === false ? "off" : "unknown";
  }

  function formatDiagnosticDups(value) {
    if (value === true) {
      return "on; sess+saved";
    }
    if (value === false) {
      return "off";
    }
    return "unknown";
  }

  function formatDiagnosticArea(value, fallback = "unknown") {
    const number = toFiniteNumber(value);
    if (number === null) {
      return fallback;
    }
    return String(Number(clamp(number, 0.0001, 0.5).toFixed(3)));
  }

  function formatOptionalHelperStatus(value) {
    const key = normalizeDiagnosticText(value, "unknown", 40);
    if (key === "python-available") {
      return "py ok";
    }
    if (key === "python-missing") {
      return "py missing";
    }
    return "unknown";
  }

  function formatHelperPythonMode(value) {
    const key = normalizeDiagnosticText(value, "auto", 24).toLowerCase();
    if (key === "custom" || key === "custom py") {
      return "custom py";
    }
    if (key === "auto" || key === "auto py") {
      return "auto py";
    }
    return "auto py";
  }

  async function startClipFromReader(reader, qualityKey, explicitPageIndex, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const onSessionEnd = typeof safeOptions.onSessionEnd === "function" ? safeOptions.onSessionEnd : null;
    try {
      const pageIndex = await getCurrentPageIndex(reader, explicitPageIndex);
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: canvas missing.");
      }
      showReaderToast(reader, `Drag ${formatPageToastToken(pageIndex)}; Q ${getQualityLabelWithEstimate(qualityKey)}; Esc/RMB.`, "info");
      installSelectionOverlay(reader, context.doc, pageElement, canvas, qualityKey, pageIndex, {
        onSessionEnd,
      });
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      onSessionEnd?.();
    }
  }

  function installSelectionOverlay(reader, doc, pageElement, canvas, qualityKey, pageIndex, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const onSessionEnd = typeof safeOptions.onSessionEnd === "function" ? safeOptions.onSessionEnd : null;
    const existing = doc.getElementById("pdf-image-saver-selection-overlay");
    if (existing) {
      const previousEnd = existing.__pdfImageSaverOnSessionEnd;
      existing.__pdfImageSaverOnSessionEnd = null;
      cleanupSelectionOverlay(existing);
      if (typeof previousEnd === "function") {
        previousEnd();
      }
    }

    const overlay = doc.createElement("div");
    overlay.id = "pdf-image-saver-selection-overlay";
    overlay.tabIndex = 0;
    overlay.className = "pdf-image-saver-selection-overlay";
    overlay.setAttribute?.("role", "application");
    const pageToken = formatPageToastToken(pageIndex);
    const qualityToken = getQualityLabelWithEstimate(qualityKey);
    const dragHint = `Drag ${pageToken}; Q ${qualityToken}; Esc/RMB`;
    overlay.setAttribute?.("aria-label", `Clip ${pageToken}. ${dragHint}.`);
    overlay.title = dragHint;
    overlay.__pdfImageSaverOnSessionEnd = onSessionEnd;
    prepareSelectionOverlayHost(pageElement, overlay);
    const hint = doc.createElement("div");
    hint.className = "pdf-image-saver-selection-hint";
    hint.textContent = dragHint;
    const selection = doc.createElement("div");
    selection.className = "pdf-image-saver-selection-box";
    selection.__pdfImageSaverQualityMark = getQualityMark(qualityKey);
    const sizeBadge = doc.createElement("div");
    sizeBadge.className = "pdf-image-saver-selection-size";
    sizeBadge.textContent = "";
    selection.append(sizeBadge);
    overlay.append(hint, selection);
    pageElement.appendChild(overlay);
    overlay.focus();

    let start = null;
    let current = null;
    let activePointerID = null;
    let sessionEnded = false;

    const endSession = () => {
      if (sessionEnded) {
        return;
      }
      sessionEnded = true;
      overlay.__pdfImageSaverOnSessionEnd = null;
      cleanupSelectionOverlay(overlay);
      onSessionEnd?.();
    };

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault?.();
        event.stopPropagation?.();
        endSession();
        showReaderToast(reader, `Clip cancel ${formatPageToastToken(pageIndex)}.`, "warning");
      }
    });

    overlay.addEventListener("contextmenu", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      endSession();
      showReaderToast(reader, `Clip cancel ${formatPageToastToken(pageIndex)}.`, "warning");
    });

    overlay.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || activePointerID !== null) {
        return;
      }
      event.preventDefault();
      activePointerID = event.pointerId;
      overlay.setPointerCapture?.(event.pointerId);
      hint.remove?.();
      const rect = pageElement.getBoundingClientRect();
      start = {
        clientX: event.clientX,
        clientY: event.clientY,
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };
      current = start;
      renderSelection(selection, start, current);
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== activePointerID) {
        return;
      }
      const rect = pageElement.getBoundingClientRect();
      current = {
        clientX: event.clientX,
        clientY: event.clientY,
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };
      renderSelection(selection, start, current);
    });

    overlay.addEventListener("pointerup", (event) => {
      if (!start || event.pointerId !== activePointerID) {
        return;
      }
      event.preventDefault();
      overlay.releasePointerCapture?.(event.pointerId);
      const end = current || start;
      const rect = normalizedRect(start, end);
      endSession();
      if (rect.width < 12 || rect.height < 12) {
        showReaderToast(reader, `Clip tiny ${formatPageToastToken(pageIndex)}.`, "warning");
        return;
      }
      void saveClipPreviewIndex(reader, {
        canvas,
        pageElement,
        pageIndex,
        qualityKey,
        selectionRect: rect,
      });
    });

    const cancelPointer = (event) => {
      if (activePointerID !== null && event.pointerId !== activePointerID) {
        return;
      }
      activePointerID = null;
      start = null;
      current = null;
      selection.removeAttribute("style");
    };
    overlay.addEventListener("pointercancel", cancelPointer);
    overlay.addEventListener("lostpointercapture", cancelPointer);
  }

  function prepareSelectionOverlayHost(pageElement, overlay) {
    const previousPosition = pageElement?.style?.position || "";
    overlay.__pdfImageSaverHost = pageElement;
    overlay.__pdfImageSaverPreviousPosition = previousPosition;
    overlay.setAttribute?.("data-pdf-image-saver-previous-position", previousPosition);
    if (!previousPosition || previousPosition === "static") {
      pageElement.style.position = "relative";
    }
  }

  function cleanupSelectionOverlay(overlay) {
    if (!overlay) {
      return;
    }
    const host = overlay.__pdfImageSaverHost || overlay.parentElement;
    if (host?.style) {
      const previousPosition =
        overlay.__pdfImageSaverPreviousPosition ??
        overlay.getAttribute?.("data-pdf-image-saver-previous-position") ??
        "";
      host.style.position = previousPosition;
    }
    overlay.remove?.();
  }

  function renderSelection(selection, start, current) {
    const rect = normalizedRect(start, current);
    Object.assign(selection.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const sizeBadge = selection.querySelector?.(".pdf-image-saver-selection-size");
    if (sizeBadge) {
      const width = Math.max(0, Math.round(rect.width));
      const height = Math.max(0, Math.round(rect.height));
      const tooSmall = width < 12 || height < 12;
      const qualityMark = selection.__pdfImageSaverQualityMark || getQualityMark("medium");
      sizeBadge.textContent = tooSmall
        ? `${width}x${height} min12 ${qualityMark}`
        : `${width}x${height} ${qualityMark}`;
      sizeBadge.className = tooSmall
        ? "pdf-image-saver-selection-size is-min"
        : "pdf-image-saver-selection-size";
      sizeBadge.hidden = width < 1 && height < 1;
    }
  }

  async function saveClipPreviewIndex(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const safeOptions = normalizeOptionsObject(options);
      const pageIndex = normalizePageIndex(safeOptions.pageIndex, 0);
      const qualityKey = normalizeQualityKey(safeOptions.qualityKey);
      jobKey = getReaderJobKey(reader, {
        scope: "clip",
        pageIndex,
      });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, `Clip busy ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}.`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Save clip ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}...`, "progress");
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const preview = renderCanvasPreview({
        ...safeOptions,
        pageIndex,
        qualityKey,
        imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
      });
      const duplicateKey = getPreviewDuplicateKey(attachment, preview);
      const indexKey = getPreviewIndexKey(attachment, [preview], "clip", qualityKey);
      if (getBoolPref("duplicateGuard", true)) {
        const skipReason = await classifyPreviewDuplicateSkipReason({
          parentItem,
          indexKey,
          memoryKeys: [duplicateKey],
          sourceRegionKeys: [getSourceRegionKey(attachment, preview)],
        });
        if (skipReason) {
          showReaderToast(reader, formatPreviewDuplicateSkipReason("clip", skipReason, pageIndex), "warning");
          return null;
        }
      }
      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: [preview],
        scope: "clip",
        qualityKey,
        indexKey,
      });
      const imported = await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "clip",
        pageIndex,
        entries: [preview],
        qualityKey,
        indexKey,
      });
      showReaderToast(
        reader,
        `OK clip ${formatPageToastToken(pageIndex)} (${getQualityMark(qualityKey)}; ${formatQualityEstimateShort(qualityKey)}; ${getImageCategoryMark(preview.imageCategory)}; ${formatBytes(preview.byteCount)}; ${formatPaletteLabel(preview.palette)}).`,
        "success",
      );
      rememberPreviewIndexSave(attachment, [preview], indexKey);
      return imported;
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      return null;
    } finally {
      if (jobAdded) {
        activeJobs.delete(jobKey);
      }
    }
  }

  async function saveAutoDetectedPageImagePreviews(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const safeOptions = normalizeOptionsObject(options);
      const qualityKey = normalizeQualityKey(safeOptions.qualityKey);
      const pageIndex = await getCurrentPageIndex(reader, safeOptions.pageIndex);
      jobKey = getReaderJobKey(reader, { scope: "auto-page", pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, `Auto busy ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}.`, "warning");
        return null;
      }

      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Auto detect ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}...`, "progress");
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: canvas missing.");
      }

      const detection = await detectPageImageCandidates({
        context,
        pageElement,
        canvas,
        pageIndex,
      });
      if (!detection.candidates.length) {
        showReaderToast(
          reader,
          formatAutoNoCandidatesReason(detection.reason, pageIndex),
          "warning",
        );
        return null;
      }

      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const previews = [];
      const duplicateGuard = getBoolPref("duplicateGuard", true);
      const existingIndexIdentities = duplicateGuard
        ? await getExistingPreviewIndexIdentities(parentItem)
        : createEmptyPreviewIndexIdentities();
      const maxBytes = getAutoMaxPreviewBytes();
      let totalBytes = 0;
      let skippedSessionDuplicates = 0;
      let skippedSavedDuplicates = 0;
      let skippedByteLimit = 0;
      let skippedOversized = 0;

      for (const candidate of detection.candidates) {
        const preview = renderCanvasPreview({
          canvas,
          pageElement,
          pageIndex,
          qualityKey,
          selectionRect: candidate.selectionRect,
          pageLabel: detection.pageLabel,
          mode: "auto_detected_reader_canvas_preview",
          detector: candidate.detector,
          detectionArea: candidate.area,
          imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
        });
        const duplicateKey = getPreviewDuplicateKey(attachment, preview);
        const sourceRegionKey = getSourceRegionKey(attachment, preview);
        const sessionDuplicate = recentIndexSaves.has(duplicateKey) || recentIndexSaves.has(sourceRegionKey);
        const savedDuplicate = existingIndexIdentities.entryKeys.has(duplicateKey)
          || existingIndexIdentities.sourceRegionKeys.has(sourceRegionKey);
        if (duplicateGuard && (sessionDuplicate || savedDuplicate)) {
          if (savedDuplicate) {
            skippedSavedDuplicates += 1;
          } else {
            skippedSessionDuplicates += 1;
          }
          continue;
        }
        if (preview.byteCount > maxBytes) {
          skippedOversized += 1;
          continue;
        }
        if (totalBytes + preview.byteCount > maxBytes) {
          skippedByteLimit += 1;
          break;
        }
        previews.push(preview);
        totalBytes += preview.byteCount;
      }

      if (!previews.length) {
        const reason = formatAutoDuplicateSkipReason({
          skippedSessionDuplicates,
          skippedSavedDuplicates,
          skippedByteLimit,
          skippedOversized,
          pageIndex,
        });
        showReaderToast(reader, reason, "warning");
        return null;
      }

      const indexKey = getPreviewIndexKey(attachment, previews, "auto-page", qualityKey);
      if (duplicateGuard) {
        const skipReason = await classifyPreviewDuplicateSkipReason({
          parentItem,
          indexKey,
          memoryKeys: previews.map((preview) => getPreviewDuplicateKey(attachment, preview)),
          sourceRegionKeys: previews.map((preview) => getSourceRegionKey(attachment, preview)),
        });
        if (skipReason) {
          showReaderToast(reader, formatPreviewDuplicateSkipReason("auto-page", skipReason, pageIndex), "warning");
          return null;
        }
      }

      showReaderToast(reader, `Save ${previews.length} auto ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}...`, "progress");
      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: previews,
        scope: "auto-page",
        qualityKey,
        indexKey,
      });
      const imported = await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "auto-page",
        pageIndex,
        entries: previews,
        qualityKey,
        indexKey,
      });
      rememberPreviewIndexSave(attachment, previews, indexKey);
      const notes = [];
      if (skippedSavedDuplicates) {
        notes.push(`${skippedSavedDuplicates} saved dup${skippedSavedDuplicates === 1 ? "" : "s"}`);
      }
      if (skippedSessionDuplicates) {
        notes.push(`${skippedSessionDuplicates} session dup${skippedSessionDuplicates === 1 ? "" : "s"}`);
      }
      if (skippedByteLimit) {
        notes.push("byte cap");
      }
      if (skippedOversized) {
        notes.push(`${skippedOversized} item cap`);
      }
      showReaderToast(
        reader,
        `OK ${previews.length} auto ${formatPageToastToken(pageIndex)} (${getQualityMark(qualityKey)}; ${formatQualityEstimateShort(qualityKey)}; ${formatCategorySummary(previews)}; ${formatBytes(totalBytes)}${notes.length ? `; ${notes.join(", ")}` : ""}).`,
        "success",
      );
      return imported;
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      return null;
    } finally {
      if (jobAdded) {
        activeJobs.delete(jobKey);
      }
    }
  }

  function formatAutoDuplicateSkipReason({
    skippedSessionDuplicates = 0,
    skippedSavedDuplicates = 0,
    skippedByteLimit = 0,
    skippedOversized = 0,
    pageIndex = null,
  } = {}) {
    const pageToken = pageIndex === null || pageIndex === undefined ? "" : ` ${formatPageToastToken(pageIndex)}`;
    const duplicateReason = skippedSavedDuplicates && skippedSessionDuplicates
      ? "saved/session dups"
      : skippedSavedDuplicates
        ? "saved dups"
        : skippedSessionDuplicates
          ? "session dups"
          : null;
    const capReason = skippedOversized && skippedByteLimit
      ? "item+total caps"
      : skippedOversized
        ? "item cap"
        : skippedByteLimit
          ? "total cap"
          : null;
    if (duplicateReason && capReason) {
      return `Auto skip${pageToken}: ${duplicateReason}; ${capReason}.`;
    }
    if (capReason) {
      return `Auto skip${pageToken}: ${capReason}.`;
    }
    if (skippedSavedDuplicates && skippedSessionDuplicates) {
      return `Auto skip${pageToken}: all saved/session dups.`;
    }
    if (skippedSavedDuplicates) {
      return `Auto skip${pageToken}: all saved dups.`;
    }
    if (skippedSessionDuplicates) {
      return `Auto skip${pageToken}: all session dups.`;
    }
    return `Auto skip${pageToken}: byte cap.`;
  }

  function formatAutoNoCandidatesReason(reason, pageIndex = null) {
    const pageToken = pageIndex === null || pageIndex === undefined ? "" : ` ${formatPageToastToken(pageIndex)}`;
    const text = normalizeMetadataText(reason, "", 120);
    const compact = !text
      ? "no images"
      : text === "PDF.js render API unavailable." || text === "render API missing"
        ? "render API missing"
        : text === "Auto unavailable in this PDF.js runtime." || text === "runtime no coords"
          ? "runtime no coords"
          : text === "No PDF.js image coordinates." || text === "no image coords"
            ? "no image coords"
            : text === "Auto detection unavailable." || text === "detect failed"
              ? "detect failed"
              : text === "No auto images."
                ? "no images"
                : text.replace(/\.$/, "");
    return `Auto skip${pageToken}: ${compact}. Use clip.`;
  }

  function formatPreviewDuplicateSkipReason(scope, reason, pageIndex = null) {
    const pageToken = pageIndex === null || pageIndex === undefined ? "" : ` ${formatPageToastToken(pageIndex)}`;
    const kind = reason === "session"
      ? "session dup"
      : reason === "saved"
        ? "saved dup"
        : "dup";
    if (scope === "page") {
      return `Page skip${pageToken}: ${kind}.`;
    }
    if (scope === "auto-page") {
      return `Auto skip${pageToken}: ${kind}.`;
    }
    return `Clip skip${pageToken}: ${kind}.`;
  }

  async function savePagePreviewIndex(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const safeOptions = normalizeOptionsObject(options);
      const pageIndex = await getCurrentPageIndex(reader, safeOptions.pageIndex);
      const qualityKey = normalizeQualityKey(safeOptions.qualityKey);
      jobKey = getReaderJobKey(reader, { scope: "page", pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, `Page busy ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}.`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Save page ${formatPageToastToken(pageIndex)} ${getQualityMark(qualityKey)}...`, "progress");
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: canvas missing.");
      }
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const pageRect = pageElement.getBoundingClientRect();
      const preview = renderCanvasPreview({
        canvas,
        pageElement,
        pageIndex,
        qualityKey,
        pageLabel: getPageLabel(context, pageIndex),
        selectionRect: {
          left: 0,
          top: 0,
          width: pageRect.width,
          height: pageRect.height,
        },
        imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
      });
      const duplicateKey = getPreviewDuplicateKey(attachment, preview);
      const indexKey = getPreviewIndexKey(attachment, [preview], "page", qualityKey);
      if (getBoolPref("duplicateGuard", true)) {
        const skipReason = await classifyPreviewDuplicateSkipReason({
          parentItem,
          indexKey,
          memoryKeys: [duplicateKey],
          sourceRegionKeys: [getSourceRegionKey(attachment, preview)],
        });
        if (skipReason) {
          showReaderToast(reader, formatPreviewDuplicateSkipReason("page", skipReason, pageIndex), "warning");
          return;
        }
      }
      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: [preview],
        scope: "page",
        qualityKey,
        indexKey,
      });
      await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "page",
        pageIndex,
        entries: [preview],
        qualityKey,
        indexKey,
      });
      rememberPreviewIndexSave(attachment, [preview], indexKey);
      showReaderToast(reader, `OK page ${formatPageToastToken(pageIndex)} (${getQualityMark(qualityKey)}; ${formatQualityEstimateShort(qualityKey)}; ${getImageCategoryMark(preview.imageCategory)}; ${formatBytes(preview.byteCount)}; ${formatPaletteLabel(preview.palette)}).`, "success");
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
    } finally {
      if (jobAdded) {
        activeJobs.delete(jobKey);
      }
    }
  }

  function renderCanvasPreview({
    canvas,
    pageElement,
    pageIndex,
    qualityKey,
    selectionRect,
    pageLabel,
    mode,
    detector,
    detectionArea,
    imageCategory: preferredImageCategory,
  }) {
    const normalizedQualityKey = normalizeQualityKey(qualityKey);
    const quality = QUALITY[normalizedQualityKey];
    const canvasRect = canvas.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    const crop = calculateCanvasCrop({
      selectionRect,
      pageRect,
      canvasRect,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
    const scale = Math.min(1, quality.maxWidth / crop.sourceWidth);
    const targetWidth = Math.max(1, Math.round(crop.sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(crop.sourceHeight * scale));
    const outputCanvas = canvas.ownerDocument.createElement("canvas");
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;
    const context = outputCanvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = normalizedQualityKey === "high" ? "high" : "medium";
    context.drawImage(
      canvas,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    const dataURL = outputCanvas.toDataURL("image/jpeg", quality.jpegQuality);
    const bboxNormalized = crop.bboxNormalized;
    const sourceRegion = buildSourceRegion(bboxNormalized);
    const detectionAreaValue = detectionArea || round6(selectionRect.width * selectionRect.height / Math.max(1, pageRect.width * pageRect.height));
    const palette = extractPaletteFromCanvas(outputCanvas);
    const styleTags = deriveStyleTagsFromPalette(palette);
    const preferredCategory = normalizeImageCategoryKey(preferredImageCategory);
    const imageCategory = preferredCategory === "auto"
      ? inferImageCategory({
          width: targetWidth,
          height: targetHeight,
          styleTags,
          palette,
          detector: detector || "manual_selection",
          detectionArea: detectionAreaValue,
        })
      : preferredCategory;
    return {
      id: `preview-p${pageIndex + 1}-${Date.now().toString(36)}`,
      mode: mode || "reader_canvas_preview",
      detector: detector || "manual_selection",
      pageIndex,
      pageNumber: pageIndex + 1,
      pageLabel: pageLabel || null,
      quality: normalizedQualityKey,
      qualityEstimate: quality.estimate,
      imageCategory,
      styleTags,
      palette,
      dataURL,
      byteCount: estimateDataURLBytes(dataURL),
      renderedWidth: targetWidth,
      renderedHeight: targetHeight,
      sourceCanvasWidth: canvas.width,
      sourceCanvasHeight: canvas.height,
      sourceX: crop.sourceX,
      sourceY: crop.sourceY,
      sourceWidth: crop.sourceWidth,
      sourceHeight: crop.sourceHeight,
      bboxNormalized,
      sourceRegion,
      annotationKey: null,
      detectionArea: detectionAreaValue,
      openPDFURI: "",
    };
  }

  function calculateCanvasCrop({ selectionRect, pageRect, canvasRect, canvasWidth, canvasHeight }) {
    if (!pageRect?.width || !pageRect?.height || !canvasRect?.width || !canvasRect?.height) {
      throw new Error("Capture failed: geometry n/a.");
    }
    const normalizedPageRect = rectWithEdges(pageRect);
    const normalizedCanvasRect = rectWithEdges(canvasRect);
    const selectionClientRect = {
      left: normalizedPageRect.left + selectionRect.left,
      top: normalizedPageRect.top + selectionRect.top,
      right: normalizedPageRect.left + selectionRect.left + selectionRect.width,
      bottom: normalizedPageRect.top + selectionRect.top + selectionRect.height,
    };
    const cropClient = intersectRects(selectionClientRect, normalizedCanvasRect);
    if (cropClient.width <= 0 || cropClient.height <= 0) {
      throw new Error("Capture failed: selection outside.");
    }

    const sourceX = clampInteger(
      Math.floor(((cropClient.left - normalizedCanvasRect.left) / normalizedCanvasRect.width) * canvasWidth),
      0,
      Math.max(0, canvasWidth - 1),
    );
    const sourceY = clampInteger(
      Math.floor(((cropClient.top - normalizedCanvasRect.top) / normalizedCanvasRect.height) * canvasHeight),
      0,
      Math.max(0, canvasHeight - 1),
    );
    const sourceRight = clampInteger(
      Math.ceil(((cropClient.right - normalizedCanvasRect.left) / normalizedCanvasRect.width) * canvasWidth),
      sourceX + 1,
      Math.max(1, canvasWidth),
    );
    const sourceBottom = clampInteger(
      Math.ceil(((cropClient.bottom - normalizedCanvasRect.top) / normalizedCanvasRect.height) * canvasHeight),
      sourceY + 1,
      Math.max(1, canvasHeight),
    );
    const roundedClient = {
      left: normalizedCanvasRect.left + (sourceX / canvasWidth) * normalizedCanvasRect.width,
      top: normalizedCanvasRect.top + (sourceY / canvasHeight) * normalizedCanvasRect.height,
      right: normalizedCanvasRect.left + (sourceRight / canvasWidth) * normalizedCanvasRect.width,
      bottom: normalizedCanvasRect.top + (sourceBottom / canvasHeight) * normalizedCanvasRect.height,
    };
    const bboxNormalized = [
      round6(clampNormalized((roundedClient.left - normalizedPageRect.left) / normalizedPageRect.width, 0)),
      round6(clampNormalized((roundedClient.top - normalizedPageRect.top) / normalizedPageRect.height, 0)),
      round6(clampNormalized((roundedClient.right - normalizedPageRect.left) / normalizedPageRect.width, 1)),
      round6(clampNormalized((roundedClient.bottom - normalizedPageRect.top) / normalizedPageRect.height, 1)),
    ];
    return {
      sourceX,
      sourceY,
      sourceWidth: sourceRight - sourceX,
      sourceHeight: sourceBottom - sourceY,
      bboxNormalized,
      cropClient,
      roundedClient,
    };
  }

  function rectWithEdges(rect) {
    const left = Number(rect?.left) || 0;
    const top = Number(rect?.top) || 0;
    const width = Number(rect?.width) || 0;
    const height = Number(rect?.height) || 0;
    return {
      left,
      top,
      width,
      height,
      right: Number.isFinite(Number(rect?.right)) ? Number(rect.right) : left + width,
      bottom: Number.isFinite(Number(rect?.bottom)) ? Number(rect.bottom) : top + height,
    };
  }

  async function detectPageImageCandidates({ context, pageElement, canvas, pageIndex }) {
    const pageView = getPageView(context, pageIndex);
    const pdfPage = pageView?.pdfPage || await context?.app?.pdfDocument?.getPage?.(pageIndex + 1);
    if (!pdfPage?.render || !pdfPage?.getViewport) {
      return { candidates: [], reason: "render API missing", pageLabel: getPageLabel(context, pageIndex) };
    }
    if (!supportsPDFJSImageCoordinates(pdfPage)) {
      return { candidates: [], reason: "runtime no coords", pageLabel: getPageLabel(context, pageIndex) };
    }

    const doc = pageElement.ownerDocument;
    const scratchCanvas = doc.createElement("canvas");
    let renderTask = null;
    try {
      const rotation = pageView?.viewport?.rotation ?? pdfPage.rotate ?? 0;
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation });
      const maxRenderDimension = 1200;
      const detectionScale = Math.min(1, maxRenderDimension / Math.max(baseViewport.width || 1, baseViewport.height || 1));
      const viewport = pdfPage.getViewport({ scale: detectionScale, rotation });
      scratchCanvas.width = Math.max(1, Math.ceil(viewport.width));
      scratchCanvas.height = Math.max(1, Math.ceil(viewport.height));
      const scratchContext = scratchCanvas.getContext("2d", { alpha: false });
      resetPDFJSImageCoordinates(pdfPage);
      renderTask = pdfPage.render({
        canvas: scratchCanvas,
        canvasContext: scratchContext,
        viewport,
        recordImages: true,
      });
      await renderTask.promise;
      const coordinates = pdfPage.imageCoordinates;
      if (!coordinates?.length) {
        return { candidates: [], reason: "no image coords", pageLabel: getPageLabel(context, pageIndex) };
      }
      return {
        candidates: imageCoordinatesToCandidates({
          coordinates,
          pageElement,
          canvas,
          pageIndex,
        }),
        pageLabel: getPageLabel(context, pageIndex),
      };
    } catch (error) {
      renderTask?.cancel?.();
      logError(error);
      return { candidates: [], reason: "detect failed", pageLabel: getPageLabel(context, pageIndex) };
    } finally {
      scratchCanvas.width = 0;
      scratchCanvas.height = 0;
    }
  }

  function imageCoordinatesToCandidates({ coordinates, pageElement, canvas, pageIndex }) {
    const pageRect = pageElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const minArea = clamp(getNumberPref("minAutoImageArea", DEFAULT_MIN_AUTO_IMAGE_AREA), 0.0001, 0.5);
    const maxCount = clamp(getIntegerPref("autoDetectMaxImages", DEFAULT_AUTO_DETECT_MAX_IMAGES), 1, 50);
    const candidates = [];

    for (let index = 0; index + 5 < coordinates.length; index += 6) {
      const x1 = Number(coordinates[index]);
      const y1 = Number(coordinates[index + 1]);
      const x2 = Number(coordinates[index + 2]);
      const y2 = Number(coordinates[index + 3]);
      const x3 = Number(coordinates[index + 4]);
      const y3 = Number(coordinates[index + 5]);
      const x4 = x2 + x3 - x1;
      const y4 = y2 + y3 - y1;
      const xs = [x1, x2, x3, x4].filter(Number.isFinite);
      const ys = [y1, y2, y3, y4].filter(Number.isFinite);
      if (xs.length !== 4 || ys.length !== 4) {
        continue;
      }

      const minX = clamp(Math.min(...xs), 0, 1);
      const minY = clamp(Math.min(...ys), 0, 1);
      const maxX = clamp(Math.max(...xs), 0, 1);
      const maxY = clamp(Math.max(...ys), 0, 1);
      if (maxX <= minX || maxY <= minY) {
        continue;
      }

      const selectionRect = clipSelectionRect({
        left: canvasRect.left - pageRect.left + minX * canvasRect.width,
        top: canvasRect.top - pageRect.top + minY * canvasRect.height,
        width: (maxX - minX) * canvasRect.width,
        height: (maxY - minY) * canvasRect.height,
      }, pageRect);
      const area = selectionRect.width * selectionRect.height / Math.max(1, pageRect.width * pageRect.height);
      if (selectionRect.width < 12 || selectionRect.height < 12 || area < minArea) {
        continue;
      }
      candidates.push({
        detector: "pdfjs_record_images",
        pageIndex,
        area: round6(area),
        selectionRect,
      });
    }

    return dedupeImageCandidates(candidates)
      .sort((left, right) => right.area - left.area)
      .slice(0, maxCount);
  }

  async function updateAutoRasterButtonState(reader, button, qualityKey = "medium") {
    try {
      const pageIndex = await getCurrentPageIndex(reader);
      const context = await getPDFViewerContext(reader);
      const pageView = getPageView(context, pageIndex);
      const pdfPage = pageView?.pdfPage || await context?.app?.pdfDocument?.getPage?.(pageIndex + 1);
      if (pdfPage) {
        applyAutoRasterButtonState(button, supportsPDFJSImageCoordinates(pdfPage), qualityKey);
      }
    } catch (error) {
      logError(error);
    }
  }

  function applyAutoRasterButtonState(button, isAvailable, qualityKey = "medium") {
    if (!button) {
      return;
    }
    if (isAvailable) {
      button.disabled = false;
      button.title = buildToolbarActionTooltip("Auto page", qualityKey);
      button.setAttribute?.("aria-label", "Auto");
      return;
    }
    button.disabled = true;
    button.title = "Auto n/a; Use clip.";
    button.setAttribute?.("aria-label", "Auto n/a");
  }

  function supportsPDFJSImageCoordinates(pdfPage) {
    if (!pdfPage?.render) {
      return false;
    }
    if ("imageCoordinates" in pdfPage) {
      return true;
    }
    try {
      return Function.prototype.toString.call(pdfPage.render).includes("recordImages");
    } catch (error) {
      logError(error);
      return false;
    }
  }

  function resetPDFJSImageCoordinates(pdfPage) {
    try {
      if ("imageCoordinates" in pdfPage) {
        pdfPage.imageCoordinates = null;
      }
    } catch (error) {
      logError(error);
    }
  }

  async function createIndexHTML({ attachment, parentItem, entries, scope, qualityKey, indexKey }) {
    const outputDir = await createTempDirectory();
    const htmlPath = PathUtils.join(outputDir, `pdf-image-index-${Zotero.Utilities.randomString(8)}.html`);
    try {
      const html = buildIndexHTML({
        attachment,
        parentItem,
        entries,
        scope,
        qualityKey,
        indexKey,
      });
      const htmlBytes = estimateUTF8Bytes(html);
      const maxBytes = getMaxIndexBytes();
      if (htmlBytes > maxBytes) {
        throw new Error(`Byte cap: index large (${formatBytes(htmlBytes)} > ${formatBytes(maxBytes)}). Lower Q/auto.`);
      }
      await Zotero.File.putContentsAsync(htmlPath, html);
      return htmlPath;
    } catch (error) {
      await removeDirectoryIfExists(outputDir);
      throw error;
    }
  }

  function buildIndexHTML({ attachment, parentItem, entries, scope, qualityKey, indexKey }) {
    const createdAt = new Date().toISOString();
    const sourceTitle = getSourceTitle(parentItem, attachment);
    const normalizedScope = normalizeScope(scope);
    const previewQualityKey = normalizeQualityKey(qualityKey);
    const normalizedEntries = normalizePreviewEntries(entries);
    applyStoryboardHints(normalizedEntries);
    const entriesHTML = normalizedEntries
      .map((entry, index) => {
        const pageTarget = normalizeEntryPageTarget(entry);
        const fallbackID = `preview-${index + 1}`;
        entry.id = normalizePreviewText(entry.id, fallbackID);
        entry.mode = normalizePreviewText(entry.mode, "reader_canvas_preview");
        entry.detector = normalizePreviewText(entry.detector, "unknown");
        entry.pageIndex = pageTarget.pageIndex;
        entry.pageNumber = pageTarget.pageNumber;
        entry.pageLabel = normalizePreviewText(entry.pageLabel, null);
        entry.quality = normalizeQualityKey(entry.quality);
        entry.qualityEstimate = QUALITY[entry.quality].estimate;
        entry.imageCategory = normalizeImageCategoryKey(entry.imageCategory || entry.image_category || getDefaultImageCategoryKey());
        entry.palette = normalizePalette(entry.palette);
        entry.colorFamily = normalizeColorFamily(entry.colorFamily || entry.color_family || deriveColorFamilyFromPalette(entry.palette));
        entry.dataURL = normalizePreviewDataURL(entry.dataURL);
        entry.byteCount = estimateDataURLBytes(entry.dataURL);
        entry.renderedWidth = normalizePositiveInteger(entry.renderedWidth, null);
        entry.renderedHeight = normalizePositiveInteger(entry.renderedHeight, null);
        entry.aspectRatio = normalizeAspectRatio(entry.aspectRatio || entry.aspect_ratio || deriveAspectRatio(entry.renderedWidth, entry.renderedHeight));
        entry.layoutHint = normalizeLayoutHint(entry.layoutHint || entry.layout_hint || deriveLayoutHint(entry.aspectRatio, entry.imageCategory));
        entry.dominantHex = normalizeHexColor(entry.dominantHex || entry.dominant_hex) || (entry.palette[0]?.hex || null);
        entry.contrastHex = normalizeHexColor(entry.contrastHex || entry.contrast_hex) || deriveContrastHex(entry.palette, entry.dominantHex);
        entry.slideSlot = normalizeSlideSlot(entry.slideSlot || entry.slide_slot || deriveSlideSlot(entry.layoutHint, entry.imageCategory, entry.aspectRatio));
        entry.roleHint = normalizeRoleHint(entry.roleHint || entry.role_hint || deriveRoleHint(entry.imageCategory, entry.slideSlot, entry.layoutHint));
        entry.insertHint = normalizeInsertHint(entry.insertHint || entry.insert_hint || deriveInsertHint(entry.slideSlot, entry.layoutHint, entry.aspectRatio, entry.roleHint));
        entry.captionHint = normalizeCaptionHint(entry.captionHint || entry.caption_hint || deriveCaptionHint({
          imageCategory: entry.imageCategory,
          roleHint: entry.roleHint,
          slideSlot: entry.slideSlot,
          layoutHint: entry.layoutHint,
          pageNumber: entry.pageNumber,
          colorFamily: entry.colorFamily,
          insertHint: entry.insertHint,
        }));
        entry.storyOrder = normalizeStoryOrder(entry.storyOrder || entry.story_order || (index + 1));
        entry.storyBeat = normalizeStoryBeat(entry.storyBeat || entry.story_beat || deriveStoryBeat({
          roleHint: entry.roleHint,
          captionHint: entry.captionHint,
          slideSlot: entry.slideSlot,
          order: entry.storyOrder,
          total: normalizedEntries.length,
        }));
        entry.styleTags = buildDrawingStyleTags({
          imageCategory: entry.imageCategory,
          styleTags: entry.styleTags || entry.style_tags,
          palette: entry.palette,
          colorFamily: entry.colorFamily,
          layoutHint: entry.layoutHint,
          aspectRatio: entry.aspectRatio,
          slideSlot: entry.slideSlot,
          roleHint: entry.roleHint,
          insertHint: entry.insertHint,
          captionHint: entry.captionHint,
          storyBeat: entry.storyBeat,
        });
        entry.detectionArea = normalizeUnitNumber(entry.detectionArea, null);
        entry.bboxNormalized = normalizeBBoxNormalized(entry.bboxNormalized);
        entry.annotationKey = normalizeAnnotationKey(entry.annotationKey);
        entry.sourceRegion = buildSourceRegion(entry.bboxNormalized);
        entry.sourceRegionKey = getSourceRegionKey(attachment, entry);
        entry.previewDuplicateKey = getPreviewDuplicateKey(attachment, entry);
        const uri = buildOpenPDFURI(attachment, entry.pageNumber, entry.annotationKey);
        entry.openPDFURI = uri;
        const pageText = entry.pageLabel && entry.pageLabel !== String(entry.pageNumber)
          ? `${entry.pageNumber} (${entry.pageLabel})`
          : String(entry.pageNumber);
        const regionIdentity = getSourceRegionFingerprint(entry.sourceRegionKey);
        const sourceRegionLabel = entry.sourceRegion?.label || entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ");
        const pptToken = buildPptAssistToken(entry);
        return `
          <article class="entry" id="e${index + 1}" data-entry="${index + 1}" data-category="${escapeHTML(entry.imageCategory)}" data-color-family="${escapeHTML(entry.colorFamily || "unknown")}" data-layout="${escapeHTML(entry.layoutHint || "unknown")}" data-slot="${escapeHTML(entry.slideSlot || "unknown")}" data-role="${escapeHTML(entry.roleHint || "unknown")}" data-insert="${escapeHTML(entry.insertHint?.size || "unknown")}" data-caption="${escapeHTML(entry.captionHint?.tone || "unknown")}" data-hue="${escapeHTML(entry.colorFamily || "unknown")}" data-beat="${escapeHTML(entry.storyBeat || "unknown")}" data-style-tags="${escapeHTML(entry.styleTags.join(","))}">
            <div class="preview-column">
              <div class="entry-badge">#${index + 1} ${escapeHTML(getQualityMark(entry.quality))} ${escapeHTML(getImageCategoryMark(entry.imageCategory))} ${escapeHTML(getLayoutHintMark(entry.layoutHint))} ${escapeHTML(getSlideSlotMark(entry.slideSlot))} ${escapeHTML(getRoleHintMark(entry.roleHint))} ${escapeHTML(getInsertSizeMark(entry.insertHint))} ${escapeHTML(getCaptionToneMark(entry.captionHint))} ${escapeHTML(getStoryBeatMark(entry.storyBeat))} ${escapeHTML(getColorFamilyMark(entry.colorFamily))}</div>
              <a class="preview-link" href="${escapeHTML(uri)}" data-source-region-key="${escapeHTML(entry.sourceRegionKey)}">
                <img src="${escapeHTML(entry.dataURL)}" alt="Preview p${escapeHTML(String(entry.pageNumber))} #${index + 1} ${escapeHTML(getImageCategoryMark(entry.imageCategory))} ${escapeHTML(getLayoutHintMark(entry.layoutHint))} ${escapeHTML(getSlideSlotMark(entry.slideSlot))} ${escapeHTML(getRoleHintMark(entry.roleHint))} ${escapeHTML(getInsertSizeMark(entry.insertHint))} ${escapeHTML(getCaptionToneMark(entry.captionHint))} ${escapeHTML(getStoryBeatMark(entry.storyBeat))} ${escapeHTML(getColorFamilyMark(entry.colorFamily))}">
              </a>
              ${buildSourceRegionMapHTML(entry.sourceRegion, uri, entry.pageNumber)}
              ${buildPaletteChipsHTML(entry.palette)}
              ${buildContrastPairHTML(entry.dominantHex, entry.contrastHex)}
              ${buildInsertHintHTML(entry.insertHint)}
              ${buildCaptionHintHTML(entry.captionHint)}
              ${buildStoryHintHTML(entry)}
              ${buildTagChipsHTML(entry.styleTags)}
              <div class="entry-actions">
                <a class="source-action" href="${escapeHTML(uri)}" title="Open p${escapeHTML(String(entry.pageNumber))}">Open p${escapeHTML(String(entry.pageNumber))}</a>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(pptToken)}" title="Copy PPT token">Copy PPT</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(formatPaletteLabel(entry.palette))}" title="Copy palette hex list">Copy pal</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}" title="Copy dominant/contrast pair">Copy pair</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildRolePackToken(entry))}" title="Copy role pack for PPT drawing">Copy role</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildInsertPackToken(entry))}" title="Copy insert pack for PPT placement">Copy insert</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildCaptionPackToken(entry))}" title="Copy caption pack for PPT text">Copy cap</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildStoryPackToken(entry))}" title="Copy storyboard pack for PPT narrative order">Copy story</button>
              </div>
            </div>
            <dl class="entry-summary">
              <div><dt>Page</dt><dd><a href="${escapeHTML(uri)}">${escapeHTML(pageText)}</a></dd></div>
              <div><dt>Q</dt><dd>${escapeHTML(getQualityLabelWithEstimate(entry.quality))}</dd></div>
              <div><dt>Cat</dt><dd>${escapeHTML(getImageCategoryLabel(entry.imageCategory))}</dd></div>
              <div><dt>Lay</dt><dd>${escapeHTML(formatLayoutHintLabel(entry.layoutHint, entry.aspectRatio))}</dd></div>
              <div><dt>Slot</dt><dd>${escapeHTML(formatSlideSlotLabel(entry.slideSlot))}</dd></div>
              <div><dt>Role</dt><dd>${escapeHTML(formatRoleHintLabel(entry.roleHint))}</dd></div>
              <div><dt>Ins</dt><dd>${escapeHTML(formatInsertHintLabel(entry.insertHint))}</dd></div>
              <div><dt>Cap</dt><dd>${escapeHTML(formatCaptionHintLabel(entry.captionHint))}</dd></div>
              <div><dt>Story</dt><dd>${escapeHTML(formatStoryHintLabel(entry))}</dd></div>
              <div><dt>Hue</dt><dd>${escapeHTML(formatColorFamilyLabel(entry.colorFamily))}</dd></div>
              <div><dt>Pair</dt><dd>${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}</dd></div>
              <div><dt>Det</dt><dd>${escapeHTML(formatPreviewDetectorLabel(entry.detector))}</dd></div>
              <div><dt>Tags</dt><dd>${escapeHTML(formatStyleTagsLabel(entry.styleTags))}</dd></div>
              <div><dt>Size</dt><dd>${formatBytes(entry.byteCount)}; ${formatPreviewDimensions(entry.renderedWidth, entry.renderedHeight)}; AR ${escapeHTML(formatAspectRatioLabel(entry.aspectRatio))}</dd></div>
              <div><dt>ID</dt><dd title="${escapeHTML(entry.sourceRegionKey)}">${escapeHTML(regionIdentity)}</dd></div>
            </dl>
            <details class="entry-details">
              <summary>Trace</summary>
              <dl>
                <div><dt>Map</dt><dd>${escapeHTML(sourceRegionLabel)}</dd></div>
                <div><dt>Box</dt><dd>${entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ")}</dd></div>
                <div><dt>Key</dt><dd>${escapeHTML(entry.sourceRegionKey)}</dd></div>
                <div><dt>Pal</dt><dd>${escapeHTML(formatPaletteLabel(entry.palette))}</dd></div>
                <div><dt>Lay</dt><dd>${escapeHTML(formatLayoutHintLabel(entry.layoutHint, entry.aspectRatio))}</dd></div>
                <div><dt>Slot</dt><dd>${escapeHTML(formatSlideSlotLabel(entry.slideSlot))}</dd></div>
                <div><dt>Role</dt><dd>${escapeHTML(formatRoleHintLabel(entry.roleHint))}</dd></div>
                <div><dt>Ins</dt><dd>${escapeHTML(formatInsertHintLabel(entry.insertHint))}</dd></div>
                <div><dt>Cap</dt><dd>${escapeHTML(formatCaptionHintLabel(entry.captionHint))}</dd></div>
                <div><dt>Story</dt><dd>${escapeHTML(formatStoryHintLabel(entry))}</dd></div>
                <div><dt>Pair</dt><dd>${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}</dd></div>
                <div><dt>Pack</dt><dd><code>${escapeHTML(buildRolePackToken(entry))}</code></dd></div>
                <div><dt>Insert</dt><dd><code>${escapeHTML(buildInsertPackToken(entry))}</code></dd></div>
                <div><dt>Caption</dt><dd><code>${escapeHTML(buildCaptionPackToken(entry))}</code></dd></div>
                <div><dt>StoryPack</dt><dd><code>${escapeHTML(buildStoryPackToken(entry))}</code></dd></div>
                <div><dt>PPT</dt><dd><code>${escapeHTML(pptToken)}</code></dd></div>
              </dl>
            </details>
          </article>`;
      })
      .join("\n");

    const previewIndexKey = normalizePreviewIndexKey(indexKey) || getPreviewIndexKey(attachment, normalizedEntries, normalizedScope, previewQualityKey);
    const totalPreviewBytes = normalizedEntries.reduce((sum, entry) => sum + normalizeNonNegativeInteger(entry.byteCount, 0), 0);
    const metadata = {
      schema_version: HELPER_SCHEMA_VERSION,
      created_at: createdAt,
      plugin: { id: config.id, version: config.version },
      storage_mode: "reader_preview_index",
      scope: normalizedScope,
      preview_quality: previewQualityKey,
      preview_index_key: previewIndexKey,
      preview_index_fingerprint: getPreviewIndexFingerprint(previewIndexKey),
      ppt_assist: buildIndexPptAssistSummary(normalizedEntries),
      zotero_version: Zotero.version,
      parent_item: serializeItem(parentItem),
      pdf_attachment: serializeAttachment(attachment),
      entries: normalizedEntries.map((entry) => ({
        id: entry.id,
        mode: entry.mode,
        detector: entry.detector,
        page_index: entry.pageIndex,
        page_number: entry.pageNumber,
        page_label: entry.pageLabel,
        quality: entry.quality,
        quality_estimate: entry.qualityEstimate,
        image_category: entry.imageCategory,
        color_family: entry.colorFamily,
        layout_hint: entry.layoutHint,
        aspect_ratio: entry.aspectRatio,
        slide_slot: entry.slideSlot,
        role_hint: entry.roleHint,
        insert_hint: entry.insertHint,
        caption_hint: entry.captionHint,
        story_order: entry.storyOrder,
        story_beat: entry.storyBeat,
        dominant_hex: entry.dominantHex,
        contrast_hex: entry.contrastHex,
        style_tags: entry.styleTags,
        palette: entry.palette,
        palette_json: JSON.stringify(entry.palette),
        style_tags_json: JSON.stringify(entry.styleTags),
        ppt_assist_token: buildPptAssistToken(entry),
        byte_count: entry.byteCount,
        rendered_width: entry.renderedWidth,
        rendered_height: entry.renderedHeight,
        bbox_normalized: entry.bboxNormalized,
        source_region: entry.sourceRegion,
        source_region_key: entry.sourceRegionKey,
        preview_duplicate_key: entry.previewDuplicateKey,
        annotation_key: entry.annotationKey,
        detection_area: entry.detectionArea,
        open_pdf_uri: entry.openPDFURI,
      })),
    };

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(sourceTitle)} - img index ${escapeHTML(formatPreviewScopeLabel(normalizedScope))}${previewQualityKey ? ` ${escapeHTML(getQualityMark(previewQualityKey))}` : ""}</title>
  <style>
    body { margin: 12px; font: 12.5px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { position: sticky; top: 0; z-index: 2; margin: 0 0 8px; padding: 8px 0 6px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid #e5e5e5; }
    h1 { font-size: 14px; margin: 0 0 3px; }
    .meta { color: #555; margin: 0 0 1px; line-height: 1.3; }
    .meta.actions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .meta.actions.footer-actions { margin-top: 10px; }
    .meta.jumps { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 6px; }
    .meta.jumps a { color: #0645ad; text-decoration: none; font-weight: 600; }
    .meta.jumps a:focus-visible { outline: 2px solid #1f73b7; outline-offset: 2px; }
    .entry { display: grid; grid-template-columns: minmax(120px, 260px) 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid #ddd; }
    .preview-column { display: grid; gap: 5px; align-content: start; position: relative; }
    .entry-badge { position: absolute; top: 4px; left: 4px; z-index: 1; padding: 1px 5px; border-radius: 3px; background: rgba(17, 24, 39, 0.82); color: #fff; font: 10.5px system-ui, sans-serif; pointer-events: none; }
    .palette-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .palette-chip { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); box-sizing: border-box; cursor: pointer; }
    .palette-chip:focus-visible { outline: 2px solid #1f73b7; outline-offset: 1px; }
    .contrast-pair { display: flex; align-items: center; gap: 4px; font: 11px system-ui, sans-serif; color: #444; }
    .contrast-swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); display: inline-block; }
    .insert-hint { display: flex; flex-wrap: wrap; gap: 4px; font: 11px system-ui, sans-serif; color: #355; }
    .insert-chip { border: 1px solid #9ab; border-radius: 999px; padding: 0 6px; background: #f3f8ff; }
    .caption-hint { display: grid; gap: 2px; font: 11px system-ui, sans-serif; color: #334; }
    .caption-chip { border: 1px solid #9ab; border-radius: 999px; padding: 0 6px; background: #f7fff5; width: fit-content; }
    .caption-title { font-weight: 600; color: #223; }
    .caption-note { color: #556; }
    .story-hint { display: flex; flex-wrap: wrap; gap: 4px; font: 11px system-ui, sans-serif; color: #345; }
    .story-chip { border: 1px solid #9ab; border-radius: 999px; padding: 0 6px; background: #fff8f0; }
    .tag-chips { display: flex; flex-wrap: wrap; gap: 3px; font: 10.5px system-ui, sans-serif; }
    .tag-chip { border: 1px solid #bcd; border-radius: 3px; padding: 0 4px; background: #f0f4fa; color: #456; }
    .filter-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 2px; }
    .filter-chip { appearance: none; border: 1px solid #9ab; background: #f7faff; color: #0645ad; border-radius: 999px; padding: 1px 8px; font: 11.5px system-ui, sans-serif; cursor: pointer; }
    .filter-chip[aria-pressed="true"] { background: #1f73b7; border-color: #1f73b7; color: #fff; }
    .entry.is-hidden { display: none; }
    .entry-actions { display: flex; flex-wrap: wrap; gap: 4px; }
    .source-action { display: inline-block; width: fit-content; padding: 2px 7px; border: 1px solid #9ab; border-radius: 3px; color: #0645ad; text-decoration: none; background: #f7faff; cursor: pointer; }
    .source-action:focus-visible, .source-map-link:focus-visible, .preview-link:focus-visible { outline: 2px solid #1f73b7; outline-offset: 2px; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; background: #f6f6f6; }
    .source-map-link { display: inline-block; width: fit-content; text-decoration: none; color: inherit; }
    .source-map { position: relative; width: 76px; aspect-ratio: 0.72; border: 1px solid #bbb; background: #fafafa; }
    .source-map span { position: absolute; min-width: 2px; min-height: 2px; border: 2px solid #1f73b7; background: rgba(31, 115, 183, 0.18); box-sizing: border-box; }
    dl { margin: 0; display: grid; gap: 3px; align-content: start; }
    dl div { display: grid; grid-template-columns: 40px 1fr; gap: 6px; }
    dt { color: #666; }
    dd { margin: 0; word-break: break-word; }
    .entry-details { grid-column: 2; }
    .entry-details summary { cursor: pointer; color: #444; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 8px; background: #f6f8fa; border: 1px solid #ddd; font-size: 11.5px; }
    @media (max-width: 720px) { .entry { grid-template-columns: 1fr; } .entry-details { grid-column: 1; } }
  </style>
</head>
<body>
  <header id="top">
    <h1>${escapeHTML(sourceTitle)}</h1>
    <p class="meta">Saved ${escapeHTML(createdAt)}. HTML; sync; ${escapeHTML(formatPreviewScopeLabel(normalizedScope))}.</p>
    <p class="meta">Index ${escapeHTML(getPreviewIndexFingerprint(previewIndexKey) || "unknown")}; ${normalizedEntries.length} img; ${escapeHTML(formatBytes(totalPreviewBytes))}; ${escapeHTML(getQualityLabelWithEstimate(previewQualityKey))}; ${escapeHTML(formatCategorySummary(normalizedEntries))}; ${escapeHTML(formatColorFamilySummary(normalizedEntries))}; ${escapeHTML(formatLayoutHintSummary(normalizedEntries))}; ${escapeHTML(formatSlideSlotSummary(normalizedEntries))}; ${escapeHTML(formatRoleHintSummary(normalizedEntries))}; ${escapeHTML(formatInsertHintSummary(normalizedEntries))}; ${escapeHTML(formatCaptionHintSummary(normalizedEntries))}; ${escapeHTML(formatStoryHintSummary(normalizedEntries))}</p>
    <p class="meta">PPT: ${escapeHTML(formatPptAssistSummary(normalizedEntries))}</p>
    ${buildCategoryFilterBarHTML(normalizedEntries)}
    ${buildHueFilterBarHTML(normalizedEntries)}
    ${buildLayoutFilterBarHTML(normalizedEntries)}
    ${buildSlideSlotFilterBarHTML(normalizedEntries)}
    ${buildRoleFilterBarHTML(normalizedEntries)}
    ${buildInsertFilterBarHTML(normalizedEntries)}
    ${buildCaptionFilterBarHTML(normalizedEntries)}
    ${buildStoryFilterBarHTML(normalizedEntries)}
    ${buildTagFilterBarHTML(normalizedEntries)}
    ${normalizedEntries.length ? `<p class="meta actions"><a class="source-action" href="${escapeHTML(normalizedEntries[0].openPDFURI)}" title="Open first p${escapeHTML(String(normalizedEntries[0].pageNumber))}">Open first p${escapeHTML(String(normalizedEntries[0].pageNumber))}</a>${normalizedEntries.length > 1 ? ` <a class="source-action" href="${escapeHTML(normalizedEntries[normalizedEntries.length - 1].openPDFURI)}" title="Open last p${escapeHTML(String(normalizedEntries[normalizedEntries.length - 1].pageNumber))}">Open last p${escapeHTML(String(normalizedEntries[normalizedEntries.length - 1].pageNumber))}</a>` : ""} <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildIndexPptAssistToken(normalizedEntries))}" title="Copy index PPT assist token">Copy PPT all</button> <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildIndexStoryboardToken(normalizedEntries))}" title="Copy storyboard sequence for PPT narrative order">Copy story all</button> <button type="button" class="source-action" id="pdf-image-saver-clear-filters" title="Clear all filters">Clear</button></p>` : ""}
    ${normalizedEntries.length > 1 ? `<p class="meta jumps">${normalizedEntries.map((entry, index) => `<a href="#e${index + 1}" title="Jump #${index + 1} p${escapeHTML(String(entry.pageNumber))}">#${index + 1}p${escapeHTML(String(entry.pageNumber))}</a>`).join(" ")}</p>` : ""}
  </header>
  ${entriesHTML}
  ${normalizedEntries.length > 1 ? `<p class="meta actions footer-actions"><a class="source-action" href="#top" title="Top">Top</a></p>` : ""}
  <details>
    <summary>Meta</summary>
    <pre>${escapeHTML(JSON.stringify(metadata, null, 2))}</pre>
  </details>
  <script>
    (function () {
      var activeCategory = "all";
      var activeLayout = "all";
      var activeSlot = "all";
      var activeRole = "all";
      var activeInsert = "all";
      var activeCaption = "all";
      var activeHue = "all";
      var activeBeat = "all";
      var activeTag = "all";
      function applyFilters() {
        document.querySelectorAll('.filter-chip[data-filter="category"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeCategory ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="hue"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeHue ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="layout"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeLayout ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="slot"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeSlot ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="role"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeRole ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="insert"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeInsert ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="caption"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeCaption ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="beat"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeBeat ? "true" : "false");
        });
        document.querySelectorAll('.filter-chip[data-filter="tag"]').forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-value") === activeTag ? "true" : "false");
        });
        document.querySelectorAll("article.entry").forEach(function (entry) {
          var categoryMatch = activeCategory === "all" || entry.getAttribute("data-category") === activeCategory;
          var hueMatch = activeHue === "all" || entry.getAttribute("data-hue") === activeHue;
          var layoutMatch = activeLayout === "all" || entry.getAttribute("data-layout") === activeLayout;
          var slotMatch = activeSlot === "all" || entry.getAttribute("data-slot") === activeSlot;
          var roleMatch = activeRole === "all" || entry.getAttribute("data-role") === activeRole;
          var insertMatch = activeInsert === "all" || entry.getAttribute("data-insert") === activeInsert;
          var captionMatch = activeCaption === "all" || entry.getAttribute("data-caption") === activeCaption;
          var beatMatch = activeBeat === "all" || entry.getAttribute("data-beat") === activeBeat;
          var tagMatch = activeTag === "all" || (entry.getAttribute("data-style-tags") || "").split(",").includes(activeTag);
          entry.classList.toggle("is-hidden", !(categoryMatch && hueMatch && layoutMatch && slotMatch && roleMatch && insertMatch && captionMatch && beatMatch && tagMatch));
        });
      }
      function copyText(text) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function () {});
          return;
        }
        var area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); } catch (_error) {}
        area.remove();
      }
      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!target) return;
        if (target.classList && target.classList.contains("filter-chip")) {
          var filter = target.getAttribute("data-filter") || "category";
          var value = target.getAttribute("data-value") || "all";
          if (filter === "layout") {
            activeLayout = value;
          } else if (filter === "slot") {
            activeSlot = value;
          } else if (filter === "role") {
            activeRole = value;
          } else if (filter === "insert") {
            activeInsert = value;
          } else if (filter === "caption") {
            activeCaption = value;
          } else if (filter === "hue") {
            activeHue = value;
          } else if (filter === "beat") {
            activeBeat = value;
          } else if (filter === "tag") {
            activeTag = value;
          } else {
            activeCategory = value;
          }
          applyFilters();
          return;
        }
        if (target.id === "pdf-image-saver-clear-filters") {
          activeCategory = "all";
          activeHue = "all";
          activeLayout = "all";
          activeSlot = "all";
          activeRole = "all";
          activeInsert = "all";
          activeCaption = "all";
          activeBeat = "all";
          activeTag = "all";
          applyFilters();
          return;
        }
        if (target.classList && target.classList.contains("palette-chip")) {
          copyText(target.getAttribute("data-copy") || target.getAttribute("title") || "");
          return;
        }
        if (target.classList && target.classList.contains("copy-token")) {
          copyText(target.getAttribute("data-copy") || "");
        }
      });
    })();
  </script>
</body>
</html>`;
  }

  function normalizePreviewEntries(entries) {
    if (!Array.isArray(entries)) {
      throw new Error("Preview index bad.");
    }
    if (!entries.length) {
      throw new Error("Preview index empty.");
    }
    return entries.map((entry) => (
      entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}
    ));
  }

  async function importIndexAttachment({ attachment, parentItem, indexPath, scope, pageIndex, entries, qualityKey, indexKey }) {
    const parentID = attachment.parentID || undefined;
    try {
      return await Zotero.Attachments.importFromFile({
        file: indexPath,
        parentItemID: parentID,
        libraryID: parentID ? undefined : attachment.libraryID,
        title: buildIndexTitle(parentItem, attachment, scope, pageIndex, entries, qualityKey, indexKey),
        contentType: "text/html",
        charset: "utf-8",
      });
    } catch (error) {
      throw new Error(`Storage failed: index import failed. ${getErrorMessage(error)}`);
    } finally {
      await removeDirectoryIfExists(PathUtils.parent(indexPath));
    }
  }

  function buildIndexTitle(parentItem, attachment, scope, pageIndex, entries = [], qualityKey = null, indexKey = null) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment)).slice(0, 70);
    const scopeLabel = formatPreviewScopeLabel(scope);
    const targetPage = normalizePageIndex(pageIndex, null);
    const target = targetPage === null ? null : `p${targetPage + 1}`;
    const entryCount = Array.isArray(entries) ? entries.length : 0;
    const normalizedQuality = qualityKey === null ? null : normalizeQualityKey(qualityKey);
    const qualityLabel = normalizedQuality
      ? `${getQualityMark(normalizedQuality)} ${QUALITY[normalizedQuality].label}`
      : null;
    const categorySummary = formatCategorySummary(entries);
    const categoryLabel = categorySummary === "Cat none" ? null : categorySummary.replace(/^Cat\s+/, "");
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    const fingerprint = normalizedIndexKey ? getPreviewIndexFingerprint(normalizedIndexKey) : null;
    const suffix = [
      "img index",
      scopeLabel,
      target,
      qualityLabel,
      categoryLabel,
      entryCount ? `${entryCount}img` : null,
      fingerprint,
    ].filter(Boolean).join(" ");
    return `${base} - ${suffix}`.slice(0, 140);
  }

  async function confirmAndSaveOriginalImagesFromReader(reader, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    try {
      const win = Zotero.getMainWindow?.();
      const scope = normalizeOriginalScope(safeOptions.scope);
      const scopeLabel = scope === "document" ? "doc" : "page";
      const maxImages = scope === "document"
        ? getHelperMaxImages("document")
        : getHelperMaxImages("page");
      const ok = Services.prompt.confirm(
        win,
        "PDF Img",
        `Orig ${scopeLabel}? Max ${maxImages}; caps ${formatBytes(ORIGINAL_MAX_IMAGE_BYTES)}/img, ${formatBytes(ORIGINAL_MAX_TOTAL_BYTES)}/run. Use clip.`,
      );
      if (!ok) {
        const pageIndex = normalizePageIndex(safeOptions.pageIndex, null);
        showReaderToast(reader, `Orig cancel ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
        return null;
      }
      return await saveOriginalImagesFromReader(reader, { ...safeOptions, scope });
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      return null;
    }
  }

  async function saveOriginalImagesFromReader(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const safeOptions = normalizeOptionsObject(options);
      const scope = normalizeOriginalScope(safeOptions.scope);
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const pageIndex =
        scope === "page"
          ? await getCurrentPageIndex(reader, safeOptions.pageIndex)
          : null;
      jobKey = getReaderJobKey(reader, { scope, pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, `Orig busy ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
        return;
      }

      activeJobs.add(jobKey);
      jobAdded = true;
      const pdfPath = await getAttachmentPath(attachment);
      const pythonCommands = await getPythonCommands();
      if (!pythonCommands.length) {
        showReaderToast(reader, formatHelperFailure({ status: "no_python" }), "warning");
        return;
      }
      showReaderToast(reader, `Helper ${formatOriginalScopeToken(scope, pageIndex)}...`, "progress");
      const report = await runHelperExtraction({
        attachment,
        pdfPath,
        pageIndex,
        scope,
      });
      if (report.status !== "ok") {
        const helperStatus = normalizeHelperStatusText(report?.status);
        const helperMessage = formatHelperFailure(report);
        // Absence stays compact; only hard helper failures remind that clip still works.
        showReaderToast(
          reader,
          helperStatus === "missing_pymupdf" || helperStatus === "no_python"
            ? helperMessage
            : `${helperMessage} Use clip.`,
          "warning",
        );
        return;
      }
      if (!report.images?.length) {
        await removeDirectoryIfExists(report.output_dir);
        showReaderToast(reader, `No orig ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
        return;
      }
      const importResult = await importOriginalImages({
        report,
        attachment,
        parentItem,
        scope,
      });
      const skippedText = importResult.omittedCount || importResult.indexErrorCount
        ? buildOriginalImportSkippedText(importResult)
        : "";
      if (!importResult.count) {
        showReaderToast(reader, `No new ${formatOriginalScopeToken(scope, pageIndex)}.${skippedText}`, "warning");
        return;
      }
      showReaderToast(
        reader,
        `OK ${importResult.count} orig${importResult.count === 1 ? "" : "s"} ${formatOriginalScopeToken(scope, pageIndex)}.${skippedText}`,
        importResult.omittedCount || importResult.indexErrorCount ? "warning" : "success",
      );
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
    } finally {
      if (jobAdded) {
        activeJobs.delete(jobKey);
      }
    }
  }

  async function importOriginalImages({ report, attachment, parentItem, scope }) {
    const parentID = attachment.parentID || undefined;
    let count = 0;
    let importErrorCount = 0;
    let indexErrorCount = 0;
    const normalized = normalizeOriginalImagesForImport(report);
    const existingOriginalKeys = await getExistingOriginalImageKeys(parentItem, attachment);
    const deduped = filterDuplicateOriginalImagesForImport(normalized, attachment, existingOriginalKeys);
    const limited = limitNormalizedOriginalImagesForImport(deduped, scope);
    const prepared = await filterExistingOriginalImagesForImport(limited);
    const importableImages = prepared.images;
    const duplicateCount = deduped.duplicateCount;
    const importedImages = [];
    try {
      for (const image of importableImages) {
        try {
          await Zotero.Attachments.importFromFile({
            file: image.filePath,
            parentItemID: parentID,
            libraryID: parentID ? undefined : attachment.libraryID,
            title: buildOriginalImageTitle(parentItem, attachment, image),
            contentType: image.contentType,
          });
          importedImages.push(image);
          count += 1;
        } catch (error) {
          importErrorCount += 1;
          logError(error);
        }
      }
      if (importableImages.length && !count && importErrorCount === importableImages.length) {
        throw new Error(`Storage failed: all ${importErrorCount} orig imports failed.`);
      }
      if (importedImages.length) {
        try {
          await createOriginalImageIndexAttachment({
            attachment,
            parentItem,
            images: importedImages,
            scope,
          });
        } catch (error) {
          indexErrorCount += 1;
          logError(error);
        }
      }
      return {
        count,
        omittedCount: prepared.omittedCount + duplicateCount + importErrorCount,
        invalidCount: prepared.invalidCount,
        overCapCount: prepared.overCapCount,
        missingCount: prepared.missingCount,
        errorCount: prepared.errorCount,
        byteCapCount: prepared.byteCapCount,
        duplicateCount,
        importErrorCount: importErrorCount,
        indexErrorCount: indexErrorCount,
        maxImages: prepared.maxImages,
        totalBytes: prepared.totalBytes,
      };
    } finally {
      await removeDirectoryIfExists(report.output_dir);
    }
  }

  async function filterExistingOriginalImagesForImport(limited) {
    const images = [];
    let missingCount = 0;
    let errorCount = 0;
    let byteCapCount = 0;
    let totalBytes = 0;
    for (const image of limited.images || []) {
      const status = await getHelperImageFileStatus(image.filePath);
      if (status.exists) {
        const byteCount = normalizeNonNegativeInteger(status.bytes ?? image.byteCount, 0);
        if (byteCount > ORIGINAL_MAX_IMAGE_BYTES || totalBytes + byteCount > ORIGINAL_MAX_TOTAL_BYTES) {
          byteCapCount += 1;
          continue;
        }
        image.byteCount = byteCount;
        image.byte_count = byteCount;
        images.push(image);
        totalBytes += byteCount;
      } else if (status.error) {
        errorCount += 1;
      } else {
        missingCount += 1;
      }
    }
    return {
      ...limited,
      images,
      missingCount,
      errorCount,
      byteCapCount,
      totalBytes,
      omittedCount: (limited.omittedCount || 0) + missingCount + errorCount + byteCapCount,
    };
  }

  async function getHelperImageFileStatus(filePath) {
    if (typeof filePath !== "string") {
      return { exists: false, error: false, bytes: null };
    }
    try {
      const exists = !!(await IOUtils.exists(filePath));
      if (!exists) {
        return { exists: false, error: false, bytes: null };
      }
      if (typeof IOUtils.stat === "function") {
        const stat = await IOUtils.stat(filePath);
        return { exists: true, error: false, bytes: normalizeNonNegativeInteger(stat?.size, 0) };
      }
      return { exists: true, error: false, bytes: null };
    } catch (error) {
      logError(error);
      return { exists: false, error: true, bytes: null };
    }
  }

  function limitOriginalImagesForImport(report, scope) {
    return limitNormalizedOriginalImagesForImport(normalizeOriginalImagesForImport(report), scope);
  }

  function normalizeOriginalImagesForImport(report) {
    const images = Array.isArray(report?.images) ? report.images : [];
    const normalizedImages = [];
    let invalidCount = 0;
    images.forEach((image, index) => {
      const normalized = normalizeOriginalImageForImport(image, index, report?.output_dir);
      if (normalized) {
        normalizedImages.push(normalized);
      } else {
        invalidCount += 1;
      }
    });
    return {
      images: normalizedImages,
      omittedCount: invalidCount,
      invalidCount,
      overCapCount: 0,
      maxImages: 0,
      originalCount: images.length,
    };
  }

  function filterDuplicateOriginalImagesForImport(normalized, attachment, existingOriginalKeys) {
    const images = [];
    let duplicateCount = 0;
    const keySet = existingOriginalKeys instanceof Set ? existingOriginalKeys : new Set();
    for (const image of normalized.images || []) {
      image.originalImageKey = getOriginalImageKey(attachment, image);
      if (keySet.has(image.originalImageKey)) {
        duplicateCount += 1;
        continue;
      }
      images.push(image);
    }
    return {
      ...normalized,
      images,
      duplicateCount,
    };
  }

  function limitNormalizedOriginalImagesForImport(normalized, scope) {
    const maxImages = getHelperMaxImages(scope);
    const images = Array.isArray(normalized?.images) ? normalized.images : [];
    const overCapCount = Math.max(0, images.length - maxImages);
    return {
      ...normalized,
      images: images.slice(0, maxImages),
      omittedCount: (normalized?.omittedCount || 0) + overCapCount,
      invalidCount: normalized?.invalidCount || 0,
      overCapCount,
      maxImages,
      originalCount: normalized?.originalCount || images.length,
    };
  }

  function normalizeOriginalImageForImport(image, index, outputDir) {
    const filePath = normalizeHelperFilePath(image?.file_path, outputDir);
    if (!filePath) {
      return null;
    }
    const extension = normalizeFileExtension(image?.extension) || getFileExtension(filePath);
    const pageIndex = normalizePageIndex(image?.page_index, null);
    const pageNumberFallback = pageIndex === null ? 1 : pageIndex + 1;
    const pageNumber = normalizePageNumber(image?.page_number, pageNumberFallback);
    const contentType = normalizeImageContentType(image?.content_type, extension);
    const byteCount = normalizeNonNegativeInteger(image?.byte_count, 0);
    return {
      file_path: filePath,
      filePath,
      content_type: contentType,
      contentType,
      extension,
      page_number: pageNumber,
      pageNumber,
      page_index: pageIndex,
      pageIndex,
      occurrence: normalizePositiveInteger(image?.occurrence, index + 1),
      xref: normalizeNonNegativeInteger(image?.xref, null),
      sha256: normalizeMetadataText(image?.sha256, null, 80),
      byte_count: byteCount,
      byteCount,
      bbox_normalized: normalizeBBoxNormalized(image?.bbox_normalized),
    };
  }

  function buildOriginalImageTitle(parentItem, attachment, image) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment));
    const pageNumber = normalizePageNumber(image?.pageNumber ?? image?.page_number, 1);
    const occurrence = normalizePositiveInteger(image?.occurrence, 1);
    const key = getOriginalImageFingerprint(image?.originalImageKey || getOriginalImageKey(attachment, image));
    return `${base} - orig p${pageNumber} #${occurrence} ${key}`.slice(0, 140);
  }

  function buildOriginalImportSkippedText(importResult) {
    const parts = [];
    if (importResult.invalidCount) {
      parts.push(`${importResult.invalidCount} bad`);
    }
    if (importResult.missingCount) {
      parts.push(`${importResult.missingCount} missing`);
    }
    if (importResult.errorCount) {
      parts.push(`${importResult.errorCount} unread`);
    }
    if (importResult.byteCapCount) {
      parts.push(`${importResult.byteCapCount} byte cap`);
    }
    if (importResult.duplicateCount) {
      parts.push(`${importResult.duplicateCount} dup${importResult.duplicateCount === 1 ? "" : "s"}`);
    }
    if (importResult.importErrorCount) {
      parts.push(`${importResult.importErrorCount} import fail`);
    }
    if (importResult.indexErrorCount) {
      parts.push("index fail");
    }
    if (importResult.overCapCount) {
      parts.push(`${importResult.overCapCount} over cap ${importResult.maxImages}`);
    }
    return parts.length ? ` Skip ${parts.join("; ")}.` : "";
  }

  function getOriginalImageKey(attachment, image) {
    const libraryID = normalizeMetadataText(attachment?.libraryID, "library", 40);
    const itemKey = normalizeItemKey(attachment?.key, "UNKNOWN");
    const pageNumber = normalizePageNumber(image?.pageNumber ?? image?.page_number, 1);
    const sha = normalizeMetadataText(image?.sha256, null, 80);
    const xref = normalizeNonNegativeInteger(image?.xref, 0);
    const occurrence = normalizePositiveInteger(image?.occurrence, 1);
    const bbox = normalizeBBoxNormalized(image?.bbox_normalized)
      .map((value) => value.toFixed(4))
      .join(",");
    const weakIdentity = xref > 0 ? `xref${xref}` : `occurrence${occurrence}`;
    const identity = sha || `${weakIdentity}:bbox${bbox}`;
    return `original-image:v1:${libraryID}:${itemKey}:p${pageNumber}:${identity}`;
  }

  function getOriginalImageFingerprint(originalImageKey) {
    return getPreviewIndexFingerprint(originalImageKey) || "unknown";
  }

  async function createOriginalImageIndexAttachment({ attachment, parentItem, images, scope }) {
    const outputDir = await createTempDirectory();
    const htmlPath = PathUtils.join(outputDir, `pdf-original-image-index-${Zotero.Utilities.randomString(8)}.html`);
    try {
      const html = buildOriginalImageIndexHTML({ attachment, parentItem, images, scope });
      await Zotero.File.putContentsAsync(htmlPath, html);
      const parentID = attachment.parentID || undefined;
      return await Zotero.Attachments.importFromFile({
        file: htmlPath,
        parentItemID: parentID,
        libraryID: parentID ? undefined : attachment.libraryID,
        title: buildOriginalImageIndexTitle(parentItem, attachment, images, scope),
        contentType: "text/html",
        charset: "utf-8",
      });
    } finally {
      await removeDirectoryIfExists(outputDir);
    }
  }

  function buildOriginalImageIndexTitle(parentItem, attachment, images, scope) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment)).slice(0, 70);
    const count = Array.isArray(images) ? images.length : 0;
    return `${base} - orig ${formatPreviewScopeLabel(normalizeOriginalScope(scope))} ${count}img`.slice(0, 140);
  }

  function buildOriginalImageIndexHTML({ attachment, parentItem, images, scope }) {
    const createdAt = new Date().toISOString();
    const normalizedScope = normalizeOriginalScope(scope);
    const normalizedImages = (Array.isArray(images) ? images : []).map((image, index) => {
      const originalImageKey = normalizeMetadataText(image?.originalImageKey, null, 1000) || getOriginalImageKey(attachment, image);
      return {
        id: normalizeMetadataText(image?.id, `original-${index + 1}`, 120),
        original_image_key: originalImageKey,
        original_image_fingerprint: getOriginalImageFingerprint(originalImageKey),
        page_number: normalizePageNumber(image?.pageNumber ?? image?.page_number, 1),
        bbox_normalized: normalizeBBoxNormalized(image?.bbox_normalized),
        byte_count: normalizeNonNegativeInteger(image?.byteCount ?? image?.byte_count, 0),
        content_type: normalizeMetadataText(image?.contentType ?? image?.content_type, null, 80),
        sha256: normalizeMetadataText(image?.sha256, null, 80),
        open_pdf_uri: buildOpenPDFURI(attachment, image?.pageNumber ?? image?.page_number),
      };
    });
    const rows = normalizedImages.map((image, index) => `
      <tr id="o${index + 1}">
        <td>#${index + 1}</td>
        <td><a href="${escapeHTML(image.open_pdf_uri)}">p${escapeHTML(String(image.page_number))}</a></td>
        <td title="${escapeHTML(image.original_image_key)}">${escapeHTML(image.original_image_fingerprint)}</td>
        <td>${escapeHTML(formatBytes(image.byte_count))}</td>
        <td>${escapeHTML(image.bbox_normalized.map((value) => value.toFixed(4)).join(", "))}</td>
        <td><a class="source-action" href="${escapeHTML(image.open_pdf_uri)}" title="Open p${escapeHTML(String(image.page_number))}">Open p${escapeHTML(String(image.page_number))}</a></td>
      </tr>`).join("\n");
    const metadata = {
      schema_version: HELPER_SCHEMA_VERSION,
      created_at: createdAt,
      plugin: { id: config.id, version: config.version },
      storage_mode: "original_image_index",
      scope: normalizedScope,
      parent_item: serializeItem(parentItem),
      pdf_attachment: serializeAttachment(attachment),
      images: normalizedImages,
    };
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(getSourceTitle(parentItem, attachment))} - orig ${escapeHTML(formatPreviewScopeLabel(normalizedScope))}</title>
  <style>
    body { margin: 12px; font: 12.5px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { position: sticky; top: 0; z-index: 2; margin: 0 0 6px; padding: 8px 0 6px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid #e5e5e5; }
    h1 { font-size: 14px; margin: 0 0 3px; }
    .meta { color: #555; margin: 0 0 1px; line-height: 1.3; }
    .meta.actions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .meta.actions.footer-actions { margin-top: 10px; }
    .meta.jumps { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 6px; }
    .meta.jumps a { color: #0645ad; text-decoration: none; font-weight: 600; }
    .meta.jumps a:focus-visible { outline: 2px solid #1f73b7; outline-offset: 2px; }
    table { border-collapse: collapse; width: 100%; margin-top: 6px; }
    th, td { border-top: 1px solid #ddd; padding: 4px 5px; text-align: left; vertical-align: top; }
    th { color: #555; font-weight: 600; position: sticky; top: 52px; background: #fff; z-index: 1; }
    tbody tr:hover { background: #f7faff; }
    .source-action { display: inline-block; width: fit-content; padding: 2px 7px; border: 1px solid #9ab; border-radius: 3px; color: #0645ad; text-decoration: none; background: #f7faff; }
    .source-action:focus-visible, .source-map-link:focus-visible, .preview-link:focus-visible { outline: 2px solid #1f73b7; outline-offset: 2px; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 8px; background: #f6f8fa; border: 1px solid #ddd; font-size: 11.5px; }
  </style>
</head>
<body>
  <header id="top">
    <h1>${escapeHTML(getSourceTitle(parentItem, attachment))}</h1>
    <p class="meta">Saved ${escapeHTML(createdAt)}. Orig ${escapeHTML(formatPreviewScopeLabel(normalizedScope))}; helper.</p>
    <p class="meta">${normalizedImages.length} img; ${escapeHTML(formatBytes(normalizedImages.reduce((sum, image) => sum + normalizeNonNegativeInteger(image.byte_count, 0), 0)))}; open PDF page links.</p>
    ${normalizedImages.length ? `<p class="meta actions"><a class="source-action" href="${escapeHTML(normalizedImages[0].open_pdf_uri)}" title="Open first p${escapeHTML(String(normalizedImages[0].page_number))}">Open first p${escapeHTML(String(normalizedImages[0].page_number))}</a>${normalizedImages.length > 1 ? ` <a class="source-action" href="${escapeHTML(normalizedImages[normalizedImages.length - 1].open_pdf_uri)}" title="Open last p${escapeHTML(String(normalizedImages[normalizedImages.length - 1].page_number))}">Open last p${escapeHTML(String(normalizedImages[normalizedImages.length - 1].page_number))}</a>` : ""}</p>` : ""}
    ${normalizedImages.length > 1 ? `<p class="meta jumps">${normalizedImages.map((image, index) => `<a href="#o${index + 1}" title="Jump #${index + 1} p${escapeHTML(String(image.page_number))}">#${index + 1}p${escapeHTML(String(image.page_number))}</a>`).join(" ")}</p>` : ""}
  </header>
  <table>
    <thead><tr><th>#</th><th>Page</th><th>ID</th><th>Size</th><th>Box</th><th>Open</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${normalizedImages.length > 1 ? `<p class="meta actions footer-actions"><a class="source-action" href="#top" title="Top">Top</a></p>` : ""}
  <details>
    <summary>Meta</summary>
    <pre>${escapeHTML(JSON.stringify(metadata, null, 2))}</pre>
  </details>
</body>
</html>`;
  }

  async function getExistingOriginalImageKeys(parentItem, attachment = null) {
    const keys = new Set();
    if (!parentItem || typeof parentItem.getAttachments !== "function") {
      await collectStandaloneOriginalImageKeys(keys, attachment);
      return keys;
    }
    let childIDs = [];
    try {
      childIDs = parentItem.getAttachments() || [];
    } catch (error) {
      try {
        logError(error);
      } catch (_logError) {
        // Duplicate scanning must not block original import.
      }
      return keys;
    }
    for (const childID of Array.isArray(childIDs) ? childIDs : []) {
      let child = null;
      try {
        child = Zotero.Items.get(childID);
      } catch (error) {
        logError(error);
      }
      if (!child || !isHTMLAttachment(child)) {
        continue;
      }
      const metadata = await readOriginalImageIndexMetadataFromAttachment(child);
      const images = Array.isArray(metadata?.images) ? metadata.images : [];
      for (const image of images) {
        const key = normalizeMetadataText(image?.original_image_key, null, 1000);
        if (key) {
          keys.add(key);
        }
      }
    }
    return keys;
  }

  async function collectStandaloneOriginalImageKeys(keys, attachment) {
    if (attachment?.parentID || typeof Zotero.Items?.getAll !== "function") {
      return;
    }
    let items = [];
    try {
      items = Zotero.Items.getAll(attachment?.libraryID) || [];
    } catch (error) {
      logError(error);
      return;
    }
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || (item.id && attachment?.id && item.id === attachment.id) || !isHTMLAttachment(item)) {
        continue;
      }
      const metadata = await readOriginalImageIndexMetadataFromAttachment(item);
      const images = Array.isArray(metadata?.images) ? metadata.images : [];
      for (const image of images) {
        const key = normalizeMetadataText(image?.original_image_key, null, 1000);
        if (key) {
          keys.add(key);
        }
      }
    }
  }

  async function readOriginalImageIndexMetadataFromAttachment(item) {
    if (typeof item?.getFilePathAsync !== "function" || typeof Zotero.File?.getContentsAsync !== "function") {
      return null;
    }
    try {
      const filePath = await item.getFilePathAsync();
      if (!filePath) {
        return null;
      }
      const contents = await Zotero.File.getContentsAsync(filePath);
      const preMatch = String(contents || "").match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (!preMatch) {
        return null;
      }
      const metadata = JSON.parse(unescapeHTMLEntities(preMatch[1]).trim());
      if (
        metadata
        && typeof metadata === "object"
        && !Array.isArray(metadata)
        && metadata.schema_version === HELPER_SCHEMA_VERSION
        && metadata.storage_mode === "original_image_index"
        && metadata.plugin?.id === config.id
      ) {
        return metadata;
      }
    } catch (_error) {
      // Not every HTML child attachment is an original-image index.
    }
    return null;
  }

  async function runHelperExtraction({ attachment, pdfPath, pageIndex, scope }) {
    const pythonCommands = await getPythonCommands();
    if (!pythonCommands.length) {
      return {
        schema_version: HELPER_SCHEMA_VERSION,
        status: "no_python",
        images: [],
        warnings: ["Python n/a."],
        output_dir: null,
      };
    }

    const helperScriptPath = await ensureHelperScriptPath();
    const outputDir = await createTempDirectory();
    const reportPath = PathUtils.join(outputDir, "report.json");
    const argsBase = [
      helperScriptPath,
      pdfPath,
      "--out-dir",
      outputDir,
      "--report",
      reportPath,
      "--attachment-key",
      attachment.key || "",
      "--document-id",
      String(attachment.id),
      "--min-area",
      String(getNumberPref("minImageArea", DEFAULT_MIN_AREA)),
      "--max-images",
      String(getHelperMaxImages(scope)),
    ];
    if (pageIndex !== null && pageIndex !== undefined) {
      argsBase.push("--page-index", String(pageIndex));
    }

    const failures = [];
    let missingPyMuPDFReport = null;
    for (const pythonCommand of pythonCommands) {
      try {
        await removeFileIfExists(reportPath);
        const exitCode = await runProcess(pythonCommand, argsBase);
        if (!(await IOUtils.exists(reportPath))) {
          throw new Error(`Helper failed: exit ${exitCode}, no report.`);
        }
        const report = await readJSONReport(reportPath);
        report.output_dir = outputDir;
        report.helper = {
          command: formatCommand(pythonCommand),
          exit_code: exitCode,
          report_path: reportPath,
        };
        if (report.status === "ok") {
          pythonCommandPromise = Promise.resolve(pythonCommand);
          return report;
        }
        if (report.status === "missing_pymupdf") {
          missingPyMuPDFReport = report;
        }
        failures.push(`${formatCommand(pythonCommand)}: ${normalizeHelperStatusText(report.status)}`);
      } catch (error) {
        failures.push(`${formatCommand(pythonCommand)}: ${getErrorMessage(error)}`);
      }
    }

    await removeDirectoryIfExists(outputDir);
    if (missingPyMuPDFReport) {
      missingPyMuPDFReport.output_dir = null;
      missingPyMuPDFReport.warnings = [
        ...normalizeHelperWarningMessages(missingPyMuPDFReport.warnings),
        ...failures,
      ];
      return missingPyMuPDFReport;
    }
    return {
      schema_version: HELPER_SCHEMA_VERSION,
      status: "failed",
      images: [],
      warnings: failures,
      output_dir: null,
    };
  }

  async function ensureHelperScriptPath() {
    helperScriptPathPromise ??= (async () => {
      const helperDir = PathUtils.join(PathUtils.profileDir, ADDON_REF, "helper");
      await Zotero.File.createDirectoryIfMissingAsync(helperDir);
      const helperPath = PathUtils.join(helperDir, "pdf_image_extract.py");
      const helperScript = await Zotero.File.getContentsFromURLAsync(
        config.rootURI + "content/helper/pdf_image_extract.py",
      );
      if (typeof helperScript !== "string" || !helperScript.includes(HELPER_SCHEMA_VERSION)) {
        throw new Error("Helper failed: script missing.");
      }
      await Zotero.File.putContentsAsync(helperPath, helperScript);
      return helperPath;
    })();
    return helperScriptPathPromise;
  }

  async function getPythonCommands() {
    const preferred = pythonCommandPromise ? await pythonCommandPromise : null;
    const discovered = await findPythonCommands();
    return dedupeCommands(preferred ? [preferred, ...discovered] : discovered);
  }

  async function findPythonCommands() {
    const commands = [];
    const prefPythonPath = getStringPref("pythonPath", "");
    if (prefPythonPath) {
      const prefPython = await resolvePythonCommand(prefPythonPath);
      if (prefPython) {
        commands.push(prefPython);
      }
    }
    const condaCommands = await findCondaZlkCommands();
    commands.push(...condaCommands);

    const envCandidates = [
      Services.env.get("ZOTERO_PDF_IMAGE_SAVER_PYTHON"),
      Services.env.get("PYTHON"),
      Services.env.get("PYTHON3"),
    ]
      .map((value) => (value || "").trim())
      .filter(Boolean);

    for (const candidate of envCandidates) {
      const resolved = await resolvePythonCommand(candidate);
      if (resolved) {
        commands.push(resolved);
      }
    }

    const isWin = Services.appinfo.OS === "WINNT";
    const names = isWin
      ? [
          { executable: "python.exe", args: [] },
          { executable: "python3.exe", args: [] },
          { executable: "py.exe", args: ["-3"] },
        ]
      : [
          { executable: "python3", args: [] },
          { executable: "python", args: [] },
        ];

    for (const searchPath of getExecutableSearchPaths()) {
      for (const candidate of names) {
        const absolutePath = PathUtils.join(searchPath, candidate.executable);
        if (await IOUtils.exists(absolutePath)) {
          commands.push({ command: absolutePath, args: [...candidate.args] });
        }
      }
    }
    return dedupeCommands(commands);
  }

  async function findCondaZlkCommands() {
    const commands = [];
    const envPython = Services.appinfo.OS === "WINNT"
      ? PathUtils.join(Services.env.get("USERPROFILE") || "", ".conda", "envs", "zlk", "python.exe")
      : PathUtils.join(Services.env.get("HOME") || "", ".conda", "envs", "zlk", "bin", "python");
    if (await IOUtils.exists(envPython)) {
      commands.push({ command: envPython, args: [] });
    }

    for (const condaName of Services.appinfo.OS === "WINNT" ? ["conda.exe", "conda.bat"] : ["conda"]) {
      const conda = await resolvePythonCommand(condaName);
      if (conda) {
        commands.push({ command: conda.command, args: ["run", "-n", "zlk", "python"] });
      }
    }
    return commands;
  }

  async function resolvePythonCommand(candidate) {
    if (!candidate) {
      return null;
    }
    if (await IOUtils.exists(candidate)) {
      return { command: candidate, args: [] };
    }
    for (const searchPath of getExecutableSearchPaths()) {
      const absolutePath = PathUtils.join(searchPath, candidate);
      if (await IOUtils.exists(absolutePath)) {
        return { command: absolutePath, args: [] };
      }
      if (Services.appinfo.OS === "WINNT" && !/\.(?:exe|cmd|bat)$/i.test(candidate)) {
        const exePath = PathUtils.join(searchPath, `${candidate}.exe`);
        if (await IOUtils.exists(exePath)) {
          return { command: exePath, args: [] };
        }
      }
    }
    return null;
  }

  function getExecutableSearchPaths() {
    const separator = Services.appinfo.OS === "WINNT" ? ";" : ":";
    return (Services.env.get("PATH") || "")
      .split(separator)
      .map((path) => path.trim().replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);
  }

  function dedupeCommands(commands) {
    const seen = new Set();
    const deduped = [];
    for (const command of commands) {
      const key = `${command.command}\u0000${command.args.join("\u0000")}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(command);
      }
    }
    return deduped;
  }

  async function runProcess(command, args) {
    const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    process.init(Zotero.File.pathToFile(command.command));
    process.startHidden = true;
    process.noShell = true;
    const fullArgs = [...command.args, ...args];

    await new Promise((resolve, reject) => {
      let settled = false;
      const timeoutMS = getHelperTimeoutSeconds() * 1000;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        try {
          process.kill();
        } catch (error) {
          logError(error);
        }
        reject(new Error(`Optional helper timed out after ${Math.round(timeoutMS / 1000)} seconds.`));
      }, timeoutMS);
      const observer = {
        observe(subject, topic) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          if (topic === "process-finished") {
            resolve(subject);
            return;
          }
          reject(new Error(`Process ended with topic: ${topic}`));
        },
      };
      if (Services.appinfo.OS === "WINNT") {
        process.runwAsync(fullArgs, fullArgs.length, observer, false);
      } else {
        process.runAsync(fullArgs, fullArgs.length, observer, false);
      }
    });

    if (process.exitValue !== 0) {
      log(`Helper exited with ${process.exitValue}: ${formatCommand(command)}`);
    }
    return process.exitValue;
  }

  async function readJSONReport(path) {
    if (!(await IOUtils.exists(path))) {
      throw new Error("Helper failed: no report.");
    }
    const raw = await Zotero.File.getContentsAsync(path);
    const report = JSON.parse(raw);
    if (report.schema_version !== HELPER_SCHEMA_VERSION) {
      throw new Error(`Helper failed: bad schema ${normalizeHelperSchemaText(report.schema_version)}`);
    }
    return report;
  }

  async function createTempDirectory() {
    const baseDir = PathUtils.join(PathUtils.tempDir, ADDON_REF);
    await Zotero.File.createDirectoryIfMissingAsync(baseDir);
    const outputDir = PathUtils.join(
      baseDir,
      `${Date.now()}-${Zotero.Utilities.randomString(8)}`,
    );
    await Zotero.File.createDirectoryIfMissingAsync(outputDir);
    return outputDir;
  }

  async function removeDirectoryIfExists(path) {
    if (!path) {
      return;
    }
    if (!isPluginTempChildDirectory(path)) {
      log("Skipped recursive cleanup outside plugin temp root", { path });
      return;
    }
    try {
      await IOUtils.remove(path, { recursive: true, ignoreAbsent: true });
    } catch (error) {
      logError(error);
    }
  }

  function isPluginTempChildDirectory(path) {
    if (typeof PathUtils === "undefined") {
      return false;
    }
    const normalizedPath = normalizePathForComparison(path);
    const normalizedTempRoot = normalizePathForComparison(PathUtils.join(PathUtils.tempDir, ADDON_REF));
    if (!normalizedPath || !normalizedTempRoot) {
      return false;
    }
    const tempRootPrefix = normalizedTempRoot.endsWith("/") ? normalizedTempRoot : `${normalizedTempRoot}/`;
    return normalizedPath.startsWith(tempRootPrefix) && normalizedPath.length > tempRootPrefix.length;
  }

  async function removeFileIfExists(path) {
    if (!path) {
      return;
    }
    try {
      await IOUtils.remove(path, { ignoreAbsent: true });
    } catch (error) {
      logError(error);
    }
  }

  async function cleanupStaleTempDirectories() {
    const baseDir = PathUtils.join(PathUtils.tempDir, ADDON_REF);
    if (!(await IOUtils.exists(baseDir))) {
      return;
    }
    try {
      const entries = await IOUtils.getChildren(baseDir);
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      for (const entry of entries) {
        try {
          const info = await IOUtils.stat(entry);
          if (info.lastModified && info.lastModified < cutoff) {
            await removeDirectoryIfExists(entry);
          }
        } catch (error) {
          logError(error);
        }
      }
    } catch (error) {
      logError(error);
    }
  }

  async function getTempDirectoryStats(path) {
    if (!(await IOUtils.exists(path))) {
      return { count: 0, bytes: 0 };
    }
    let count = 0;
    let bytes = 0;
    const entries = await IOUtils.getChildren(path);
    for (const entry of entries) {
      count += 1;
      bytes += await getPathSize(entry);
    }
    return { count, bytes };
  }

  async function getPathSize(path) {
    try {
      const info = await IOUtils.stat(path);
      if (info.type !== "directory") {
        return info.size || 0;
      }
      const children = await IOUtils.getChildren(path);
      let total = 0;
      for (const child of children) {
        total += await getPathSize(child);
      }
      return total;
    } catch (error) {
      logError(error);
      return 0;
    }
  }

  function getReaderPDFAttachment(reader) {
    const item = reader?._item || (reader?.itemID ? Zotero.Items.get(reader.itemID) : null);
    if (item?.isPDFAttachment?.()) {
      return item;
    }
    if (item?.isAttachment?.() && item.attachmentContentType === "application/pdf") {
      return item;
    }
    throw new Error("Capture failed: not a PDF.");
  }

  async function getAttachmentPath(attachment) {
    const filePath = await attachment.getFilePathAsync();
    if (!filePath || !(await IOUtils.exists(filePath))) {
      throw new Error("Helper failed: PDF path n/a.");
    }
    return filePath;
  }

  async function getCurrentPageIndex(reader, explicitPageIndex) {
    const normalizedExplicit = normalizePageIndex(explicitPageIndex, null);
    if (normalizedExplicit !== null) {
      return normalizedExplicit;
    }
    const context = await getPDFViewerContext(reader);
    const pageNumber =
      context?.app?.pdfViewer?.currentPageNumber ||
      context?.app?.page ||
      context?.app?.pdfViewer?._currentPageNumber ||
      1;
    return normalizePageNumber(pageNumber, 1) - 1;
  }

  async function getPDFViewerContext(reader) {
    try {
      await reader?._initPromise;
      if (typeof reader?._waitForReader === "function") {
        await reader._waitForReader();
      }
    } catch (error) {
      logError(error);
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      const context = getPDFViewerContextCandidate(reader);
      if (context?.app) {
        return context;
      }
      await Zotero.Promise.delay(100);
    }
    return getPDFViewerContextCandidate(reader);
  }

  function getPDFViewerContextCandidate(reader) {
    const directContext = getPDFViewerContextFromWindow(
      reader?._iframeWindow || reader?._iframe?.contentWindow,
    );
    if (directContext) {
      return directContext;
    }
    const views = [
      reader?._lastView,
      reader?._primaryView,
      reader?._internalReader?._lastView,
      reader?._internalReader?._primaryView,
    ];
    for (const view of views) {
      const context = getPDFViewerContextFromWindow(
        view?._iframeWindow || view?._iframe?.contentWindow,
      );
      if (context) {
        return context;
      }
    }
    return null;
  }

  function getPDFViewerContextFromWindow(iframeWindow) {
    const app =
      iframeWindow?.PDFViewerApplication ||
      iframeWindow?.wrappedJSObject?.PDFViewerApplication;
    if (!app) {
      return null;
    }
    return { app, doc: iframeWindow.document };
  }

  async function waitForPageElement(context, pageNumber) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const pageElement = getPageElement(context, pageNumber);
      if (pageElement && getPageCanvas(pageElement)) {
        return pageElement;
      }
      await Zotero.Promise.delay(100);
    }
    return getPageElement(context, pageNumber);
  }

  function getPageElement(context, pageNumber) {
    const pageElement = context?.doc?.querySelector?.(`.page[data-page-number="${pageNumber}"]`);
    if (pageElement) {
      return pageElement;
    }
    const pageView = getPageView(context, pageNumber - 1);
    return pageView?.div || null;
  }

  function getPageView(context, pageIndex) {
    return (
      context?.app?.pdfViewer?.getPageView?.(pageIndex) ||
      context?.app?.pdfViewer?._pages?.[pageIndex] ||
      null
    );
  }

  function getPageLabel(context, pageIndex) {
    const pageView = getPageView(context, pageIndex);
    const label =
      pageView?.pageLabel ||
      pageView?.pdfPage?.pageLabel ||
      context?.app?.pdfViewer?._pageLabels?.[pageIndex] ||
      context?.app?.pdfLinkService?._pageLabels?.[pageIndex] ||
      "";
    return label ? String(label) : null;
  }

  function getPageCanvas(pageElement) {
    return pageElement?.querySelector?.("canvas") || null;
  }

  function getActiveReader(win) {
    const readers = Zotero.Reader?._readers || [];
    const selectedTabID = getSelectedTabID(win);
    const selectedReader = selectedTabID && Zotero.Reader?.getByTabID?.(selectedTabID);
    if (isPDFReader(selectedReader)) {
      return selectedReader;
    }
    if (!selectedTabID) {
      return null;
    }
    return readers.find((reader) => (
      (reader.tabID === selectedTabID || reader._tabID === selectedTabID) &&
      isPDFReader(reader)
    )) || null;
  }

  function getSelectedTabID(win) {
    return (
      win?.Zotero_Tabs?.selectedID ||
      win?.Zotero_Tabs?._selectedID ||
      win?.Zotero_Tabs?.selected?.id ||
      null
    );
  }

  function getContextPageIndex(params) {
    const pageIndex = normalizePageIndex(params?.pageIndex, null);
    if (pageIndex !== null) {
      return pageIndex;
    }
    const contextPageIndex = normalizePageIndex(params?.pageIndexFromContextMenu, null);
    if (contextPageIndex !== null) {
      return contextPageIndex;
    }
    return undefined;
  }

  function isPDFReader(reader) {
    return getReaderType(reader) === "pdf";
  }

  function getReaderType(reader) {
    const type =
      reader?.type ||
      reader?._type ||
      reader?._item?.attachmentReaderType ||
      "";
    return typeof type === "string" ? type.toLowerCase() : "";
  }

  function getReaderJobKey(reader, options = {}) {
    const itemID = reader?._item?.id || reader?.itemID || "unknown";
    const scope = normalizeScope(options?.scope);
    const pageIndex = normalizePageIndex(options?.pageIndex, null);
    const page = pageIndex === null ? "current" : pageIndex;
    return `${itemID}:${scope}:${page}`;
  }

  function showReaderToast(reader, message, level) {
    const fallbackWindow = Zotero.getMainWindow?.();
    const toastMessage = normalizeToastMessage(message);
    const toastLevel = normalizeToastLevel(level);
    if (!isPDFReader(reader)) {
      showFallbackAlert(fallbackWindow, toastMessage);
      return;
    }
    const immediateContext = getPDFViewerContextCandidate(reader);
    if (showToastInDocument(immediateContext?.doc, toastMessage, toastLevel)) {
      return;
    }
    if (showToastInDocument(fallbackWindow?.document, toastMessage, toastLevel)) {
      return;
    }
    getPDFViewerContext(reader).then((context) => {
      if (!showToastInDocument(context?.doc || fallbackWindow?.document, toastMessage, toastLevel)) {
        showFallbackAlert(fallbackWindow, toastMessage);
      }
    }).catch((error) => {
      logError(error);
      showFallbackAlert(fallbackWindow, toastMessage);
    });
  }

  function normalizeToastMessage(message) {
    if (message && typeof message.message === "string") {
      return normalizeMetadataText(message.message, "PDF Img note.", 280);
    }
    return normalizeMetadataText(message, "PDF Img note.", 280);
  }

  function normalizeToastLevel(level) {
    const text = normalizeMetadataText(level, "info", 24);
    return ["info", "success", "warning", "error", "progress"].includes(text) ? text : "info";
  }

  function getToastDuration(level) {
    if (level === "error") {
      return 8000;
    }
    if (level === "progress") {
      return 120000;
    }
    if (level === "success") {
      return 2800;
    }
    if (level === "warning") {
      return 4200;
    }
    return 3200;
  }

  function showToastInDocument(doc, message, level) {
    if (!doc?.body) {
      return false;
    }
    ensureReaderStyles(doc);
    const existing = doc.getElementById("pdf-image-saver-toast");
    if (existing?.__pdfImageSaverToastTimer && doc.defaultView?.clearTimeout) {
      doc.defaultView.clearTimeout(existing.__pdfImageSaverToastTimer);
    }
    const toast = existing || doc.createElement("div");
    toast.id = "pdf-image-saver-toast";
    toast.className = `pdf-image-saver-toast pdf-image-saver-${level || "info"}`;
    toast.setAttribute?.("role", level === "progress" ? "status" : "alert");
    toast.setAttribute?.("aria-live", level === "error" || level === "warning" ? "assertive" : "polite");
    toast.setAttribute?.("aria-busy", level === "progress" ? "true" : "false");
    toast.setAttribute?.("data-level", level || "info");
    toast.setAttribute?.("title", "Click/Esc dismiss");
    const dismissToast = () => {
      if (toast.__pdfImageSaverToastTimer && doc.defaultView?.clearTimeout) {
        doc.defaultView.clearTimeout(toast.__pdfImageSaverToastTimer);
      }
      toast.__pdfImageSaverToastTimer = null;
      if (toast.__pdfImageSaverEscHandler && doc.removeEventListener) {
        doc.removeEventListener("keydown", toast.__pdfImageSaverEscHandler, true);
      }
      toast.__pdfImageSaverEscHandler = null;
      toast.remove?.();
    };
    toast.onclick = dismissToast;
    let messageNode = toast.querySelector?.(".pdf-image-saver-toast-msg");
    if (!messageNode) {
      messageNode = doc.createElement("span");
      messageNode.className = "pdf-image-saver-toast-msg";
      toast.appendChild(messageNode);
    }
    messageNode.textContent = message;
    let dismissMark = toast.querySelector?.(".pdf-image-saver-toast-x");
    if (!dismissMark) {
      dismissMark = doc.createElement("span");
      dismissMark.className = "pdf-image-saver-toast-x";
      dismissMark.setAttribute?.("aria-hidden", "true");
      dismissMark.textContent = "x";
      toast.appendChild(dismissMark);
    }
    if (!toast.__pdfImageSaverEscHandler && doc.addEventListener) {
      toast.__pdfImageSaverEscHandler = (event) => {
        if (event?.key !== "Escape") {
          return;
        }
        if (doc.getElementById?.("pdf-image-saver-selection-overlay")) {
          return;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
        dismissToast();
      };
      doc.addEventListener("keydown", toast.__pdfImageSaverEscHandler, true);
    }
    if (!existing) {
      doc.body.appendChild(toast);
    }
    if (doc.defaultView?.setTimeout) {
      toast.__pdfImageSaverToastTimer = doc.defaultView.setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, getToastDuration(level));
    }
    return true;
  }

  function showFallbackAlert(fallbackWindow, message) {
    Services.prompt.alert(fallbackWindow, "PDF Img", message);
  }

  function ensureReaderStyles(doc) {
    if (doc.getElementById("pdf-image-saver-style")) {
      return;
    }
    const style = doc.createElement("style");
    style.id = "pdf-image-saver-style";
    style.textContent = `
      .pdf-image-saver-toolbar-button {
        margin: 0;
        padding: 2px 6px;
        border: 1px solid var(--fill-quinary, #b8b8b8);
        border-radius: 3px;
        background: var(--material-background, #fff);
        color: var(--fill-primary, #111);
        font: inherit;
        cursor: pointer;
        box-sizing: border-box;
        min-height: 26px;
        width: 60px;
        min-width: 60px;
        max-width: 60px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pdf-image-saver-toolbar-button:hover { background: var(--fill-quinary, #eee); }
      .pdf-image-saver-toolbar-button:disabled {
        opacity: 0.65;
        cursor: progress;
      }
      .pdf-image-saver-quality:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }
      .pdf-image-saver-toolbar-group[data-mode="clip"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="auto"] .pdf-image-saver-toolbar-button {
        border-color: var(--accent-color, #1f73b7);
      }
      .pdf-image-saver-toolbar-group {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin: 0 5px;
        padding: 0 1px;
        flex: 0 0 auto;
      }
      .pdf-image-saver-quality {
        box-sizing: border-box;
        width: 132px;
        min-width: 132px;
        max-width: 132px;
        min-height: 26px;
        font: inherit;
      }
      .pdf-image-saver-category {
        box-sizing: border-box;
        width: 88px;
        min-width: 88px;
        max-width: 88px;
        min-height: 26px;
        font: inherit;
      }
      .pdf-image-saver-category:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }
      .pdf-image-saver-toast {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 999999;
        max-width: min(320px, calc(100vw - 24px));
        padding: 6px 8px;
        border-radius: 3px;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        background: #222;
        color: #fff;
        font: 12px system-ui, sans-serif;
        line-height: 1.28;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .pdf-image-saver-toast-msg { flex: 1 1 auto; min-width: 0; }
      .pdf-image-saver-toast-x {
        flex: 0 0 auto;
        opacity: 0.8;
        font: 11px system-ui, sans-serif;
        line-height: 1;
        margin-top: 1px;
      }
      .pdf-image-saver-success { background: #176b3a; }
      .pdf-image-saver-warning { background: #8a5a00; }
      .pdf-image-saver-error { background: #8a1f1f; }
      .pdf-image-saver-progress {
        background: #1f3b63;
        border-left: 3px solid #7db7ff;
      }
      .pdf-image-saver-selection-overlay {
        position: absolute;
        inset: 0;
        z-index: 999998;
        cursor: crosshair;
        background: rgba(0, 0, 0, 0.05);
        outline: 2px solid rgba(31, 115, 183, 0.55);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
      }
      .pdf-image-saver-selection-hint {
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1;
        padding: 3px 7px;
        border-radius: 3px;
        background: rgba(17, 24, 39, 0.84);
        color: #fff;
        font: 11.5px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      .pdf-image-saver-selection-box {
        position: absolute;
        border: 2px solid #1f73b7;
        background: rgba(31, 115, 183, 0.16);
        box-sizing: border-box;
        pointer-events: none;
      }
      .pdf-image-saver-selection-size {
        position: absolute;
        right: 0;
        bottom: 0;
        padding: 1px 4px;
        border-radius: 2px 0 0 0;
        background: rgba(17, 24, 39, 0.9);
        color: #fff;
        font: 10.5px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      .pdf-image-saver-selection-size.is-min {
        background: rgba(138, 31, 31, 0.92);
      }
    `;
    doc.head?.appendChild(style);
  }

  function buildOpenPDFURI(attachment, pageNumber, annotationKey) {
    const libraryPath = getLibraryURIPath(attachment.libraryID);
    const itemKey = normalizeItemKey(attachment.key, "UNKNOWN");
    const page = normalizePageNumber(pageNumber, 1);
    let uri = `zotero://open-pdf/${libraryPath}/items/${itemKey}?page=${encodeURIComponent(String(page))}`;
    const normalizedAnnotationKey = normalizeAnnotationKey(annotationKey);
    if (normalizedAnnotationKey) {
      uri += `&annotation=${encodeURIComponent(normalizedAnnotationKey)}`;
    }
    return uri;
  }

  function getSourceRegionKey(attachment, entry) {
    const libraryID = normalizeMetadataText(attachment?.libraryID, "library", 40);
    const itemKey = normalizeItemKey(attachment?.key, "UNKNOWN");
    const pageNumber = normalizePageNumber(entry?.pageNumber, normalizePageIndex(entry?.pageIndex, 0) + 1);
    const bbox = normalizeBBoxNormalized(entry?.bboxNormalized)
      .map((value) => value.toFixed(4))
      .join(",");
    return `source-region:v1:${libraryID}:${itemKey}:p${pageNumber}:${bbox}`;
  }

  function getSourceRegionFingerprint(sourceRegionKey) {
    return getPreviewIndexFingerprint(sourceRegionKey) || "unknown";
  }

  function getLibraryURIPath(libraryID) {
    try {
      if (!libraryID || libraryID === Zotero.Libraries.userLibraryID) {
        return "library";
      }
      const library = Zotero.Libraries.get(libraryID);
      if (library?.libraryType === "group" && library.groupID) {
        return `groups/${library.groupID}`;
      }
    } catch (error) {
      logError(error);
    }
    return "library";
  }

  function buildSourceRegion(bboxNormalized) {
    const [left, top, right, bottom] = normalizeBBoxNormalized(bboxNormalized);
    const width = round6(right - left);
    const height = round6(bottom - top);
    const area = round6(width * height);
    return {
      coordinate_system: "normalized_page_rect",
      left,
      top,
      right,
      bottom,
      width,
      height,
      center_x: round6(left + width / 2),
      center_y: round6(top + height / 2),
      area,
      label: `x ${formatPercent(left)}-${formatPercent(right)}; y ${formatPercent(top)}-${formatPercent(bottom)}; ${formatPercent(width)}x${formatPercent(height)}`,
    };
  }

  function normalizeBBoxNormalized(bboxNormalized) {
    const values = Array.isArray(bboxNormalized) ? bboxNormalized : [];
    const x1 = clampNormalized(values[0], 0);
    const y1 = clampNormalized(values[1], 0);
    const x2 = clampNormalized(values[2], 1);
    const y2 = clampNormalized(values[3], 1);
    return [
      round6(Math.min(x1, x2)),
      round6(Math.min(y1, y2)),
      round6(Math.max(x1, x2)),
      round6(Math.max(y1, y2)),
    ];
  }

  function buildSourceRegionMapHTML(region, openURI = null, pageNumber = null) {
    if (!region) {
      return "";
    }
    const pageToken = pageNumber === null || pageNumber === undefined
      ? ""
      : ` p${normalizePageNumber(pageNumber, 1)}`;
    const map = `<div class="source-map" title="${escapeHTML(region.label || "Region")}"><span style="left:${formatCSSPercent(region.left)};top:${formatCSSPercent(region.top)};width:${formatCSSPercent(region.width)};height:${formatCSSPercent(region.height)}"></span></div>`;
    const uri = normalizeMetadataText(openURI, null, 500);
    if (!uri) {
      return map;
    }
    return `<a class="source-map-link" href="${escapeHTML(uri)}" title="Open map${escapeHTML(pageToken)}">${map}</a>`;
  }

  function normalizeAnnotationKey(value) {
    return normalizeItemKey(value, null);
  }

  function normalizeItemKey(value, fallback = null) {
    if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
      return fallback;
    }
    const key = String(value).trim();
    return /^[A-Za-z0-9]+$/.test(key) ? key : fallback;
  }

  function serializeItem(item) {
    if (!item) {
      return null;
    }
    return {
      key: normalizeMetadataText(item.key, null),
      title: normalizeMetadataText(getItemField(item, "title"), null),
      date: normalizeMetadataText(getItemField(item, "date"), null),
      doi: normalizeMetadataText(getItemField(item, "DOI"), null),
    };
  }

  function serializeAttachment(item) {
    return {
      key: normalizeMetadataText(item?.key, null),
      title: normalizeMetadataText(getItemField(item, "title"), null),
      content_type: normalizeMetadataText(item?.attachmentContentType, null),
    };
  }

  function formatHelperFailure(report) {
    const status = normalizeHelperStatusText(report?.status);
    if (status === "missing_pymupdf") {
      return "Helper: PyMuPDF n/a.";
    }
    if (status === "no_python") {
      return "Helper: Python n/a.";
    }
    const details = normalizeHelperWarningMessages(report?.warnings).join("; ");
    return `Helper failed: ${status}${details ? ` (${details})` : ""}`;
  }

  function normalizeHelperStatusText(status) {
    return normalizeMetadataText(status, "unknown", 60);
  }

  function normalizeHelperSchemaText(schemaVersion) {
    return normalizeMetadataText(schemaVersion, "unknown", 80);
  }

  function normalizeHelperWarningMessages(warnings) {
    const values = Array.isArray(warnings) ? warnings : [];
    const normalized = [];
    for (const warning of values) {
      const text = normalizeMetadataText(warning, null, 180);
      if (text) {
        normalized.push(text);
      }
      if (normalized.length >= 4) {
        break;
      }
    }
    return normalized;
  }

  function guessContentType(extension) {
    return {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      tif: "image/tiff",
      tiff: "image/tiff",
      bmp: "image/bmp",
      jpx: "image/jp2",
      jp2: "image/jp2",
    }[String(extension || "").toLowerCase()] || "application/octet-stream";
  }

  function normalizeImageContentType(value, extension) {
    const contentType = normalizeMetadataText(value, null, 80)?.toLowerCase();
    const knownTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/tiff",
      "image/bmp",
      "image/jp2",
    ]);
    return knownTypes.has(contentType) ? contentType : guessContentType(extension);
  }

  function normalizeHelperFilePath(value, outputDir) {
    if (typeof value !== "string") {
      return null;
    }
    const filePath = value.trim();
    if (!filePath) {
      return null;
    }
    const outputPath = typeof outputDir === "string" ? outputDir.trim() : "";
    if (!outputPath) {
      return null;
    }
    const normalizedFile = normalizePathForComparison(filePath);
    const normalizedOutput = normalizePathForComparison(outputPath);
    const outputPrefix = normalizedOutput.endsWith("/") ? normalizedOutput : `${normalizedOutput}/`;
    return normalizedFile.startsWith(outputPrefix) ? filePath : null;
  }

  function normalizePathForComparison(path) {
    const rawText = String(path || "")
      .replace(/\\/g, "/")
      .replace(/\/$/, "");
    const uncMatch = rawText.match(/^\/{2,}([^/]+)\/([^/]+)(?:\/(.*))?$/);
    const driveMatch = rawText.match(/^([A-Za-z]:)(?:\/|$)/);
    let rootPrefix = "";
    let body = rawText;
    if (uncMatch) {
      rootPrefix = `//${uncMatch[1]}/${uncMatch[2]}/`;
      body = uncMatch[3] || "";
    } else {
      const text = rawText.replace(/\/+/g, "/");
      rootPrefix = driveMatch ? `${driveMatch[1]}/` : (text.startsWith("/") ? "/" : "");
      body = driveMatch ? text.slice(driveMatch[1].length) : text;
    }
    const parts = [];
    for (const part of body.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (parts.length && parts[parts.length - 1] !== "..") {
          parts.pop();
        } else if (!rootPrefix) {
          parts.push(part);
        }
        continue;
      }
      parts.push(part);
    }
    let normalized = `${rootPrefix}${parts.join("/")}`;
    if (normalized.endsWith("/") && normalized.length > rootPrefix.length) {
      normalized = normalized.slice(0, -1);
    }
    if (typeof Services !== "undefined" && Services?.appinfo?.OS === "WINNT") {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  }

  function normalizeFileExtension(value) {
    const extension = normalizeMetadataText(value, null, 16)?.toLowerCase();
    return extension && /^[a-z0-9]+$/.test(extension) ? extension : null;
  }

  function getFileExtension(filePath) {
    const leafName = String(filePath || "").split(/[\\/]/).pop() || "";
    const match = leafName.match(/\.([A-Za-z0-9]{1,16})$/);
    return match ? match[1].toLowerCase() : null;
  }

  function sanitizeTitle(value) {
    return String(value || "PDF image").replace(/\s+/g, " ").trim().slice(0, 90);
  }

  function getSourceTitle(parentItem, attachment) {
    return (
      normalizeMetadataText(getItemField(parentItem, "title"), null) ||
      normalizeMetadataText(getItemField(attachment, "title"), null) ||
      "PDF"
    );
  }

  function getItemField(item, fieldName) {
    if (!item || typeof item.getField !== "function") {
      return "";
    }
    try {
      return item.getField(fieldName);
    } catch (error) {
      logError(error);
      return "";
    }
  }

  function normalizeMetadataText(value, fallback = null, maxLength = 240) {
    if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
      return fallback;
    }
    const text = String(value).replace(/\s+/g, " ").trim();
    if (!text) {
      return fallback;
    }
    return text.slice(0, maxLength);
  }

  function normalizeScope(value) {
    const text = normalizeMetadataText(value, "unknown", 40);
    return ["clip", "page", "auto-page", "document"].includes(text) ? text : "unknown";
  }

  function normalizeOriginalScope(value) {
    return value === "document" ? "document" : "page";
  }

  function normalizeOptionsObject(options) {
    return options && typeof options === "object" && !Array.isArray(options) ? options : {};
  }

  function getNumberPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(PREF_BRANCH + key, true);
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getIntegerPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(PREF_BRANCH + key, true);
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getStringPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(PREF_BRANCH + key, true);
      return typeof value === "string" ? value.trim() : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setStringPref(key, value) {
    try {
      Zotero.Prefs.set(PREF_BRANCH + key, String(value), true);
    } catch (error) {
      logError(error);
    }
  }

  function getBoolPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(PREF_BRANCH + key, true);
      return typeof value === "boolean" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getDefaultQualityKey() {
    return normalizeQualityKey(getStringPref("defaultQuality", "medium"));
  }

  function getDefaultImageCategoryKey() {
    return normalizeImageCategoryKey(getStringPref("defaultImageCategory", "auto"));
  }

  function normalizeQualityKey(value) {
    return Object.prototype.hasOwnProperty.call(QUALITY, value) ? value : "medium";
  }

  function normalizeImageCategoryKey(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(IMAGE_CATEGORIES, key) ? key : "auto";
  }

  function getImageCategoryLabel(categoryKey) {
    const key = normalizeImageCategoryKey(categoryKey);
    const category = IMAGE_CATEGORIES[key];
    return `${category.mark} ${category.label}`;
  }

  function getImageCategoryMark(categoryKey) {
    return IMAGE_CATEGORIES[normalizeImageCategoryKey(categoryKey)].mark;
  }

  function formatStyleTagsLabel(tags) {
    const values = normalizeStyleTags(tags);
    return values.length ? values.join(", ") : "none";
  }

  function formatPaletteLabel(palette) {
    const values = normalizePalette(palette);
    return values.length ? values.map((swatch) => swatch.hex).join(" ") : "none";
  }

  function formatCategorySummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const mark = getImageCategoryMark(entry?.imageCategory || entry?.image_category);
      counts.set(mark, (counts.get(mark) || 0) + 1);
    }
    if (!counts.size) {
      return "Cat none";
    }
    return `Cat ${[...counts.entries()].map(([mark, count]) => `${mark}${count}`).join(" ")}`;
  }

  function formatColorFamilySummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const family = normalizeColorFamily(entry?.colorFamily || entry?.color_family || deriveColorFamilyFromPalette(entry?.palette));
      counts.set(family, (counts.get(family) || 0) + 1);
    }
    if (!counts.size) {
      return "Hue none";
    }
    return `Hue ${[...counts.entries()].map(([family, count]) => `${family}${count}`).join(" ")}`;
  }

  function formatColorFamilyLabel(value) {
    const family = normalizeColorFamily(value);
    return family === "unknown" ? "Uk unknown" : `${getColorFamilyMark(family)} ${family}`;
  }

  function formatPptAssistSummary(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      return "none";
    }
    const cats = formatCategorySummary(list).replace(/^Cat\s+/, "");
    const hues = formatColorFamilySummary(list).replace(/^Hue\s+/, "");
    const lays = formatLayoutHintSummary(list).replace(/^Lay\s+/, "");
    const slots = formatSlideSlotSummary(list).replace(/^Slot\s+/, "");
    const roles = formatRoleHintSummary(list).replace(/^Role\s+/, "");
    const inserts = formatInsertHintSummary(list).replace(/^Ins\s+/, "");
    const stories = formatStoryHintSummary(list).replace(/^Story\s+/, "");
    const captions = formatCaptionHintSummary(list).replace(/^Cap\s+/, "");
    const hexes = [];
    for (const entry of list) {
      for (const swatch of normalizePalette(entry?.palette)) {
        if (!hexes.includes(swatch.hex)) {
          hexes.push(swatch.hex);
        }
        if (hexes.length >= 6) {
          break;
        }
      }
      if (hexes.length >= 6) {
        break;
      }
    }
    return `${cats}; ${lays}; ${slots}; ${roles}; ${inserts}; ${captions}; ${stories}; ${hues}; pal ${hexes.join(" ") || "none"}`;
  }

  function buildCategoryFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeImageCategoryKey(entry?.imageCategory || entry?.image_category);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="category" data-value="all" aria-pressed="true">All ${list.length}</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="category" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getImageCategoryMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Category filter">${chips.join("")}</div>`;
  }

  function buildHueFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeColorFamily(entry?.colorFamily || entry?.color_family || deriveColorFamilyFromPalette(entry?.palette));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="hue" data-value="all" aria-pressed="true">Hue all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="hue" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getColorFamilyMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Hue filter">${chips.join("")}</div>`;
  }

  function buildLayoutFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeLayoutHint(entry?.layoutHint || entry?.layout_hint || deriveLayoutHint(entry?.aspectRatio, entry?.imageCategory));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="layout" data-value="all" aria-pressed="true">Lay all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="layout" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getLayoutHintMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Layout filter">${chips.join("")}</div>`;
  }

  function buildSlideSlotFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeSlideSlot(entry?.slideSlot || entry?.slide_slot || deriveSlideSlot(entry?.layoutHint, entry?.imageCategory, entry?.aspectRatio));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="slot" data-value="all" aria-pressed="true">Slot all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="slot" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getSlideSlotMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Slide slot filter">${chips.join("")}</div>`;
  }

  function buildRoleFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeRoleHint(entry?.roleHint || entry?.role_hint || deriveRoleHint(entry?.imageCategory, entry?.slideSlot, entry?.layoutHint));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="role" data-value="all" aria-pressed="true">Role all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="role" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getRoleHintMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Role filter">${chips.join("")}</div>`;
  }

  function buildInsertFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const hint = normalizeInsertHint(entry?.insertHint || entry?.insert_hint || deriveInsertHint(entry?.slideSlot, entry?.layoutHint, entry?.aspectRatio, entry?.roleHint));
      counts.set(hint.size, (counts.get(hint.size) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="insert" data-value="all" aria-pressed="true">Ins all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="insert" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getInsertSizeMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Insert size filter">${chips.join("")}</div>`;
  }

  function buildInsertHintHTML(insertHint) {
    const hint = normalizeInsertHint(insertHint);
    if (!hint || hint.size === "unknown") {
      return "";
    }
    return `<div class="insert-hint" title="${escapeHTML(formatInsertHintLabel(hint))}"><span class="insert-chip">${escapeHTML(getInsertSizeMark(hint.size))} ${escapeHTML(hint.size)}</span><span class="insert-chip">${escapeHTML(hint.anchor)}</span><span class="insert-chip">w${escapeHTML(String(hint.width_pct))}%</span></div>`;
  }

  function buildCaptionFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const hint = normalizeCaptionHint(entry?.captionHint || entry?.caption_hint || deriveCaptionHint({
        imageCategory: entry?.imageCategory || entry?.image_category,
        roleHint: entry?.roleHint || entry?.role_hint,
        slideSlot: entry?.slideSlot || entry?.slide_slot,
        layoutHint: entry?.layoutHint || entry?.layout_hint,
        pageNumber: entry?.pageNumber || entry?.page_number,
        colorFamily: entry?.colorFamily || entry?.color_family,
        insertHint: entry?.insertHint || entry?.insert_hint,
      }));
      counts.set(hint.tone, (counts.get(hint.tone) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="caption" data-value="all" aria-pressed="true">Cap all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="caption" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getCaptionToneMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Caption tone filter">${chips.join("")}</div>`;
  }

  function buildCaptionHintHTML(captionHint) {
    const hint = normalizeCaptionHint(captionHint);
    if (!hint || hint.tone === "unknown") {
      return "";
    }
    return `<div class="caption-hint" title="${escapeHTML(formatCaptionHintLabel(hint))}"><span class="caption-chip">${escapeHTML(getCaptionToneMark(hint.tone))} ${escapeHTML(hint.tone)}</span><div class="caption-title">${escapeHTML(hint.title)}</div><div class="caption-note">${escapeHTML(hint.note)}</div></div>`;
  }

  function buildStoryFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      const key = normalizeStoryBeat(entry?.storyBeat || entry?.story_beat || deriveStoryBeat({
        roleHint: entry?.roleHint || entry?.role_hint,
        captionHint: entry?.captionHint || entry?.caption_hint,
        slideSlot: entry?.slideSlot || entry?.slide_slot,
        order: entry?.storyOrder || entry?.story_order,
        total: list.length,
      }));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size < 2) {
      return "";
    }
    const chips = [`<button type="button" class="filter-chip" data-filter="beat" data-value="all" aria-pressed="true">Story all</button>`];
    for (const [key, count] of counts.entries()) {
      chips.push(`<button type="button" class="filter-chip" data-filter="beat" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(getStoryBeatMark(key))} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Story beat filter">${chips.join("")}</div>`;
  }

  function buildStoryHintHTML(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || 1);
    const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || "unknown");
    if (beat === "unknown" && order <= 0) {
      return "";
    }
    return `<div class="story-hint" title="${escapeHTML(formatStoryHintLabel(safe))}"><span class="story-chip">#${escapeHTML(String(order))}</span><span class="story-chip">${escapeHTML(getStoryBeatMark(beat))} ${escapeHTML(beat)}</span></div>`;
  }

  function buildTagChipsHTML(styleTags) {
    const tags = normalizeStyleTags(styleTags);
    if (!tags.length) {
      return "";
    }
    return `<div class="tag-chips" title="Drawing style tags">${tags.slice(0, 8).map((tag) => `<span class="tag-chip">${escapeHTML(tag)}</span>`).join("")}</div>`;
  }

  function buildTagFilterBarHTML(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) {
      return "";
    }
    const counts = new Map();
    for (const entry of list) {
      for (const tag of normalizeStyleTags(entry?.styleTags || entry?.style_tags)) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    if (counts.size < 2) {
      return "";
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const chips = [`<button type="button" class="filter-chip" data-filter="tag" data-value="all" aria-pressed="true">Tags all</button>`];
    for (const [key, count] of top) {
      chips.push(`<button type="button" class="filter-chip" data-filter="tag" data-value="${escapeHTML(key)}" aria-pressed="false">${escapeHTML(key)} ${count}</button>`);
    }
    return `<div class="filter-bar" role="toolbar" aria-label="Style tag filter">${chips.join("")}</div>`;
  }

  function buildContrastPairHTML(dominantHex, contrastHex) {
    const dominant = normalizeHexColor(dominantHex);
    const contrast = normalizeHexColor(contrastHex);
    if (!dominant && !contrast) {
      return "";
    }
    const left = dominant || "#777777";
    const right = contrast || "#111111";
    return `<div class="contrast-pair" title="${escapeHTML(formatContrastPairLabel(left, right))}"><span class="contrast-swatch" style="background:${escapeHTML(left)}"></span><span class="contrast-swatch" style="background:${escapeHTML(right)}"></span><span>${escapeHTML(formatContrastPairLabel(left, right))}</span></div>`;
  }

  function buildPaletteChipsHTML(palette) {
    const swatches = normalizePalette(palette).slice(0, 6);
    if (!swatches.length) {
      return "";
    }
    return `<div class="palette-chips" title="${escapeHTML(formatPaletteLabel(swatches))}">${swatches.map((swatch) => `<button type="button" class="palette-chip" style="background:${escapeHTML(swatch.hex)}" title="${escapeHTML(swatch.hex)}" data-copy="${escapeHTML(swatch.hex)}" aria-label="Copy ${escapeHTML(swatch.hex)}"></button>`).join("")}</div>`;
  }

  function buildPptAssistToken(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const palette = normalizePalette(safe.palette).map((swatch) => swatch.hex).slice(0, 6);
    const tags = normalizeStyleTags(safe.styleTags || safe.style_tags);
    const aspect = normalizeAspectRatio(safe.aspectRatio || safe.aspect_ratio || deriveAspectRatio(safe.renderedWidth || safe.rendered_width, safe.renderedHeight || safe.rendered_height));
    const layout = normalizeLayoutHint(safe.layoutHint || safe.layout_hint || deriveLayoutHint(aspect, safe.imageCategory || safe.image_category));
    const dominant = normalizeHexColor(safe.dominantHex || safe.dominant_hex) || palette[0] || null;
    const contrast = normalizeHexColor(safe.contrastHex || safe.contrast_hex) || deriveContrastHex(palette, dominant);
    const slot = normalizeSlideSlot(safe.slideSlot || safe.slide_slot || deriveSlideSlot(layout, safe.imageCategory || safe.image_category, aspect));
    const role = normalizeRoleHint(safe.roleHint || safe.role_hint || deriveRoleHint(safe.imageCategory || safe.image_category, slot, layout));
    return [
      `cat=${normalizeImageCategoryKey(safe.imageCategory || safe.image_category)}`,
      `lay=${layout}`,
      `slot=${slot}`,
      `role=${role}`,
      `ins=${normalizeInsertHint(safe.insertHint || safe.insert_hint || deriveInsertHint(slot, layout, aspect, role)).size}`,
      `cap=${normalizeCaptionHint(safe.captionHint || safe.caption_hint || deriveCaptionHint({
        imageCategory: safe.imageCategory || safe.image_category,
        roleHint: role,
        slideSlot: slot,
        layoutHint: layout,
        pageNumber: safe.pageNumber || safe.page_number,
        colorFamily: safe.colorFamily || safe.color_family,
        insertHint: safe.insertHint || safe.insert_hint,
      })).tone}`,
      `beat=${normalizeStoryBeat(safe.storyBeat || safe.story_beat || deriveStoryBeat({ roleHint: role, captionHint: safe.captionHint || safe.caption_hint, slideSlot: slot, order: safe.storyOrder || safe.story_order, total: safe.storyTotal || safe.story_total }))}`,
      `ord=${normalizeStoryOrder(safe.storyOrder || safe.story_order || 1)}`,
      `ar=${formatAspectRatioLabel(aspect)}`,
      `hue=${normalizeColorFamily(safe.colorFamily || safe.color_family || deriveColorFamilyFromPalette(palette))}`,
      `dom=${dominant || "none"}`,
      `ctr=${contrast || "none"}`,
      `tags=${tags.join("|") || "none"}`,
      `pal=${palette.join(",") || "none"}`,
      `page=${normalizePageNumber(safe.pageNumber || safe.page_number, 1)}`,
      `q=${normalizeQualityKey(safe.quality)}`,
    ].join(";");
  }

  function buildInsertPackToken(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const aspect = normalizeAspectRatio(safe.aspectRatio || safe.aspect_ratio || deriveAspectRatio(safe.renderedWidth || safe.rendered_width, safe.renderedHeight || safe.rendered_height));
    const layout = normalizeLayoutHint(safe.layoutHint || safe.layout_hint || deriveLayoutHint(aspect, safe.imageCategory || safe.image_category));
    const slot = normalizeSlideSlot(safe.slideSlot || safe.slide_slot || deriveSlideSlot(layout, safe.imageCategory || safe.image_category, aspect));
    const role = normalizeRoleHint(safe.roleHint || safe.role_hint || deriveRoleHint(safe.imageCategory || safe.image_category, slot, layout));
    const insert = normalizeInsertHint(safe.insertHint || safe.insert_hint || deriveInsertHint(slot, layout, aspect, role));
    return [
      `size=${insert.size}`,
      `anchor=${insert.anchor}`,
      `w=${insert.width_pct}`,
      `h=${insert.height_pct}`,
      `slot=${slot}`,
      `role=${role}`,
      `lay=${layout}`,
      `ar=${formatAspectRatioLabel(aspect)}`,
    ].join(";");
  }

  function buildCaptionPackToken(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const aspect = normalizeAspectRatio(safe.aspectRatio || safe.aspect_ratio || deriveAspectRatio(safe.renderedWidth || safe.rendered_width, safe.renderedHeight || safe.rendered_height));
    const layout = normalizeLayoutHint(safe.layoutHint || safe.layout_hint || deriveLayoutHint(aspect, safe.imageCategory || safe.image_category));
    const slot = normalizeSlideSlot(safe.slideSlot || safe.slide_slot || deriveSlideSlot(layout, safe.imageCategory || safe.image_category, aspect));
    const role = normalizeRoleHint(safe.roleHint || safe.role_hint || deriveRoleHint(safe.imageCategory || safe.image_category, slot, layout));
    const caption = normalizeCaptionHint(safe.captionHint || safe.caption_hint || deriveCaptionHint({
      imageCategory: safe.imageCategory || safe.image_category,
      roleHint: role,
      slideSlot: slot,
      layoutHint: layout,
      pageNumber: safe.pageNumber || safe.page_number,
      colorFamily: safe.colorFamily || safe.color_family,
      insertHint: safe.insertHint || safe.insert_hint,
    }));
    return [
      `tone=${caption.tone}`,
      `title=${caption.title}`,
      `note=${caption.note}`,
      `role=${role}`,
      `slot=${slot}`,
      `cat=${normalizeImageCategoryKey(safe.imageCategory || safe.image_category)}`,
      `page=${normalizePageNumber(safe.pageNumber || safe.page_number, 1)}`,
    ].join(";");
  }

  function buildStoryPackToken(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const aspect = normalizeAspectRatio(safe.aspectRatio || safe.aspect_ratio || deriveAspectRatio(safe.renderedWidth || safe.rendered_width, safe.renderedHeight || safe.rendered_height));
    const layout = normalizeLayoutHint(safe.layoutHint || safe.layout_hint || deriveLayoutHint(aspect, safe.imageCategory || safe.image_category));
    const slot = normalizeSlideSlot(safe.slideSlot || safe.slide_slot || deriveSlideSlot(layout, safe.imageCategory || safe.image_category, aspect));
    const role = normalizeRoleHint(safe.roleHint || safe.role_hint || deriveRoleHint(safe.imageCategory || safe.image_category, slot, layout));
    const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || 1);
    const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || deriveStoryBeat({
      roleHint: role,
      captionHint: safe.captionHint || safe.caption_hint,
      slideSlot: slot,
      order,
      total: safe.storyTotal || safe.story_total,
    }));
    const caption = normalizeCaptionHint(safe.captionHint || safe.caption_hint || deriveCaptionHint({
      imageCategory: safe.imageCategory || safe.image_category,
      roleHint: role,
      slideSlot: slot,
      layoutHint: layout,
      pageNumber: safe.pageNumber || safe.page_number,
      colorFamily: safe.colorFamily || safe.color_family,
      insertHint: safe.insertHint || safe.insert_hint,
    }));
    return [
      `ord=${order}`,
      `beat=${beat}`,
      `role=${role}`,
      `slot=${slot}`,
      `cap=${caption.tone}`,
      `title=${caption.title}`,
      `cat=${normalizeImageCategoryKey(safe.imageCategory || safe.image_category)}`,
      `page=${normalizePageNumber(safe.pageNumber || safe.page_number, 1)}`,
    ].join(";");
  }

  function buildRolePackToken(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const palette = normalizePalette(safe.palette).map((swatch) => swatch.hex).slice(0, 4);
    const aspect = normalizeAspectRatio(safe.aspectRatio || safe.aspect_ratio || deriveAspectRatio(safe.renderedWidth || safe.rendered_width, safe.renderedHeight || safe.rendered_height));
    const layout = normalizeLayoutHint(safe.layoutHint || safe.layout_hint || deriveLayoutHint(aspect, safe.imageCategory || safe.image_category));
    const slot = normalizeSlideSlot(safe.slideSlot || safe.slide_slot || deriveSlideSlot(layout, safe.imageCategory || safe.image_category, aspect));
    const role = normalizeRoleHint(safe.roleHint || safe.role_hint || deriveRoleHint(safe.imageCategory || safe.image_category, slot, layout));
    const dominant = normalizeHexColor(safe.dominantHex || safe.dominant_hex) || palette[0] || "none";
    const contrast = normalizeHexColor(safe.contrastHex || safe.contrast_hex) || deriveContrastHex(palette, dominant) || "none";
    return [
      `role=${role}`,
      `slot=${slot}`,
      `lay=${layout}`,
      `cat=${normalizeImageCategoryKey(safe.imageCategory || safe.image_category)}`,
      `pair=${dominant}/${contrast}`,
      `pal=${palette.join(",") || "none"}`,
      `use=${formatRoleUsageHint(role)}`,
    ].join(";");
  }

  function buildIndexPptAssistToken(entries) {
    const list = Array.isArray(entries) ? entries : [];
    return list.map((entry, index) => `#${index + 1}:${buildPptAssistToken(entry)}`).join(" || ");
  }

  function buildIndexStoryboardToken(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      return "none";
    }
    return list.map((entry, index) => {
      const safe = entry && typeof entry === "object" ? entry : {};
      const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || (index + 1));
      const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || deriveStoryBeat({
        roleHint: safe.roleHint || safe.role_hint,
        captionHint: safe.captionHint || safe.caption_hint,
        slideSlot: safe.slideSlot || safe.slide_slot,
        order,
        total: list.length,
      }));
      const page = normalizePageNumber(safe.pageNumber || safe.page_number, 1);
      return `#${order}:${beat} p${page}`;
    }).join(" -> ");
  }

  function buildIndexPptAssistSummary(entries) {
    const list = Array.isArray(entries) ? entries : [];
    return {
      categories: formatCategorySummary(list),
      color_families: formatColorFamilySummary(list),
      layouts: formatLayoutHintSummary(list),
      slide_slots: formatSlideSlotSummary(list),
      roles: formatRoleHintSummary(list),
      inserts: formatInsertHintSummary(list),
      captions: formatCaptionHintSummary(list),
      stories: formatStoryHintSummary(list),
      token: buildIndexPptAssistToken(list),
      entry_tokens: list.map((entry) => buildPptAssistToken(entry)),
      role_packs: list.map((entry) => buildRolePackToken(entry)),
      insert_packs: list.map((entry) => buildInsertPackToken(entry)),
      caption_packs: list.map((entry) => buildCaptionPackToken(entry)),
      story_packs: list.map((entry) => buildStoryPackToken(entry)),
      storyboard_token: buildIndexStoryboardToken(list),
      board_layout: deriveBoardLayout(list),
      storyboard: list.map((entry, index) => ({
        order: normalizeStoryOrder(entry?.storyOrder || entry?.story_order || (index + 1)),
        beat: normalizeStoryBeat(entry?.storyBeat || entry?.story_beat || deriveStoryBeat({
          roleHint: entry?.roleHint || entry?.role_hint,
          captionHint: entry?.captionHint || entry?.caption_hint,
          slideSlot: entry?.slideSlot || entry?.slide_slot,
          order: entry?.storyOrder || entry?.story_order || (index + 1),
          total: list.length,
        })),
        page: normalizePageNumber(entry?.pageNumber || entry?.page_number, 1),
        role: normalizeRoleHint(entry?.roleHint || entry?.role_hint),
      })),
    };
  }

  function deriveBoardLayout(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const n = list.length;
    if (n <= 0) {
      return "empty";
    }
    if (n === 1) {
      return "single";
    }
    const layouts = list.map((e) => normalizeLayoutHint(e?.layoutHint || e?.layout_hint || deriveLayoutHint(e?.aspectRatio, e?.imageCategory)));
    const wideCount = layouts.filter((l) => l === "wide").length;
    const tallCount = layouts.filter((l) => l === "tall").length;
    if (n === 2) {
      return wideCount >= 1 ? "split-horizontal" : "split-vertical";
    }
    if (n === 3) {
      return wideCount >= 2 ? "trio-horizontal" : "trio-grid";
    }
    if (n === 4) {
      return "grid-2x2";
    }
    if (n <= 6) {
      return "grid-3x2";
    }
    return wideCount > tallCount ? "gallery-horizontal" : "gallery-grid";
  }

  function buildDrawingStyleTags({ imageCategory, styleTags, palette, colorFamily, layoutHint, aspectRatio, slideSlot, roleHint, insertHint, captionHint, storyBeat }) {
    const tags = normalizeStyleTags(styleTags);
    const category = normalizeImageCategoryKey(imageCategory);
    const family = normalizeColorFamily(colorFamily || deriveColorFamilyFromPalette(palette));
    const layout = normalizeLayoutHint(layoutHint || deriveLayoutHint(aspectRatio, category));
    const slot = normalizeSlideSlot(slideSlot || deriveSlideSlot(layout, category, aspectRatio));
    const role = normalizeRoleHint(roleHint || deriveRoleHint(category, slot, layout));
    const insert = normalizeInsertHint(insertHint || deriveInsertHint(slot, layout, aspectRatio, role));
    const caption = normalizeCaptionHint(captionHint || deriveCaptionHint({ imageCategory: category, roleHint: role, slideSlot: slot, layoutHint: layout, insertHint: insert }));
    const beat = normalizeStoryBeat(storyBeat || deriveStoryBeat({ roleHint: role, captionHint: caption, slideSlot: slot }));
    const categoryTag = category === "auto" ? null : category;
    const familyTag = family === "unknown" ? null : family;
    const layoutTag = layout === "unknown" ? null : layout;
    const slotTag = slot === "unknown" ? null : slot;
    const roleTag = role === "unknown" ? null : role;
    const insertTag = insert.size === "unknown" ? null : `ins-${insert.size}`;
    const captionTag = caption.tone === "unknown" ? null : `cap-${caption.tone}`;
    const beatTag = beat === "unknown" ? null : `beat-${beat}`;
    const drawingHints = [];
    if (category === "chart") {
      drawingHints.push("plot", "axes");
    } else if (category === "diagram") {
      drawingHints.push("flow", "boxes");
    } else if (category === "schematic") {
      drawingHints.push("circuit", "lines");
    } else if (category === "table") {
      drawingHints.push("grid", "cells");
    } else if (category === "equation") {
      drawingHints.push("math", "symbols");
    } else if (category === "photo") {
      drawingHints.push("photo-ref");
    } else if (category === "figure") {
      drawingHints.push("figure-ref");
    }
    if (layout === "wide") {
      drawingHints.push("banner", "landscape");
    } else if (layout === "tall") {
      drawingHints.push("portrait", "stack");
    } else if (layout === "square") {
      drawingHints.push("tile");
    }
    if (slot === "hero") {
      drawingHints.push("slide-hero");
    } else if (slot === "side") {
      drawingHints.push("slide-side");
    } else if (slot === "footer") {
      drawingHints.push("slide-footer");
    } else if (slot === "inset") {
      drawingHints.push("slide-inset");
    }
    if (role === "result") {
      drawingHints.push("role-result", "lead-visual");
    } else if (role === "method") {
      drawingHints.push("role-method", "pipeline");
    } else if (role === "evidence") {
      drawingHints.push("role-evidence", "support");
    } else if (role === "compare") {
      drawingHints.push("role-compare", "before-after");
    } else if (role === "context") {
      drawingHints.push("role-context", "background");
    }
    if (insert.size === "large") {
      drawingHints.push("insert-large");
    } else if (insert.size === "medium") {
      drawingHints.push("insert-medium");
    } else if (insert.size === "small") {
      drawingHints.push("insert-small");
    }
    if (caption.tone === "result") {
      drawingHints.push("caption-result");
    } else if (caption.tone === "method") {
      drawingHints.push("caption-method");
    } else if (caption.tone === "compare") {
      drawingHints.push("caption-compare");
    } else if (caption.tone === "context") {
      drawingHints.push("caption-context");
    }
    if (beat === "hook") {
      drawingHints.push("story-hook");
    } else if (beat === "setup") {
      drawingHints.push("story-setup");
    } else if (beat === "method") {
      drawingHints.push("story-method");
    } else if (beat === "result") {
      drawingHints.push("story-result");
    } else if (beat === "compare") {
      drawingHints.push("story-compare");
    } else if (beat === "close") {
      drawingHints.push("story-close");
    }
    return normalizeStyleTags([
      ...tags,
      ...(tags.length ? [] : deriveStyleTagsFromPalette(palette)),
      categoryTag,
      familyTag,
      layoutTag,
      slotTag,
      roleTag,
      insertTag,
      captionTag,
      beatTag,
      ...drawingHints,
    ]);
  }

  function deriveInsertHint(slideSlot, layoutHint, aspectRatio, roleHint) {
    const slot = normalizeSlideSlot(slideSlot);
    const layout = normalizeLayoutHint(layoutHint);
    const role = normalizeRoleHint(roleHint);
    const aspect = normalizeAspectRatio(aspectRatio);
    let size = "medium";
    let anchor = "center";
    let width = 48;
    let height = 36;
    if (slot === "hero" || role === "result") {
      size = "large";
      anchor = "center";
      width = layout === "wide" ? 72 : 64;
      height = layout === "tall" ? 70 : 54;
    } else if (slot === "side") {
      size = "medium";
      anchor = "right";
      width = 38;
      height = layout === "tall" ? 62 : 48;
    } else if (slot === "footer") {
      size = "medium";
      anchor = "bottom";
      width = layout === "wide" ? 70 : 58;
      height = 28;
    } else if (slot === "inset") {
      size = "small";
      anchor = "top-right";
      width = 28;
      height = 24;
    }
    if (aspect !== null) {
      // keep height coherent with aspect while preserving recommended width
      height = Math.max(16, Math.min(78, Math.round(width / aspect)));
    }
    if (role === "compare" && size === "large") {
      size = "medium";
      width = Math.min(width, 46);
    }
    return normalizeInsertHint({ size, anchor, width_pct: width, height_pct: height });
  }

  function normalizeInsertHint(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const sizeRaw = String(source.size || value || "").trim().toLowerCase();
    const size = ["large", "medium", "small", "unknown"].includes(sizeRaw) ? sizeRaw : "unknown";
    const anchorRaw = String(source.anchor || "").trim().toLowerCase();
    const anchorAllowed = new Set(["center", "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]);
    const anchor = anchorAllowed.has(anchorRaw) ? anchorRaw : "center";
    const width = Math.max(10, Math.min(90, Math.round(Number(source.width_pct ?? source.widthPct ?? 48) || 48)));
    const height = Math.max(10, Math.min(90, Math.round(Number(source.height_pct ?? source.heightPct ?? 36) || 36)));
    return {
      size,
      anchor,
      width_pct: width,
      height_pct: height,
    };
  }

  function getInsertSizeMark(value) {
    const size = typeof value === "string" ? value : value?.size;
    const key = String(size || "").trim().toLowerCase();
    if (key === "large") return "Lg";
    if (key === "medium") return "Md";
    if (key === "small") return "Sm";
    return "Uk";
  }

  function formatInsertHintLabel(value) {
    const hint = normalizeInsertHint(value);
    if (hint.size === "unknown") {
      return "Uk unknown";
    }
    return `${getInsertSizeMark(hint.size)} ${hint.size}; ${hint.anchor}; ${hint.width_pct}x${hint.height_pct}`;
  }

  function formatInsertHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const hint = normalizeInsertHint(entry?.insertHint || entry?.insert_hint || deriveInsertHint(entry?.slideSlot, entry?.layoutHint, entry?.aspectRatio, entry?.roleHint));
      counts.set(hint.size, (counts.get(hint.size) || 0) + 1);
    }
    if (!counts.size) {
      return "Ins none";
    }
    return `Ins ${[...counts.entries()].map(([key, count]) => `${getInsertSizeMark(key)}${count}`).join(" ")}`;
  }

  function deriveCaptionHint({ imageCategory, roleHint, slideSlot, layoutHint, pageNumber, colorFamily, insertHint } = {}) {
    const category = normalizeImageCategoryKey(imageCategory);
    const role = normalizeRoleHint(roleHint || deriveRoleHint(category, slideSlot, layoutHint));
    const slot = normalizeSlideSlot(slideSlot);
    const layout = normalizeLayoutHint(layoutHint);
    const family = normalizeColorFamily(colorFamily);
    const insert = normalizeInsertHint(insertHint);
    const page = normalizePageNumber(pageNumber, 1);
    let tone = "context";
    if (role === "result" || category === "chart" || category === "table") {
      tone = "result";
    } else if (role === "method" || category === "diagram" || category === "schematic") {
      tone = "method";
    } else if (role === "compare" || slot === "footer") {
      tone = "compare";
    } else if (role === "context" || category === "photo") {
      tone = "context";
    } else if (role === "evidence" || category === "equation") {
      tone = "result";
    }
    const catLabel = getImageCategoryLabel(category).replace(/^[A-Za-z]{1,3}\s+/, "") || category;
    const titleMap = {
      result: `Key ${catLabel} result`,
      method: `${catLabel} workflow`,
      compare: `${catLabel} comparison`,
      context: `${catLabel} context`,
      unknown: `${catLabel} figure`,
    };
    const noteBits = [
      `p${page}`,
      role !== "unknown" ? role : null,
      slot !== "unknown" ? slot : null,
      layout !== "unknown" ? layout : null,
      insert.size !== "unknown" ? insert.size : null,
      family !== "unknown" ? family : null,
    ].filter(Boolean);
    return normalizeCaptionHint({
      tone,
      title: titleMap[tone] || titleMap.unknown,
      note: noteBits.join(" · "),
    });
  }

  function normalizeCaptionHint(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const toneRaw = String(source.tone || value || "").trim().toLowerCase();
    const tone = ["result", "method", "compare", "context", "unknown"].includes(toneRaw) ? toneRaw : "unknown";
    const title = String(source.title || "").trim().replace(/\s+/g, " ").slice(0, 80) || (tone === "unknown" ? "Figure caption" : `${tone} caption`);
    const note = String(source.note || "").trim().replace(/\s+/g, " ").slice(0, 120);
    return { tone, title, note };
  }

  function getCaptionToneMark(value) {
    const tone = typeof value === "string" ? value : value?.tone;
    const key = String(tone || "").trim().toLowerCase();
    if (key === "result") return "Rt";
    if (key === "method") return "Mt";
    if (key === "compare") return "Cm";
    if (key === "context") return "Cx";
    return "Uk";
  }

  function formatCaptionHintLabel(value) {
    const hint = normalizeCaptionHint(value);
    if (hint.tone === "unknown") {
      return "Uk unknown";
    }
    return `${getCaptionToneMark(hint.tone)} ${hint.tone}; ${hint.title}`;
  }

  function formatCaptionHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const hint = normalizeCaptionHint(entry?.captionHint || entry?.caption_hint || deriveCaptionHint({
        imageCategory: entry?.imageCategory || entry?.image_category,
        roleHint: entry?.roleHint || entry?.role_hint,
        slideSlot: entry?.slideSlot || entry?.slide_slot,
        layoutHint: entry?.layoutHint || entry?.layout_hint,
        pageNumber: entry?.pageNumber || entry?.page_number,
        colorFamily: entry?.colorFamily || entry?.color_family,
        insertHint: entry?.insertHint || entry?.insert_hint,
      }));
      counts.set(hint.tone, (counts.get(hint.tone) || 0) + 1);
    }
    if (!counts.size) {
      return "Cap none";
    }
    return `Cap ${[...counts.entries()].map(([key, count]) => `${getCaptionToneMark(key)}${count}`).join(" ")}`;
  }

  function applyStoryboardHints(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const total = list.length;
    list.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      entry.storyOrder = normalizeStoryOrder(entry.storyOrder || entry.story_order || (index + 1));
      entry.storyTotal = total;
      entry.storyBeat = normalizeStoryBeat(entry.storyBeat || entry.story_beat || deriveStoryBeat({
        roleHint: entry.roleHint || entry.role_hint,
        captionHint: entry.captionHint || entry.caption_hint,
        slideSlot: entry.slideSlot || entry.slide_slot,
        order: entry.storyOrder,
        total,
      }));
    });
    return list;
  }

  function deriveStoryBeat({ roleHint, captionHint, slideSlot, order, total } = {}) {
    const role = normalizeRoleHint(roleHint);
    const caption = normalizeCaptionHint(captionHint);
    const slot = normalizeSlideSlot(slideSlot);
    const idx = normalizeStoryOrder(order || 1);
    const count = Math.max(1, normalizeStoryOrder(total || 1));
    if (role === "method" || caption.tone === "method") {
      return "method";
    }
    if (role === "compare" || caption.tone === "compare") {
      return "compare";
    }
    if (role === "result" || caption.tone === "result") {
      return idx >= count ? "close" : "result";
    }
    if (role === "context" || caption.tone === "context") {
      return idx <= 1 ? "hook" : "setup";
    }
    if (slot === "hero" && idx <= 1) {
      return "hook";
    }
    if (slot === "footer" || idx >= count) {
      return "close";
    }
    if (idx === 1) {
      return "hook";
    }
    if (idx === 2 && count >= 3) {
      return "setup";
    }
    return "result";
  }

  function normalizeStoryOrder(value) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number) || number <= 0) {
      return 1;
    }
    return Math.min(999, number);
  }

  function normalizeStoryBeat(value) {
    const key = String(value || "").trim().toLowerCase();
    return ["hook", "setup", "method", "result", "compare", "close", "unknown"].includes(key) ? key : "unknown";
  }

  function getStoryBeatMark(value) {
    const key = normalizeStoryBeat(value);
    if (key === "hook") return "Hk";
    if (key === "setup") return "Su";
    if (key === "method") return "Mt";
    if (key === "result") return "Rs";
    if (key === "compare") return "Cm";
    if (key === "close") return "Cl";
    return "Uk";
  }

  function formatStoryHintLabel(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || 1);
    const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || "unknown");
    return `#${order} ${getStoryBeatMark(beat)} ${beat}`;
  }

  function formatStoryHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const beat = normalizeStoryBeat(entry?.storyBeat || entry?.story_beat || deriveStoryBeat({
        roleHint: entry?.roleHint || entry?.role_hint,
        captionHint: entry?.captionHint || entry?.caption_hint,
        slideSlot: entry?.slideSlot || entry?.slide_slot,
        order: entry?.storyOrder || entry?.story_order,
        total: Array.isArray(entries) ? entries.length : 1,
      }));
      counts.set(beat, (counts.get(beat) || 0) + 1);
    }
    if (!counts.size) {
      return "Story none";
    }
    return `Story ${[...counts.entries()].map(([key, count]) => `${getStoryBeatMark(key)}${count}`).join(" ")}`;
  }

  function getColorFamilyMark(value) {
    const family = normalizeColorFamily(value);
    if (family === "unknown") return "Uk";
    return family.slice(0, 2).replace(/^./, (ch) => ch.toUpperCase());
  }

  function deriveRoleHint(imageCategory, slideSlot, layoutHint) {
    const category = normalizeImageCategoryKey(imageCategory);
    const slot = normalizeSlideSlot(slideSlot);
    const layout = normalizeLayoutHint(layoutHint);
    if (category === "chart" || category === "table") {
      return slot === "side" ? "compare" : "result";
    }
    if (category === "diagram" || category === "schematic") {
      return "method";
    }
    if (category === "equation") {
      return "evidence";
    }
    if (category === "photo") {
      return slot === "hero" ? "context" : "evidence";
    }
    if (slot === "hero") {
      return "result";
    }
    if (slot === "footer") {
      return "compare";
    }
    if (layout === "tall") {
      return "evidence";
    }
    return "context";
  }

  function normalizeRoleHint(value) {
    const key = String(value || "").trim().toLowerCase();
    return ["result", "method", "evidence", "compare", "context", "unknown"].includes(key) ? key : "unknown";
  }

  function getRoleHintMark(value) {
    const key = normalizeRoleHint(value);
    if (key === "result") return "Rs";
    if (key === "method") return "Md";
    if (key === "evidence") return "Ev";
    if (key === "compare") return "Cp";
    if (key === "context") return "Cx";
    return "Uk";
  }

  function formatRoleHintLabel(value) {
    const key = normalizeRoleHint(value);
    return `${getRoleHintMark(key)} ${key}`;
  }

  function formatRoleHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeRoleHint(entry?.roleHint || entry?.role_hint || deriveRoleHint(entry?.imageCategory, entry?.slideSlot, entry?.layoutHint));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "Role none";
    }
    return `Role ${[...counts.entries()].map(([key, count]) => `${getRoleHintMark(key)}${count}`).join(" ")}`;
  }

  function formatRoleUsageHint(value) {
    const key = normalizeRoleHint(value);
    if (key === "result") return "lead-figure";
    if (key === "method") return "pipeline-or-steps";
    if (key === "evidence") return "support-callout";
    if (key === "compare") return "side-by-side";
    if (key === "context") return "background-scene";
    return "general";
  }

  function deriveContrastHex(palette, dominantHex = null) {
    const swatches = normalizePalette(palette);
    const dominant = normalizeHexColor(dominantHex) || swatches[0]?.hex || null;
    if (!dominant) {
      return null;
    }
    let best = null;
    let bestScore = -1;
    for (const swatch of swatches) {
      if (!swatch?.hex || swatch.hex === dominant) {
        continue;
      }
      const score = hexContrastScore(dominant, swatch.hex);
      if (score > bestScore) {
        bestScore = score;
        best = swatch.hex;
      }
    }
    if (best) {
      return best;
    }
    // fallback complementary-ish simple invert-ish dark/light
    const rgb = hexToRgb(dominant);
    if (!rgb) {
      return null;
    }
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance > 0.55 ? "#111111" : "#f5f5f5";
  }

  function hexToRgb(hex) {
    const value = normalizeHexColor(hex);
    if (!value) {
      return null;
    }
    return {
      r: parseInt(value.slice(1, 3), 16),
      g: parseInt(value.slice(3, 5), 16),
      b: parseInt(value.slice(5, 7), 16),
    };
  }

  function hexContrastScore(leftHex, rightHex) {
    const left = hexToRgb(leftHex);
    const right = hexToRgb(rightHex);
    if (!left || !right) {
      return -1;
    }
    const dr = left.r - right.r;
    const dg = left.g - right.g;
    const db = left.b - right.b;
    return dr * dr + dg * dg + db * db;
  }

  function formatContrastPairLabel(dominantHex, contrastHex) {
    const dominant = normalizeHexColor(dominantHex) || "none";
    const contrast = normalizeHexColor(contrastHex) || "none";
    return `${dominant}/${contrast}`;
  }

  function deriveSlideSlot(layoutHint, imageCategory, aspectRatio) {
    const layout = normalizeLayoutHint(layoutHint || deriveLayoutHint(aspectRatio, imageCategory));
    const category = normalizeImageCategoryKey(imageCategory);
    if (category === "equation") {
      return "inset";
    }
    if (layout === "wide") {
      return category === "table" ? "footer" : "hero";
    }
    if (layout === "tall") {
      return "side";
    }
    if (layout === "square") {
      return category === "photo" ? "inset" : "side";
    }
    return "unknown";
  }

  function normalizeSlideSlot(value) {
    const key = String(value || "").trim().toLowerCase();
    return ["hero", "side", "footer", "inset", "unknown"].includes(key) ? key : "unknown";
  }

  function getSlideSlotMark(value) {
    const key = normalizeSlideSlot(value);
    if (key === "hero") return "Hr";
    if (key === "side") return "Sd";
    if (key === "footer") return "Ft";
    if (key === "inset") return "In";
    return "Uk";
  }

  function formatSlideSlotLabel(value) {
    const key = normalizeSlideSlot(value);
    return `${getSlideSlotMark(key)} ${key}`;
  }

  function formatSlideSlotSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeSlideSlot(entry?.slideSlot || entry?.slide_slot || deriveSlideSlot(entry?.layoutHint, entry?.imageCategory, entry?.aspectRatio));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "Slot none";
    }
    return `Slot ${[...counts.entries()].map(([key, count]) => `${getSlideSlotMark(key)}${count}`).join(" ")}`;
  }

  function deriveAspectRatio(width, height) {
    const w = normalizePositiveInteger(width, null);
    const h = normalizePositiveInteger(height, null);
    if (!w || !h) {
      return null;
    }
    return round6(w / h);
  }

  function normalizeAspectRatio(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }
    return round6(number);
  }

  function formatAspectRatioLabel(value) {
    const ratio = normalizeAspectRatio(value);
    return ratio === null ? "n/a" : ratio.toFixed(2);
  }

  function deriveLayoutHint(aspectRatio, imageCategory) {
    const ratio = normalizeAspectRatio(aspectRatio);
    if (ratio === null) {
      const category = normalizeImageCategoryKey(imageCategory);
      if (category === "table") return "wide";
      if (category === "equation") return "square";
      return "unknown";
    }
    if (ratio >= 1.45) return "wide";
    if (ratio <= 0.75) return "tall";
    return "square";
  }

  function normalizeLayoutHint(value) {
    const key = String(value || "").trim().toLowerCase();
    return ["wide", "tall", "square", "unknown"].includes(key) ? key : "unknown";
  }

  function getLayoutHintMark(value) {
    const key = normalizeLayoutHint(value);
    if (key === "wide") return "W";
    if (key === "tall") return "T";
    if (key === "square") return "S";
    return "U";
  }

  function formatLayoutHintLabel(value, aspectRatio = null) {
    const key = normalizeLayoutHint(value);
    const mark = getLayoutHintMark(key);
    const ar = formatAspectRatioLabel(aspectRatio);
    if (key === "unknown") {
      return `${mark} unknown`;
    }
    return `${mark} ${key}; AR ${ar}`;
  }

  function formatLayoutHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeLayoutHint(entry?.layoutHint || entry?.layout_hint || deriveLayoutHint(entry?.aspectRatio, entry?.imageCategory));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "Lay none";
    }
    return `Lay ${[...counts.entries()].map(([key, count]) => `${getLayoutHintMark(key)}${count}`).join(" ")}`;
  }

  function deriveColorFamilyFromPalette(palette) {
    const swatches = normalizePalette(palette);
    if (!swatches.length) {
      return "unknown";
    }
    return colorFamilyFromHue(swatches[0].hue, swatches[0].saturation, swatches[0].lightness);
  }

  function normalizeColorFamily(value) {
    const key = String(value || "").trim().toLowerCase();
    const allowed = new Set(["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "brown", "gray", "black", "white", "unknown"]);
    return allowed.has(key) ? key : "unknown";
  }

  function colorFamilyFromHue(hue, saturation, lightness) {
    const s = normalizeUnitNumber(saturation, 0) || 0;
    const l = normalizeUnitNumber(lightness, 0) || 0;
    if (l >= 0.9) {
      return "white";
    }
    if (l <= 0.12) {
      return "black";
    }
    if (s <= 0.12) {
      return "gray";
    }
    const h = normalizeUnitDegrees(hue);
    if (h < 15 || h >= 345) return "red";
    if (h < 45) return "orange";
    if (h < 70) return "yellow";
    if (h < 160) return "green";
    if (h < 200) return "cyan";
    if (h < 255) return "blue";
    if (h < 290) return "purple";
    if (h < 330) return "pink";
    return "red";
  }

  function inferImageCategory({ width, height, styleTags, palette, detector, detectionArea }) {
    const tags = normalizeStyleTags(styleTags);
    const swatches = normalizePalette(palette);
    const w = normalizePositiveInteger(width, 1);
    const h = normalizePositiveInteger(height, 1);
    const ratio = w / Math.max(1, h);
    const area = normalizeUnitNumber(detectionArea, 0) || 0;
    const detectorText = normalizeMetadataText(detector, "", 80).toLowerCase();
    if (ratio > 2.4 || ratio < 0.42) {
      return "table";
    }
    if (area > 0 && area < 0.05 && ratio > 0.7 && ratio < 1.4) {
      return "equation";
    }
    if (tags.includes("muted") && ratio > 1.15) {
      return "chart";
    }
    if (tags.includes("colorful") && (tags.includes("cool") || tags.includes("warm")) && ratio > 0.85 && ratio < 1.35) {
      return "photo";
    }
    if (swatches.length >= 3 && tags.includes("moderate-saturation")) {
      return "diagram";
    }
    if (detectorText.includes("pdfjs") && area >= 0.08) {
      return "figure";
    }
    if (ratio > 1.3) {
      return "chart";
    }
    return "figure";
  }

  function extractPaletteFromCanvas(canvas, maxSwatches = 6) {
    const context = canvas?.getContext?.("2d");
    if (!context || typeof context.getImageData !== "function") {
      return [];
    }
    let imageData = null;
    try {
      imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_error) {
      return [];
    }
    const data = imageData?.data;
    if (!data?.length) {
      return [];
    }
    const buckets = new Map();
    const pixelCount = Math.max(1, Math.floor(data.length / 4));
    const step = Math.max(1, Math.floor(pixelCount / 4096));
    let sampled = 0;
    for (let pixel = 0; pixel < pixelCount; pixel += step) {
      const offset = pixel * 4;
      const alpha = data[offset + 3];
      if (alpha < 32) {
        continue;
      }
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
      sampled += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, maxSwatches)
      .map((bucket, index) => {
        const r = Math.round(bucket.r / bucket.count);
        const g = Math.round(bucket.g / bucket.count);
        const b = Math.round(bucket.b / bucket.count);
        const hsl = rgbToHSL(r, g, b);
        return {
          hex: rgbToHex(r, g, b),
          role: index === 0 ? "dominant" : `accent-${index}`,
          hue: hsl.h,
          saturation: hsl.s,
          lightness: hsl.l,
          population: round6(bucket.count / Math.max(1, sampled)),
        };
      });
  }

  function normalizePalette(palette) {
    const values = Array.isArray(palette) ? palette : [];
    return values.slice(0, 12).map((swatch, index) => ({
      hex: normalizeHexColor(swatch?.hex) || "#000000",
      role: normalizeMetadataText(swatch?.role, index === 0 ? "dominant" : `accent-${index}`, 40),
      hue: normalizeUnitDegrees(swatch?.hue),
      saturation: normalizeUnitNumber(swatch?.saturation, 0),
      lightness: normalizeUnitNumber(swatch?.lightness, 0),
      population: normalizeUnitNumber(swatch?.population, 0),
    })).filter((swatch) => swatch.hex);
  }

  function deriveStyleTagsFromPalette(palette) {
    const swatches = normalizePalette(palette);
    if (!swatches.length) {
      return [];
    }
    const avgSaturation = swatches.reduce((sum, swatch) => sum + swatch.saturation, 0) / swatches.length;
    const avgLightness = swatches.reduce((sum, swatch) => sum + swatch.lightness, 0) / swatches.length;
    const dominantHue = swatches[0].hue;
    const tags = [];
    tags.push(avgLightness > 0.7 ? "bright" : avgLightness < 0.35 ? "dark" : "balanced");
    tags.push(avgSaturation > 0.55 ? "colorful" : avgSaturation < 0.18 ? "muted" : "moderate-saturation");
    if (dominantHue >= 20 && dominantHue <= 80) {
      tags.push("warm");
    } else if (dominantHue >= 160 && dominantHue <= 280) {
      tags.push("cool");
    }
    return tags;
  }

  function normalizeStyleTags(tags) {
    const values = Array.isArray(tags) ? tags : String(tags || "").split(/[|,]/);
    const normalized = [];
    for (const tag of values) {
      const textValue = normalizeMetadataText(tag, null, 40);
      if (textValue && !normalized.includes(textValue)) {
        normalized.push(textValue);
      }
      if (normalized.length >= 12) {
        break;
      }
    }
    return normalized;
  }

  function normalizeHexColor(value) {
    const textValue = normalizeMetadataText(value, null, 16);
    return textValue && /^#[0-9a-f]{6}$/i.test(textValue) ? textValue.toLowerCase() : null;
  }

  function normalizeUnitDegrees(value) {
    const number = Number(value);
    return Number.isFinite(number) ? round6(((number % 360) + 360) % 360) : 0;
  }

  function rgbToHex(r, g, b) {
    const toHex = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function rgbToHSL(r, g, b) {
    const nr = (Number(r) || 0) / 255;
    const ng = (Number(g) || 0) / 255;
    const nb = (Number(b) || 0) / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const lightness = (max + min) / 2;
    if (max === min) {
      return { h: 0, s: 0, l: round6(lightness) };
    }
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue = 0;
    if (max === nr) {
      hue = ((ng - nb) / delta) + (ng < nb ? 6 : 0);
    } else if (max === ng) {
      hue = ((nb - nr) / delta) + 2;
    } else {
      hue = ((nr - ng) / delta) + 4;
    }
    return {
      h: round6(hue * 60),
      s: round6(saturation),
      l: round6(lightness),
    };
  }

  function getQualityLabelWithEstimate(qualityKey) {
    const normalizedQualityKey = normalizeQualityKey(qualityKey);
    const quality = QUALITY[normalizedQualityKey];
    return `${getQualityMark(normalizedQualityKey)} ${quality.label}; ${formatQualityEstimateShort(normalizedQualityKey)}`;
  }

  function formatQualityEstimateShort(qualityKey) {
    const estimate = QUALITY[normalizeQualityKey(qualityKey)].estimate;
    return String(estimate || "").replace(/\/image$/i, "");
  }

  function getQualityMark(qualityKey) {
    const key = normalizeQualityKey(qualityKey);
    if (key === "low") {
      return "L";
    }
    if (key === "high") {
      return "H";
    }
    return "M";
  }

  function formatPreviewDetectorLabel(detector) {
    const text = normalizeMetadataText(detector, "unknown", 80);
    if (!text || text === "unknown") {
      return "unknown";
    }
    if (text === "manual_selection" || text === "manual") {
      return "manual";
    }
    if (text === "pdfjs_record_images" || text === "pdfjs" || text === "auto") {
      return "auto";
    }
    return text.replace(/_/g, " ");
  }

  function formatPreviewScopeLabel(scope) {
    const text = normalizeScope(scope);
    if (text === "auto-page") {
      return "auto";
    }
    if (text === "document") {
      return "doc";
    }
    return text;
  }

  function formatPageToastToken(pageIndex) {
    return `p${normalizePageIndex(pageIndex, 0) + 1}`;
  }

  function formatOriginalScopeToken(scope, pageIndex = null) {
    if (normalizeOriginalScope(scope) === "document") {
      return "doc";
    }
    if (pageIndex === null || pageIndex === undefined) {
      return "page";
    }
    return formatPageToastToken(pageIndex);
  }

  function buildToolbarActionTooltip(action, qualityKey) {
    const actionText = normalizeMetadataText(action, "Save preview", 90);
    return `${actionText}; ${getQualityLabelWithEstimate(qualityKey)}`;
  }

  function normalizePreviewText(value, fallback, maxLength = 120) {
    let text = "";
    if (typeof value === "string") {
      text = value.trim();
    } else if (typeof value === "number" && Number.isFinite(value)) {
      text = String(value);
    }
    if (!text) {
      return fallback === null ? null : String(fallback).slice(0, maxLength);
    }
    return text.slice(0, maxLength);
  }

  function normalizePositiveInteger(value, fallback = null) {
    const number = toFiniteNumber(value);
    if (number === null || number < 1) {
      return fallback;
    }
    return Math.floor(number);
  }

  function normalizeNonNegativeNumber(value, fallback = 0) {
    const number = toFiniteNumber(value);
    if (number === null || number < 0) {
      return fallback;
    }
    return number;
  }

  function normalizeNonNegativeInteger(value, fallback = 0) {
    return Math.floor(normalizeNonNegativeNumber(value, fallback));
  }

  function normalizeUnitNumber(value, fallback = null) {
    const number = toFiniteNumber(value);
    if (number === null || number < 0 || number > 1) {
      return fallback;
    }
    return round6(number);
  }

  function normalizeEntryPageTarget(entry) {
    const pageIndex = normalizePageIndex(entry?.pageIndex, null);
    if (pageIndex !== null) {
      return {
        pageIndex,
        pageNumber: pageIndex + 1,
      };
    }
    const pageNumber = normalizePageNumber(entry?.pageNumber, 1);
    return {
      pageIndex: pageNumber - 1,
      pageNumber,
    };
  }

  function normalizePageIndex(value, fallback = 0) {
    const number = toFiniteNumber(value);
    if (number === null || number < 0) {
      return fallback;
    }
    return Math.floor(number);
  }

  function normalizePageNumber(value, fallback = 1) {
    const number = toFiniteNumber(value);
    if (number === null || number < 1) {
      return fallback;
    }
    return Math.floor(number);
  }

  function toFiniteNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string") {
      return null;
    }
    const text = value.trim();
    if (!text) {
      return null;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function normalizePreviewDataURL(value) {
    const text = String(value || "").trim();
    const match = text.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (match?.[1]?.length % 4 === 0) {
      return text;
    }
    throw new Error("Preview data URL bad.");
  }

  function getAutoMaxPreviewBytes() {
    const megabytes = clamp(getNumberPref("autoMaxPreviewBytesMB", DEFAULT_AUTO_MAX_PREVIEW_BYTES_MB), 0.5, HARD_MAX_AUTO_PREVIEW_BYTES_MB);
    return Math.round(megabytes * 1024 * 1024);
  }

  function getMaxIndexBytes() {
    const megabytes = clamp(getNumberPref("maxIndexBytesMB", DEFAULT_MAX_INDEX_BYTES_MB), 1, HARD_MAX_INDEX_BYTES_MB);
    return Math.round(megabytes * 1024 * 1024);
  }

  function getHelperMaxImages(scope) {
    const isDocument = scope === "document";
    const key = isDocument ? "maxDocumentImages" : "maxPageImages";
    const fallback = isDocument ? DEFAULT_MAX_DOCUMENT_IMAGES : DEFAULT_MAX_PAGE_IMAGES;
    const hardMax = isDocument ? HARD_MAX_DOCUMENT_IMAGES : HARD_MAX_PAGE_IMAGES;
    return clampInteger(getIntegerPref(key, fallback), 1, hardMax);
  }

  function getHelperTimeoutSeconds() {
    return clampInteger(
      getIntegerPref("helperTimeoutSeconds", DEFAULT_HELPER_TIMEOUT_SECONDS),
      5,
      HARD_MAX_HELPER_TIMEOUT_SECONDS,
    );
  }

  function getPreviewDuplicateKey(attachment, preview) {
    const libraryID = normalizeMetadataText(attachment?.libraryID, "library", 40);
    const itemKey = normalizeItemKey(attachment?.key, "UNKNOWN");
    const pageIndex = normalizePageIndex(preview?.pageIndex, 0);
    const quality = normalizeQualityKey(preview?.quality);
    const bbox = normalizeBBoxNormalized(preview?.bboxNormalized)
      .map((value) => value.toFixed(4))
      .join(",");
    return `${libraryID}:${itemKey}:${pageIndex}:${quality}:${bbox}`;
  }

  function getPreviewIndexKey(attachment, entries, scope, qualityKey) {
    const normalizedScope = normalizeScope(scope);
    const normalizedQuality = normalizeQualityKey(qualityKey);
    const entryKeys = (Array.isArray(entries) ? entries : [])
      .map((entry) => getPreviewDuplicateKey(attachment, entry))
      .sort();
    return `preview-index:v1:${normalizedScope}:${normalizedQuality}:n${entryKeys.length}:${hashTextToken(entryKeys.join("|"))}`;
  }

  function normalizePreviewIndexKey(value) {
    return normalizeMetadataText(value, null, 1000);
  }

  function getPreviewIndexFingerprint(indexKey) {
    const text = normalizePreviewIndexKey(indexKey);
    if (!text) {
      return null;
    }
    return hashTextToken(text);
  }

  function hashTextToken(text) {
    let hash = 2166136261;
    const normalizedText = String(text || "");
    for (let index = 0; index < normalizedText.length; index += 1) {
      hash ^= normalizedText.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `h${(hash >>> 0).toString(36).padStart(7, "0")}`;
  }

  async function isDuplicatePreviewIndexSave({ parentItem, indexKey, memoryKeys = [], sourceRegionKeys = [] }) {
    return !!(await classifyPreviewDuplicateSkipReason({
      parentItem,
      indexKey,
      memoryKeys,
      sourceRegionKeys,
    }));
  }

  async function classifyPreviewDuplicateSkipReason({ parentItem, indexKey, memoryKeys = [], sourceRegionKeys = [] }) {
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    if (!normalizedIndexKey) {
      return null;
    }
    if (recentIndexSaves.has(normalizedIndexKey)) {
      return "session";
    }
    for (const memoryKey of Array.isArray(memoryKeys) ? memoryKeys : []) {
      if (recentIndexSaves.has(memoryKey)) {
        return "session";
      }
    }
    for (const sourceRegionKey of normalizeSourceRegionKeys(sourceRegionKeys)) {
      if (recentIndexSaves.has(sourceRegionKey)) {
        return "session";
      }
    }
    if (await hasExistingPreviewIndexAttachment(parentItem, normalizedIndexKey, memoryKeys, sourceRegionKeys)) {
      return "saved";
    }
    return null;
  }

  function rememberPreviewIndexSave(attachment, entries, indexKey) {
    const now = Date.now();
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    if (normalizedIndexKey) {
      recentIndexSaves.set(normalizedIndexKey, now);
    }
    for (const entry of Array.isArray(entries) ? entries : []) {
      recentIndexSaves.set(getPreviewDuplicateKey(attachment, entry), now);
      recentIndexSaves.set(getSourceRegionKey(attachment, entry), now);
    }
    pruneRecentIndexSaves();
  }

  async function hasExistingPreviewIndexAttachment(parentItem, indexKey, memoryKeys = [], sourceRegionKeys = []) {
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    if (!parentItem || !normalizedIndexKey || typeof parentItem.getAttachments !== "function") {
      return false;
    }
    const identities = await getExistingPreviewIndexIdentities(parentItem);
    if (identities.indexKeys.has(normalizedIndexKey)) {
      return true;
    }
    for (const memoryKey of normalizePreviewDuplicateKeys(memoryKeys)) {
      if (identities.entryKeys.has(memoryKey)) {
        return true;
      }
    }
    for (const sourceRegionKey of normalizeSourceRegionKeys(sourceRegionKeys)) {
      if (identities.sourceRegionKeys.has(sourceRegionKey)) {
        return true;
      }
    }
    return false;
  }

  function createEmptyPreviewIndexIdentities() {
    return {
      indexKeys: new Set(),
      entryKeys: new Set(),
      sourceRegionKeys: new Set(),
    };
  }

  async function getExistingPreviewIndexIdentities(parentItem) {
    const identities = createEmptyPreviewIndexIdentities();
    if (!parentItem || typeof parentItem.getAttachments !== "function") {
      return identities;
    }
    let childIDs = [];
    try {
      childIDs = parentItem.getAttachments() || [];
    } catch (error) {
      try {
        logError(error);
      } catch (_logError) {
        // Scanner failures must not block saving.
      }
      return identities;
    }
    for (const childID of Array.isArray(childIDs) ? childIDs : []) {
      let child = null;
      try {
        child = Zotero.Items.get(childID);
      } catch (error) {
        logError(error);
      }
      if (!child || !isPreviewIndexAttachmentCandidate(child)) {
        continue;
      }
      const metadata = await readPreviewIndexMetadataFromAttachment(child);
      if (!metadata) {
        continue;
      }
      const childIndexKey = normalizePreviewIndexKey(metadata.preview_index_key);
      if (childIndexKey) {
        identities.indexKeys.add(childIndexKey);
      }
      for (const entryKey of getPreviewDuplicateKeysFromMetadata(metadata)) {
        identities.entryKeys.add(entryKey);
      }
      for (const sourceRegionKey of getSourceRegionKeysFromMetadata(metadata)) {
        identities.sourceRegionKeys.add(sourceRegionKey);
      }
    }
    return identities;
  }

  function isPreviewIndexAttachmentCandidate(item) {
    return isHTMLAttachment(item) || isLegacyPreviewIndexTitleCandidate(item);
  }

  function isHTMLAttachment(item) {
    const contentType = normalizeMetadataText(item?.attachmentContentType, "", 80).toLowerCase();
    return contentType === "text/html";
  }

  function isLegacyPreviewIndexTitleCandidate(item) {
    const title = normalizeMetadataText(getItemField(item, "title"), "", 240);
    return title.includes("image index") || title.includes("img index");
  }

  async function readPreviewIndexMetadataFromAttachment(item) {
    const directKey = normalizePreviewIndexKey(item?.previewIndexKey);
    if (directKey) {
      return { preview_index_key: directKey, entries: [] };
    }
    if (typeof item?.getFilePathAsync !== "function" || typeof Zotero.File?.getContentsAsync !== "function") {
      return null;
    }
    try {
      const filePath = await item.getFilePathAsync();
      if (!filePath) {
        return null;
      }
      const contents = await Zotero.File.getContentsAsync(filePath);
      return extractPreviewIndexMetadataFromHTML(contents, {
        allowLegacyFallback: isLegacyPreviewIndexTitleCandidate(item),
      });
    } catch (error) {
      logError(error);
      return null;
    }
  }

  async function readPreviewIndexKeyFromAttachment(item) {
    const metadata = await readPreviewIndexMetadataFromAttachment(item);
    return normalizePreviewIndexKey(metadata?.preview_index_key);
  }

  function extractPreviewIndexMetadataFromHTML(html, options = {}) {
    const text = String(html || "");
    const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
      try {
        const metadata = JSON.parse(unescapeHTMLEntities(preMatch[1]).trim());
        if (isSavedPreviewIndexMetadata(metadata)) {
          return metadata;
        }
      } catch (_error) {
        // Not every text/html child attachment is a saved preview index.
      }
    }
    if (!options?.allowLegacyFallback) {
      return null;
    }
    const legacyKey = extractPreviewIndexKeyFromHTML(text);
    return legacyKey ? { preview_index_key: legacyKey, entries: [] } : null;
  }

  function isSavedPreviewIndexMetadata(metadata) {
    return !!(
      metadata
      && typeof metadata === "object"
      && !Array.isArray(metadata)
      && metadata.schema_version === HELPER_SCHEMA_VERSION
      && metadata.storage_mode === "reader_preview_index"
      && metadata.plugin?.id === config.id
    );
  }

  function getPreviewDuplicateKeysFromMetadata(metadata) {
    const entries = Array.isArray(metadata?.entries) ? metadata.entries : [];
    return normalizePreviewDuplicateKeys(entries.map((entry) => entry?.preview_duplicate_key));
  }

  function getSourceRegionKeysFromMetadata(metadata) {
    const entries = Array.isArray(metadata?.entries) ? metadata.entries : [];
    return normalizeSourceRegionKeys(entries.map((entry) => entry?.source_region_key));
  }

  function normalizeSourceRegionKeys(values) {
    const keys = [];
    for (const value of Array.isArray(values) ? values : []) {
      const key = normalizeSourceRegionKey(value);
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  }

  function normalizeSourceRegionKey(value) {
    return normalizeMetadataText(value, null, 1000);
  }

  function normalizePreviewDuplicateKeys(values) {
    const keys = [];
    for (const value of Array.isArray(values) ? values : []) {
      const key = normalizePreviewDuplicateKey(value);
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  }

  function normalizePreviewDuplicateKey(value) {
    return normalizeMetadataText(value, null, 1000);
  }

  function extractPreviewIndexKeyFromHTML(html) {
    const text = String(html || "");
    const escapedMatch = text.match(/&quot;preview_index_key&quot;\s*:\s*&quot;([^&]+)&quot;/);
    if (escapedMatch) {
      return normalizePreviewIndexKey(unescapeHTMLEntities(escapedMatch[1]));
    }
    const rawMatch = text.match(/"preview_index_key"\s*:\s*"([^"]+)"/);
    return rawMatch ? normalizePreviewIndexKey(rawMatch[1]) : null;
  }

  function unescapeHTMLEntities(value) {
    return String(value || "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'");
  }

  function pruneRecentIndexSaves() {
    if (recentIndexSaves.size <= 200) {
      return;
    }
    const oldest = [...recentIndexSaves.entries()]
      .sort((left, right) => left[1] - right[1])
      .slice(0, recentIndexSaves.size - 160);
    for (const [key] of oldest) {
      recentIndexSaves.delete(key);
    }
  }

  function normalizedRect(a, b) {
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const right = Math.max(a.x, b.x);
    const bottom = Math.max(a.y, b.y);
    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  function intersectRects(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function clipSelectionRect(rect, pageRect) {
    const left = clamp(rect.left, 0, pageRect.width);
    const top = clamp(rect.top, 0, pageRect.height);
    const right = clamp(rect.left + rect.width, 0, pageRect.width);
    const bottom = clamp(rect.top + rect.height, 0, pageRect.height);
    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function dedupeImageCandidates(candidates) {
    const kept = [];
    for (const candidate of candidates.sort((left, right) => right.area - left.area)) {
      if (kept.some((existing) => rectIntersectionRatio(candidate.selectionRect, existing.selectionRect) > 0.9)) {
        continue;
      }
      kept.push(candidate);
    }
    return kept;
  }

  function rectIntersectionRatio(a, b) {
    const intersection = intersectRects(rectToBox(a), rectToBox(b));
    const smallerArea = Math.min(a.width * a.height, b.width * b.height);
    return smallerArea > 0 ? (intersection.width * intersection.height) / smallerArea : 0;
  }

  function rectToBox(rect) {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    };
  }

  function estimateDataURLBytes(dataURL) {
    const base64 = String(dataURL).split(",")[1] || "";
    const padding = base64.match(/=+$/)?.[0].length || 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  }

  function estimateUTF8Bytes(value) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(String(value)).length;
    }
    return unescape(encodeURIComponent(String(value))).length;
  }

  function formatBytes(bytes) {
    const value = normalizeNonNegativeNumber(bytes, 0);
    if (value < 1024) {
      return `${Math.round(value)} B`;
    }
    if (value < 1024 * 1024) {
      return `${Math.round(value / 102.4) / 10} KB`;
    }
    return `${Math.round(value / 104857.6) / 10} MB`;
  }

  function formatPreviewDimensions(width, height) {
    if (width === null || height === null) {
      return "size n/a";
    }
    return `${width}x${height}`;
  }

  function round6(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clampInteger(value, min, max) {
    return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
  }

  function clampNormalized(value, fallback) {
    const number = Number(value);
    return clamp(Number.isFinite(number) ? number : fallback, 0, 1);
  }

  function formatPercent(value) {
    return `${(clampNormalized(value, 0) * 100).toFixed(1)}%`;
  }

  function formatCSSPercent(value) {
    return `${(clampNormalized(value, 0) * 100).toFixed(4)}%`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function formatCommand(command) {
    return [command.command, ...command.args].filter(Boolean).join(" ");
  }

  function log(message, data) {
    Zotero.debug(`PDF Image Saver: ${message}${data ? ` ${JSON.stringify(data)}` : ""}`);
  }

  function logError(error) {
    Zotero.logError(error);
    log(getErrorMessage(error));
  }

  function getErrorMessage(error) {
    if (error && typeof error.message === "string") {
      return normalizeErrorMessageText(error.message);
    }
    if (typeof error === "string" || (typeof error === "number" && Number.isFinite(error))) {
      return normalizeErrorMessageText(error);
    }
    return "Unknown err.";
  }

  function normalizeErrorMessageText(value) {
    const text = normalizeMetadataText(value, null, 320);
    if (!text || text === "undefined" || text === "null" || text === "[object Object]") {
      return "Unknown err.";
    }
    return text;
  }

  function classifyErrorCategory(message) {
    const text = String(message || "").toLowerCase();
    if (!text) {
      return "unknown";
    }
    if (
      text.includes("byte cap")
      || text.includes("too large")
      || text.includes("preview cap")
      || text.includes("byte safety cap")
      || (text.includes("exceeded the") && text.includes("byte"))
    ) {
      return "byte_cap";
    }
    if (
      text.includes("duplicate")
      || text.includes("already saved")
      || text.includes("already in this session")
      || text.includes("already in a synced")
      || text.includes("session dup")
      || text.includes("saved-index dup")
      || text.includes("saved dup")
      || text.includes("saved/session dups")
      || text.includes("saved dups")
      || text.includes("session dups")
      || ((text.includes("skip:") || text.includes("skipped:")) && (text.includes("session") || text.includes("saved") || text.includes("dup")))
    ) {
      return "duplicate";
    }
    if (
      text.includes("helper failed")
      || text.includes("helper unavailable")
      || text.includes("helper:")
      || text.includes("pymupdf")
      || text.includes("python helper")
      || text.includes("optional helper")
      || text.includes("bundled helper")
    ) {
      return "helper";
    }
    if (
      text.includes("storage failed")
      || text.includes("zotero original image import")
      || text.includes("import preview index")
      || text.includes("preview index import")
      || text.includes("index import failed")
      || text.includes("original imports failed")
      || text.includes("orig imports failed")
      || text.includes("attachments.importfromfile")
      || text.includes("could not import")
    ) {
      return "storage";
    }
    if (
      text.includes("capture failed")
      || text.includes("canvas")
      || text.includes("selection")
      || text.includes("page geometry")
      || text.includes("pdf attachment")
      || text.includes("active zotero pdf reader")
      || text.includes("active pdf reader")
      || text.includes("page canvas missing")
      || text.includes("canvas missing")
      || text.includes("selection outside")
      || text.includes("reader item is not a pdf")
      || text.includes("not a pdf")
    ) {
      return "capture";
    }
    return "unknown";
  }

  function formatUserFacingError(error) {
    const message = getErrorMessage(error);
    const category = classifyErrorCategory(message);
    if (category === "byte_cap") {
      return message.startsWith("Byte cap:") ? message : `Byte cap: ${message}`;
    }
    if (category === "helper") {
      return message.startsWith("Helper ") || message.startsWith("Helper:") ? message : `Helper failed: ${message}`;
    }
    if (category === "storage") {
      return message.startsWith("Storage failed:") ? message : `Storage failed: ${message}`;
    }
    if (category === "duplicate") {
      return message.startsWith("Duplicate:") ? message : `Duplicate: ${message}`;
    }
    if (category === "capture") {
      return message.startsWith("Capture failed:") ? message : `Capture failed: ${message}`;
    }
    return message === "Unknown err." ? "Unknown err." : message;
  }

  return {
    init,
    startup,
    shutdown,
    addToWindow,
    removeFromWindow,
    __test__: {
      buildIndexHTML,
      buildIndexTitle,
      buildOriginalImageIndexHTML,
      buildOriginalImageIndexTitle,
      buildOriginalImageTitle,
      buildOpenPDFURI,
      buildSourceRegion,
      calculateCanvasCrop,
      cleanupSelectionOverlay,
      installSelectionOverlay,
      startClipFromReader,
      confirmAndSaveOriginalImagesFromReader,
      filterExistingOriginalImagesForImport,
      formatDiagnosticDups,
      formatDiagnosticArea,
      formatDiagnosticsReport,
      formatHelperPythonMode,
      formatOptionalHelperStatus,
      formatAutoDuplicateSkipReason,
      formatAutoNoCandidatesReason,
      formatPreviewDuplicateSkipReason,
      classifyPreviewDuplicateSkipReason,
      buildOriginalImportSkippedText,
      formatHelperFailure,
      getToastDuration,
      getErrorMessage,
      classifyErrorCategory,
      formatUserFacingError,
      normalizeToastLevel,
      getActiveReader,
      getContextPageIndex,
      getPDFViewerContextCandidate,
      applyAutoRasterButtonState,
      buildContextMenuActions,
      buildToolbarActionTooltip,
      formatPreviewDetectorLabel,
      formatPreviewScopeLabel,
      formatQualityEstimateShort,
      getQualityMark,
      formatPageToastToken,
      formatOriginalScopeToken,
      imageCoordinatesToCandidates,
      getPreviewDuplicateKey,
      getPreviewIndexFingerprint,
      getPreviewIndexKey,
      getOriginalImageKey,
      getSourceRegionFingerprint,
      getSourceRegionKey,
      hasExistingPreviewIndexAttachment,
      importOriginalImages,
      isDuplicatePreviewIndexSave,
      limitOriginalImagesForImport,
      onRenderToolbar,
      onCreateViewContextMenu,
      rememberPreviewIndexSave,
      normalizeHelperSchemaText,
      normalizeHelperStatusText,
      normalizeHelperWarningMessages,
      normalizeBBoxNormalized,
      normalizeHelperFilePath,
      normalizeImageContentType,
      normalizeOriginalImageForImport,
      normalizePageIndex,
      normalizePageNumber,
      prepareSelectionOverlayHost,
      getReaderJobKey,
      renderCanvasPreview,
      extractPaletteFromCanvas,
      deriveStyleTagsFromPalette,
      normalizePalette,
      normalizeStyleTags,
      normalizeImageCategoryKey,
      getImageCategoryLabel,
      getImageCategoryMark,
      inferImageCategory,
      formatCategorySummary,
      formatColorFamilySummary,
      formatColorFamilyLabel,
      formatLayoutHintSummary,
      formatLayoutHintLabel,
      formatAspectRatioLabel,
      formatSlideSlotSummary,
      formatSlideSlotLabel,
      formatRoleHintSummary,
      formatRoleHintLabel,
      formatInsertHintSummary,
      formatInsertHintLabel,
      formatCaptionHintSummary,
      formatCaptionHintLabel,
      formatStoryHintSummary,
      formatStoryHintLabel,
      formatContrastPairLabel,
      formatPptAssistSummary,
      buildPptAssistToken,
      buildRolePackToken,
      buildInsertPackToken,
      buildCaptionPackToken,
      buildStoryPackToken,
      buildIndexStoryboardToken,
      buildIndexPptAssistToken,
      buildIndexPptAssistSummary,
      deriveBoardLayout,
      buildTagChipsHTML,
      buildTagFilterBarHTML,
      buildDrawingStyleTags,
      deriveColorFamilyFromPalette,
      deriveAspectRatio,
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
      normalizeStoryOrder,
      getLayoutHintMark,
      getSlideSlotMark,
      getRoleHintMark,
      getInsertSizeMark,
      getCaptionToneMark,
      getStoryBeatMark,
      getColorFamilyMark,
      formatStyleTagsLabel,
      formatPaletteLabel,
      saveAutoDetectedPageImagePreviews,
      saveClipPreviewIndex,
      saveOriginalImagesFromReader,
      savePagePreviewIndex,
      showReaderToast,
      isPDFReader,
      normalizeAnnotationKey,
    },
    get started() {
      return started;
    },
  };
})();
