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
    menuitem.setAttribute("label", "PDF Img: Clip");
    menuitem.setAttribute("tooltiptext", "Clip current page to HTML index");
    menuitem.addEventListener("command", () => {
      void startClipFromActiveReader(win, getDefaultQualityKey());
    });
    const diagnosticsItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    diagnosticsItem.id = "pdf-image-saver-diagnostics-menuitem";
    diagnosticsItem.setAttribute("label", "PDF Img: Diag");
    diagnosticsItem.setAttribute("tooltiptext", "Runtime status, open-PDF, helper, temp");
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
    select.setAttribute?.("aria-label", "Preview quality");
    select.title = "Q; approx sync size";
    for (const key of Object.keys(QUALITY)) {
      const option = doc.createElement("option");
      option.value = key;
      option.textContent = `${QUALITY[key].label}; ${formatQualityEstimateShort(key)}`;
      option.selected = key === getDefaultQualityKey();
      select.appendChild(option);
    }

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "pdf-image-saver-toolbar-button";
    button.textContent = "Clip";
    button.setAttribute?.("aria-label", "Clip figure preview");
    const autoButton = doc.createElement("button");
    autoButton.type = "button";
    autoButton.className = "pdf-image-saver-toolbar-button";
    autoButton.textContent = "Auto";
    autoButton.setAttribute?.("aria-label", "Auto raster previews");

    let toolbarMode = "idle";
    let autoRasterAvailable = false;
    const refreshAutoButtonState = (qualityKey = normalizeQualityKey(select.value)) => {
      const normalizedQualityKey = normalizeQualityKey(qualityKey);
      if (toolbarMode !== "idle") {
        if (toolbarMode === "clip") {
          autoButton.title = "Auto locked while clipping";
        } else if (toolbarMode === "auto") {
          autoButton.title = "Auto detection running";
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
      if (toolbarMode === "clip") {
        button.disabled = true;
        button.textContent = "Drag...";
        button.setAttribute?.("aria-label", "Clip selection active; drag on page");
        button.title = "Clip selection active; drag on page";
        autoButton.disabled = true;
        autoButton.textContent = "Auto";
        autoButton.setAttribute?.("aria-label", "Auto locked while clipping");
        refreshAutoButtonState();
        return;
      }
      if (toolbarMode === "auto") {
        button.disabled = true;
        button.textContent = "Clip";
        button.setAttribute?.("aria-label", "Clip locked while auto runs");
        button.title = "Clip locked while auto runs";
        autoButton.disabled = true;
        autoButton.textContent = "Auto...";
        autoButton.setAttribute?.("aria-label", "Auto detection running");
        refreshAutoButtonState();
        return;
      }
      button.disabled = false;
      button.textContent = "Clip";
      button.setAttribute?.("aria-label", "Clip figure preview");
      autoButton.textContent = "Auto";
      autoButton.setAttribute?.("aria-label", "Auto raster previews");
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
      })).finally(() => {
        setToolbarMode("idle");
        void syncAutoRasterAvailability(normalizeQualityKey(select.value));
      });
    });
    const updateQualityTooltips = () => {
      const qualityKey = normalizeQualityKey(select.value);
      if (toolbarMode !== "idle") {
        return;
      }
      select.title = `Q ${getQualityLabelWithEstimate(qualityKey)}`;
      button.title = buildToolbarActionTooltip("Clip current page to HTML index", qualityKey);
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
    updateQualityTooltips();
    void syncAutoRasterAvailability(normalizeQualityKey(select.value));
    group.append(select, button, autoButton);
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
    const pageOriginalMaxImages = getHelperMaxImages("page");
    const documentOriginalMaxImages = getHelperMaxImages("document");

    for (const key of ["low", "medium", "high"]) {
      actions.push({
        label: `Clip ${QUALITY[key].label}; ${formatQualityEstimateShort(key)}`,
        onCommand() {
          void startClip(reader, key, getContextPageIndex(params));
        },
      });
    }

    actions.push({
      label: `Auto ${defaultQuality.label}; ${formatQualityEstimateShort(defaultQualityKey)}`,
      onCommand() {
        void saveAuto(reader, {
          qualityKey: defaultQualityKey,
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Page ${defaultQuality.label}; ${formatQualityEstimateShort(defaultQualityKey)}`,
      onCommand() {
        void savePage(reader, {
          qualityKey: defaultQualityKey,
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Originals page; max ${pageOriginalMaxImages}`,
      onCommand() {
        void saveOriginal(reader, {
          scope: "page",
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    actions.push({
      label: `Originals doc; max ${documentOriginalMaxImages}`,
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
      Services.prompt.alert(win, "PDF Img", "Capture failed: no active PDF reader.");
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
      max_index: formatBytes(getMaxIndexBytes()),
      auto_cap: formatBytes(getAutoMaxPreviewBytes()),
      warnings: [],
    };

    try {
      const tempStats = await getTempDirectoryStats(report.temp_dir);
      report.temp_leftovers = tempStats.count;
      report.temp_bytes = tempStats.bytes;
    } catch (error) {
      report.warnings.push(`Temp check failed: ${getErrorMessage(error)}`);
    }

    if (!reader || !isPDFReader(reader)) {
      report.warnings.push("No active PDF reader.");
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
      report.warnings.push(`Helper probe failed: ${getErrorMessage(error)}`);
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
      `Plugin ${normalizeDiagnosticText(safeReport.plugin, "unknown", 120)}; Zotero ${normalizeDiagnosticText(safeReport.zotero, "unknown", 80)}`,
      `On ${formatDiagnosticBoolean(safeReport.started)}; readers ${normalizeNonNegativeInteger(safeReport.reader_count, 0)}; PDF ${formatDiagnosticBoolean(safeReport.active_pdf_reader)}`,
      `Q ${normalizeQualityKey(safeReport.default_quality)}; auto ${normalizeDiagnosticText(safeReport.auto_cap, "unknown", 80)}; index ${normalizeDiagnosticText(safeReport.max_index, "unknown", 80)}`,
      `Helper ${formatOptionalHelperStatus(safeReport.optional_helper)}; orig optional`,
      `Temp ${normalizeNonNegativeInteger(safeReport.temp_leftovers, 0)} (${formatBytes(safeReport.temp_bytes)}); ${normalizeDiagnosticText(safeReport.temp_dir, "unknown", 160)}`,
    ];
    if (safeReport.pdf_attachment) {
      lines.push(
        `PDF ${normalizeItemKey(pdfAttachment.key, "UNKNOWN")}; lib ${normalizeDiagnosticText(safeReport.library_prefix, "library", 80)}; parent ${normalizeDiagnosticText(pdfAttachment.parent_id, "none", 80)}`,
        `Page ${pageNumber}${pageLabel ? ` (${pageLabel})` : ""}; auto ${formatDiagnosticBoolean(safeReport.auto_raster_available)}`,
        `Open ${normalizeDiagnosticText(safeReport.open_pdf_uri, "unavailable", 240)}`,
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
    return value === true ? "true" : value === false ? "false" : "unknown";
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

  async function startClipFromReader(reader, qualityKey, explicitPageIndex, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const onSessionEnd = typeof safeOptions.onSessionEnd === "function" ? safeOptions.onSessionEnd : null;
    try {
      const pageIndex = await getCurrentPageIndex(reader, explicitPageIndex);
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: page canvas missing.");
      }
      showReaderToast(reader, `Drag ${formatPageToastToken(pageIndex)}; Esc cancels.`, "info");
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
    const dragHint = `Drag ${pageToken}; Esc cancels`;
    overlay.setAttribute?.("aria-label", `Clip ${pageToken}. ${dragHint}.`);
    overlay.title = dragHint;
    overlay.__pdfImageSaverOnSessionEnd = onSessionEnd;
    prepareSelectionOverlayHost(pageElement, overlay);
    const hint = doc.createElement("div");
    hint.className = "pdf-image-saver-selection-hint";
    hint.textContent = dragHint;
    const selection = doc.createElement("div");
    selection.className = "pdf-image-saver-selection-box";
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
        endSession();
        showReaderToast(reader, `Clip cancelled ${formatPageToastToken(pageIndex)}.`, "warning");
      }
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
        showReaderToast(reader, `Selection too small ${formatPageToastToken(pageIndex)}.`, "warning");
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
      sizeBadge.textContent = `${width} x ${height}`;
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
        showReaderToast(reader, `Clip already running ${formatPageToastToken(pageIndex)}.`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Saving clip ${formatPageToastToken(pageIndex)}...`, "progress");
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const preview = renderCanvasPreview({ ...safeOptions, pageIndex, qualityKey });
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
        `Saved clip ${formatPageToastToken(pageIndex)} (${formatQualityEstimateShort(qualityKey)}; ${formatBytes(preview.byteCount)}).`,
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
        showReaderToast(reader, `Auto already running ${formatPageToastToken(pageIndex)}.`, "warning");
        return null;
      }

      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Detecting auto ${formatPageToastToken(pageIndex)}...`, "progress");
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: page canvas missing.");
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

      showReaderToast(reader, `Saving ${previews.length} auto ${formatPageToastToken(pageIndex)}...`, "progress");
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
        notes.push(`${skippedSavedDuplicates} saved-dup`);
      }
      if (skippedSessionDuplicates) {
        notes.push(`${skippedSessionDuplicates} session-dup`);
      }
      if (skippedByteLimit) {
        notes.push("byte-cap");
      }
      if (skippedOversized) {
        notes.push(`${skippedOversized} oversized`);
      }
      showReaderToast(
        reader,
        `Saved ${previews.length} auto ${formatPageToastToken(pageIndex)} (${formatQualityEstimateShort(qualityKey)}; ${formatBytes(totalBytes)}${notes.length ? `; ${notes.join(", ")}` : ""}).`,
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
      ? "item+total byte caps"
      : skippedOversized
        ? "item byte cap"
        : skippedByteLimit
          ? "total byte cap"
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
      return `Auto skip${pageToken}: all saved-index dups.`;
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
    return `Auto skip${pageToken}: ${compact}. Use Clip.`;
  }

  function formatPreviewDuplicateSkipReason(scope, reason, pageIndex = null) {
    const pageToken = pageIndex === null || pageIndex === undefined ? "" : ` ${formatPageToastToken(pageIndex)}`;
    const kind = reason === "session"
      ? "session dup"
      : reason === "saved"
        ? "saved-index dup"
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
        showReaderToast(reader, `Page already running ${formatPageToastToken(pageIndex)}.`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `Saving page ${formatPageToastToken(pageIndex)}...`, "progress");
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: page canvas missing.");
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
      showReaderToast(reader, `Saved page ${formatPageToastToken(pageIndex)} (${formatQualityEstimateShort(qualityKey)}; ${formatBytes(preview.byteCount)}).`, "success");
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
    return {
      id: `preview-p${pageIndex + 1}-${Date.now().toString(36)}`,
      mode: mode || "reader_canvas_preview",
      detector: detector || "manual_selection",
      pageIndex,
      pageNumber: pageIndex + 1,
      pageLabel: pageLabel || null,
      quality: normalizedQualityKey,
      qualityEstimate: quality.estimate,
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
      detectionArea: detectionArea || round6(selectionRect.width * selectionRect.height / Math.max(1, pageRect.width * pageRect.height)),
      openPDFURI: "",
    };
  }

  function calculateCanvasCrop({ selectionRect, pageRect, canvasRect, canvasWidth, canvasHeight }) {
    if (!pageRect?.width || !pageRect?.height || !canvasRect?.width || !canvasRect?.height) {
      throw new Error("Capture failed: page geometry unavailable.");
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
      throw new Error("Capture failed: selection outside canvas.");
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
      button.title = buildToolbarActionTooltip("Auto current-page raster", qualityKey);
      return;
    }
    button.disabled = true;
    button.title = "Auto unavailable. Use Clip.";
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
        throw new Error(`Byte cap: index too large (${formatBytes(htmlBytes)} > ${formatBytes(maxBytes)}). Lower Q or auto count.`);
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
        entry.dataURL = normalizePreviewDataURL(entry.dataURL);
        entry.byteCount = estimateDataURLBytes(entry.dataURL);
        entry.renderedWidth = normalizePositiveInteger(entry.renderedWidth, null);
        entry.renderedHeight = normalizePositiveInteger(entry.renderedHeight, null);
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
        return `
          <article class="entry">
            <div class="preview-column">
              <a class="preview-link" href="${escapeHTML(uri)}" data-source-region-key="${escapeHTML(entry.sourceRegionKey)}">
                <img src="${escapeHTML(entry.dataURL)}" alt="Preview ${index + 1}">
              </a>
              ${buildSourceRegionMapHTML(entry.sourceRegion)}
              <a class="source-action" href="${escapeHTML(uri)}" title="Open source PDF page">Open PDF</a>
            </div>
            <dl class="entry-summary">
              <div><dt>Page</dt><dd><a href="${escapeHTML(uri)}">${escapeHTML(pageText)}</a></dd></div>
              <div><dt>Q</dt><dd>${escapeHTML(QUALITY[entry.quality].label)}; ${escapeHTML(formatQualityEstimateShort(entry.quality))}</dd></div>
              <div><dt>Size</dt><dd>${formatBytes(entry.byteCount)}; ${formatPreviewDimensions(entry.renderedWidth, entry.renderedHeight)}</dd></div>
              <div><dt>ID</dt><dd title="${escapeHTML(entry.sourceRegionKey)}">${escapeHTML(regionIdentity)}</dd></div>
            </dl>
            <details class="entry-details">
              <summary>Trace</summary>
              <dl>
                <div><dt>Det</dt><dd>${escapeHTML(entry.detector)}</dd></div>
                <div><dt>Map</dt><dd>${escapeHTML(sourceRegionLabel)}</dd></div>
                <div><dt>Box</dt><dd>${entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ")}</dd></div>
                <div><dt>Key</dt><dd>${escapeHTML(entry.sourceRegionKey)}</dd></div>
              </dl>
            </details>
          </article>`;
      })
      .join("\n");

    const previewIndexKey = normalizePreviewIndexKey(indexKey) || getPreviewIndexKey(attachment, normalizedEntries, normalizedScope, previewQualityKey);
    const metadata = {
      schema_version: HELPER_SCHEMA_VERSION,
      created_at: createdAt,
      plugin: { id: config.id, version: config.version },
      storage_mode: "reader_preview_index",
      scope: normalizedScope,
      preview_quality: previewQualityKey,
      preview_index_key: previewIndexKey,
      preview_index_fingerprint: getPreviewIndexFingerprint(previewIndexKey),
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
  <title>${escapeHTML(sourceTitle)} - preview index</title>
  <style>
    body { margin: 18px; font: 13px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #555; margin: 0 0 2px; line-height: 1.35; }
    .entry { display: grid; grid-template-columns: minmax(140px, 300px) 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid #ddd; }
    .preview-column { display: grid; gap: 6px; align-content: start; }
    .source-action { display: inline-block; width: fit-content; padding: 3px 8px; border: 1px solid #9ab; border-radius: 4px; color: #0645ad; text-decoration: none; background: #f7faff; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; background: #f6f6f6; }
    .source-map { position: relative; width: 88px; aspect-ratio: 0.72; border: 1px solid #bbb; background: #fafafa; }
    .source-map span { position: absolute; min-width: 2px; min-height: 2px; border: 2px solid #1f73b7; background: rgba(31, 115, 183, 0.18); box-sizing: border-box; }
    dl { margin: 0; display: grid; gap: 4px; align-content: start; }
    dl div { display: grid; grid-template-columns: 48px 1fr; gap: 8px; }
    dt { color: #666; }
    dd { margin: 0; word-break: break-word; }
    .entry-details { grid-column: 2; }
    .entry-details summary { cursor: pointer; color: #444; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 10px; background: #f6f8fa; border: 1px solid #ddd; font-size: 12px; }
    @media (max-width: 720px) { .entry { grid-template-columns: 1fr; } .entry-details { grid-column: 1; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHTML(sourceTitle)}</h1>
    <p class="meta">Saved ${escapeHTML(createdAt)}. HTML index; syncs with PDF.</p>
    <p class="meta">Index ${escapeHTML(getPreviewIndexFingerprint(previewIndexKey) || "unknown")}; ${normalizedEntries.length} img; ${escapeHTML(previewQualityKey)}</p>
  </header>
  ${entriesHTML}
  <details>
    <summary>Meta</summary>
    <pre>${escapeHTML(JSON.stringify(metadata, null, 2))}</pre>
  </details>
</body>
</html>`;
  }

  function normalizePreviewEntries(entries) {
    if (!Array.isArray(entries)) {
      throw new Error("Preview index entries must be an array.");
    }
    if (!entries.length) {
      throw new Error("Preview index must include at least one entry.");
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
      throw new Error(`Storage failed: preview index import failed. ${getErrorMessage(error)}`);
    } finally {
      await removeDirectoryIfExists(PathUtils.parent(indexPath));
    }
  }

  function buildIndexTitle(parentItem, attachment, scope, pageIndex, entries = [], qualityKey = null, indexKey = null) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment)).slice(0, 70);
    const targetPage = normalizePageIndex(pageIndex, null);
    const target = targetPage === null ? normalizeScope(scope) : `p${targetPage + 1}`;
    const entryCount = Array.isArray(entries) ? entries.length : 0;
    const normalizedQuality = qualityKey === null ? null : normalizeQualityKey(qualityKey);
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    const fingerprint = normalizedIndexKey ? getPreviewIndexFingerprint(normalizedIndexKey) : null;
    const suffix = [
      "image index",
      target,
      normalizedQuality,
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
        `Originals ${scopeLabel}? Max ${maxImages}; caps ${formatBytes(ORIGINAL_MAX_IMAGE_BYTES)}/image, ${formatBytes(ORIGINAL_MAX_TOTAL_BYTES)}/run. Clip safer.`,
      );
      if (!ok) {
        const pageIndex = normalizePageIndex(safeOptions.pageIndex, null);
        showReaderToast(reader, `Original cancelled ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
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
        showReaderToast(reader, `Original already running ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
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
      showReaderToast(reader, `Helper running ${formatOriginalScopeToken(scope, pageIndex)}...`, "progress");
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
            : `${helperMessage} Use Clip.`,
          "warning",
        );
        return;
      }
      if (!report.images?.length) {
        await removeDirectoryIfExists(report.output_dir);
        showReaderToast(reader, `No originals ${formatOriginalScopeToken(scope, pageIndex)}.`, "warning");
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
        showReaderToast(reader, `No new orig ${formatOriginalScopeToken(scope, pageIndex)}.${skippedText}`, "warning");
        return;
      }
      showReaderToast(
        reader,
        `Saved ${importResult.count} orig${importResult.count === 1 ? "" : "s"} ${formatOriginalScopeToken(scope, pageIndex)}.${skippedText}`,
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
        throw new Error(`Storage failed: all ${importErrorCount} original imports failed.`);
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
    return `${base} - original p${pageNumber} image ${occurrence} ${key}`.slice(0, 140);
  }

  function buildOriginalImportSkippedText(importResult) {
    const parts = [];
    if (importResult.invalidCount) {
      parts.push(`${importResult.invalidCount} bad record${importResult.invalidCount === 1 ? "" : "s"}`);
    }
    if (importResult.missingCount) {
      parts.push(`${importResult.missingCount} missing file${importResult.missingCount === 1 ? "" : "s"}`);
    }
    if (importResult.errorCount) {
      parts.push(`${importResult.errorCount} unreadable file${importResult.errorCount === 1 ? "" : "s"}`);
    }
    if (importResult.byteCapCount) {
      parts.push(`${importResult.byteCapCount} byte-cap`);
    }
    if (importResult.duplicateCount) {
      parts.push(`${importResult.duplicateCount} dup${importResult.duplicateCount === 1 ? "" : "s"}`);
    }
    if (importResult.importErrorCount) {
      parts.push(`${importResult.importErrorCount} import fail${importResult.importErrorCount === 1 ? "" : "s"}`);
    }
    if (importResult.indexErrorCount) {
      parts.push("index fail");
    }
    if (importResult.overCapCount) {
      parts.push(`${importResult.overCapCount} over cap ${importResult.maxImages}`);
    }
    return parts.length ? ` Skipped ${parts.join("; ")}.` : "";
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
    return `${base} - original index ${normalizeOriginalScope(scope)} ${count}img`.slice(0, 140);
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
    const rows = normalizedImages.map((image) => `
      <tr>
        <td><a href="${escapeHTML(image.open_pdf_uri)}">p${escapeHTML(String(image.page_number))}</a></td>
        <td title="${escapeHTML(image.original_image_key)}">${escapeHTML(image.original_image_fingerprint)}</td>
        <td>${escapeHTML(formatBytes(image.byte_count))}</td>
        <td>${escapeHTML(image.bbox_normalized.map((value) => value.toFixed(4)).join(", "))}</td>
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
  <title>${escapeHTML(getSourceTitle(parentItem, attachment))} - original index</title>
  <style>
    body { margin: 18px; font: 13px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #555; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border-top: 1px solid #ddd; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { color: #555; font-weight: 600; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 10px; background: #f6f8fa; border: 1px solid #ddd; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHTML(getSourceTitle(parentItem, attachment))}</h1>
  <p class="meta">Originals ${escapeHTML(normalizedScope)}; ${normalizedImages.length} img; page links open PDF.</p>
  <table>
    <thead><tr><th>Page</th><th>ID</th><th>Size</th><th>Box</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
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
        warnings: ["No usable Python executable was found."],
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
        throw new Error("Helper failed: bundled script missing.");
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
    throw new Error("Capture failed: reader item is not a PDF.");
  }

  async function getAttachmentPath(attachment) {
    const filePath = await attachment.getFilePathAsync();
    if (!filePath || !(await IOUtils.exists(filePath))) {
      throw new Error("Helper failed: PDF path unresolved.");
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
      return normalizeMetadataText(message.message, "PDF Img notification.", 280);
    }
    return normalizeMetadataText(message, "PDF Img notification.", 280);
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
    toast.textContent = message;
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
        padding: 3px 8px;
        border: 1px solid var(--fill-quinary, #b8b8b8);
        border-radius: 4px;
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
      .pdf-image-saver-toolbar-group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0 6px;
        padding: 0 2px;
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
      .pdf-image-saver-toast {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 999999;
        max-width: min(360px, calc(100vw - 28px));
        padding: 7px 9px;
        border-radius: 4px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
        background: #222;
        color: #fff;
        font: 12px system-ui, sans-serif;
        line-height: 1.3;
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
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.82);
        color: #fff;
        font: 12px system-ui, sans-serif;
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
        padding: 1px 5px;
        border-radius: 3px 0 0 0;
        background: rgba(17, 24, 39, 0.88);
        color: #fff;
        font: 11px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
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

  function buildSourceRegionMapHTML(region) {
    if (!region) {
      return "";
    }
    return `<div class="source-map" title="${escapeHTML(region.label || "Source region")}"><span style="left:${formatCSSPercent(region.left)};top:${formatCSSPercent(region.top)};width:${formatCSSPercent(region.width)};height:${formatCSSPercent(region.height)}"></span></div>`;
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
      return "Helper: PyMuPDF missing.";
    }
    if (status === "no_python") {
      return "Helper: Python missing.";
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

  function normalizeQualityKey(value) {
    return Object.prototype.hasOwnProperty.call(QUALITY, value) ? value : "medium";
  }

  function getQualityLabelWithEstimate(qualityKey) {
    const normalizedQualityKey = normalizeQualityKey(qualityKey);
    const quality = QUALITY[normalizedQualityKey];
    return `${quality.label}; ${formatQualityEstimateShort(normalizedQualityKey)}`;
  }

  function formatQualityEstimateShort(qualityKey) {
    const estimate = QUALITY[normalizeQualityKey(qualityKey)].estimate;
    return String(estimate || "").replace(/\/image$/i, "");
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
    throw new Error("Preview image data URL is invalid.");
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
    return title.includes("image index");
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
      return "unknown size";
    }
    return `${width} x ${height}px`;
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
    return "Unknown error.";
  }

  function normalizeErrorMessageText(value) {
    const text = normalizeMetadataText(value, null, 320);
    if (!text || text === "undefined" || text === "null" || text === "[object Object]") {
      return "Unknown error.";
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
      || text.includes("original imports failed")
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
      || text.includes("selection outside canvas")
      || text.includes("reader item is not a pdf")
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
    return message === "Unknown error." ? "Unknown error." : message;
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
      buildOriginalImageTitle,
      buildOpenPDFURI,
      buildSourceRegion,
      calculateCanvasCrop,
      cleanupSelectionOverlay,
      installSelectionOverlay,
      startClipFromReader,
      confirmAndSaveOriginalImagesFromReader,
      filterExistingOriginalImagesForImport,
      formatDiagnosticsReport,
      formatOptionalHelperStatus,
      formatAutoDuplicateSkipReason,
      formatAutoNoCandidatesReason,
      formatPreviewDuplicateSkipReason,
      classifyPreviewDuplicateSkipReason,
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
      formatQualityEstimateShort,
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
