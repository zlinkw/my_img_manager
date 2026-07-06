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
    menuitem.setAttribute("label", "PDF Image Saver: clip figure");
    menuitem.setAttribute("tooltiptext", "Draw a box in the active PDF reader and save a synced preview index");
    menuitem.addEventListener("command", () => {
      void startClipFromActiveReader(win, getDefaultQualityKey());
    });
    const diagnosticsItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    diagnosticsItem.id = "pdf-image-saver-diagnostics-menuitem";
    diagnosticsItem.setAttribute("label", "PDF Image Saver: diagnostics");
    diagnosticsItem.setAttribute("tooltiptext", "Show runtime status, active PDF link, and temp cleanup state");
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
    select.title = "Preview quality and approximate Zotero sync size";
    for (const key of Object.keys(QUALITY)) {
      const option = doc.createElement("option");
      option.value = key;
      option.textContent = `${QUALITY[key].label} (${QUALITY[key].estimate})`;
      option.selected = key === getDefaultQualityKey();
      select.appendChild(option);
    }

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "pdf-image-saver-toolbar-button";
    button.textContent = "Clip Figure";
    button.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      button.disabled = true;
      button.textContent = "Select Area";
      Promise.resolve(startClipFromReader(reader, normalizeQualityKey(select.value))).finally(() => {
        button.disabled = false;
        button.textContent = "Clip Figure";
      });
    });

    const autoButton = doc.createElement("button");
    autoButton.type = "button";
    autoButton.className = "pdf-image-saver-toolbar-button";
    autoButton.textContent = "Auto Raster";
    autoButton.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      autoButton.disabled = true;
      autoButton.textContent = "Saving...";
      Promise.resolve(saveAutoDetectedPageImagePreviews(reader, {
        qualityKey: normalizeQualityKey(select.value),
      })).finally(() => {
        autoButton.disabled = false;
        autoButton.textContent = "Auto Raster";
        void updateAutoRasterButtonState(reader, autoButton);
      });
    });
    const updateQualityTooltips = () => {
      const qualityKey = normalizeQualityKey(select.value);
      select.title = `Preview quality: ${getQualityLabelWithEstimate(qualityKey)}`;
      button.title = buildToolbarActionTooltip("Clip a figure preview", qualityKey);
      autoButton.title = buildToolbarActionTooltip("Auto-detect embedded raster previews on the current page", qualityKey);
    };
    select.addEventListener("change", () => {
      setStringPref("defaultQuality", normalizeQualityKey(select.value));
      updateQualityTooltips();
    });
    updateQualityTooltips();
    updateAutoRasterButtonState(reader, autoButton);
    group.append(select, button, autoButton);
    append(group);
  }

  function onCreateViewContextMenu(event) {
    const { reader, params, append } = event;
    if (!isPDFReader(reader) || typeof append !== "function") {
      return;
    }

    for (const key of ["low", "medium", "high"]) {
      const quality = QUALITY[key];
      append({
        label: `Clip figure preview: ${quality.label} (${quality.estimate})`,
        onCommand() {
          void startClipFromReader(reader, key, getContextPageIndex(params));
        },
      });
    }

    append({
      label: `Try auto raster image previews (${QUALITY[getDefaultQualityKey()].label})`,
      onCommand() {
        void saveAutoDetectedPageImagePreviews(reader, {
          qualityKey: getDefaultQualityKey(),
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    append({
      label: "Save current page preview index (Medium)",
      onCommand() {
        void savePagePreviewIndex(reader, {
          qualityKey: "medium",
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    append({
      label: "Optional: save original embedded images from this page",
      onCommand() {
        void confirmAndSaveOriginalImagesFromReader(reader, {
          scope: "page",
          pageIndex: getContextPageIndex(params),
        });
      },
    });

    append({
      label: "PDF Image Saver diagnostics",
      onCommand() {
        void showReaderDiagnostics(reader);
      },
    });
  }

  async function startClipFromActiveReader(win, qualityKey) {
    const reader = getActiveReader(win);
    if (!reader) {
      Services.prompt.alert(win, "PDF Image Saver", "No active Zotero PDF reader was found.");
      return;
    }
    await startClipFromReader(reader, qualityKey);
  }

  async function showDiagnostics(win) {
    const reader = getActiveReader(win);
    const report = reader
      ? await buildRuntimeDiagnostics(reader)
      : await buildRuntimeDiagnostics(null);
    Services.prompt.alert(win, "PDF Image Saver diagnostics", formatDiagnosticsReport(report));
  }

  async function showReaderDiagnostics(reader) {
    const report = await buildRuntimeDiagnostics(reader);
    const win = Zotero.getMainWindow?.();
    Services.prompt.alert(win, "PDF Image Saver diagnostics", formatDiagnosticsReport(report));
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
    return report;
  }

  function formatDiagnosticsReport(report) {
    const safeReport = normalizeOptionsObject(report);
    const pdfAttachment = normalizeOptionsObject(safeReport.pdf_attachment);
    const pageNumber = normalizePageNumber(safeReport.page_number, 1);
    const pageLabel = normalizeDiagnosticText(safeReport.page_label, null, 80);
    const warnings = normalizeDiagnosticWarningMessages(safeReport.warnings);
    const lines = [
      `Plugin: ${normalizeDiagnosticText(safeReport.plugin, "unknown", 120)}`,
      `Zotero: ${normalizeDiagnosticText(safeReport.zotero, "unknown", 80)}`,
      `Started: ${formatDiagnosticBoolean(safeReport.started)}`,
      `Reader count: ${normalizeNonNegativeInteger(safeReport.reader_count, 0)}`,
      `Active PDF reader: ${formatDiagnosticBoolean(safeReport.active_pdf_reader)}`,
      `Default quality: ${normalizeQualityKey(safeReport.default_quality)}`,
      `Auto preview cap: ${normalizeDiagnosticText(safeReport.auto_cap, "unknown", 80)}`,
      `Max HTML index: ${normalizeDiagnosticText(safeReport.max_index, "unknown", 80)}`,
      `Temp dir: ${normalizeDiagnosticText(safeReport.temp_dir, "unknown", 240)}`,
      `Temp leftovers: ${normalizeNonNegativeInteger(safeReport.temp_leftovers, 0)} (${formatBytes(safeReport.temp_bytes)})`,
    ];
    if (safeReport.pdf_attachment) {
      lines.push(
        `PDF key: ${normalizeItemKey(pdfAttachment.key, "UNKNOWN")}`,
        `Library: ${normalizeDiagnosticText(safeReport.library_prefix, "library", 80)}`,
        `Parent item: ${normalizeDiagnosticText(pdfAttachment.parent_id, "none", 80)}`,
        `Page: ${pageNumber}${pageLabel ? ` (${pageLabel})` : ""}`,
        `Open PDF URI: ${normalizeDiagnosticText(safeReport.open_pdf_uri, "unavailable", 240)}`,
        `Auto raster available: ${formatDiagnosticBoolean(safeReport.auto_raster_available)}`,
      );
    }
    if (warnings.length) {
      lines.push("", "Warnings:", ...warnings.map((warning) => `- ${warning}`));
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

  async function startClipFromReader(reader, qualityKey, explicitPageIndex) {
    try {
      const pageIndex = await getCurrentPageIndex(reader, explicitPageIndex);
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Rendered PDF page canvas was not found.");
      }
      showReaderToast(reader, "Drag over a figure to save its preview index. Esc cancels.", "info");
      installSelectionOverlay(reader, context.doc, pageElement, canvas, qualityKey, pageIndex);
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
    }
  }

  function installSelectionOverlay(reader, doc, pageElement, canvas, qualityKey, pageIndex) {
    const existing = doc.getElementById("pdf-image-saver-selection-overlay");
    cleanupSelectionOverlay(existing);

    const overlay = doc.createElement("div");
    overlay.id = "pdf-image-saver-selection-overlay";
    overlay.tabIndex = 0;
    overlay.className = "pdf-image-saver-selection-overlay";
    prepareSelectionOverlayHost(pageElement, overlay);
    const selection = doc.createElement("div");
    selection.className = "pdf-image-saver-selection-box";
    overlay.appendChild(selection);
    pageElement.appendChild(overlay);
    overlay.focus();

    let start = null;
    let current = null;
    let activePointerID = null;

    const cleanup = () => {
      cleanupSelectionOverlay(overlay);
    };

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cleanup();
        showReaderToast(reader, "Clip cancelled.", "warning");
      }
    });

    overlay.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || activePointerID !== null) {
        return;
      }
      event.preventDefault();
      activePointerID = event.pointerId;
      overlay.setPointerCapture?.(event.pointerId);
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
      cleanup();
      if (rect.width < 12 || rect.height < 12) {
        showReaderToast(reader, "Selection too small.", "warning");
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
  }

  async function saveClipPreviewIndex(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const pageIndex = normalizePageIndex(options.pageIndex, 0);
      const qualityKey = normalizeQualityKey(options.qualityKey);
      jobKey = getReaderJobKey(reader, {
        scope: "clip",
        pageIndex,
      });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, "Save already running for this page.", "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const preview = renderCanvasPreview({ ...options, pageIndex, qualityKey });
      const duplicateKey = getPreviewDuplicateKey(attachment, preview);
      if (getBoolPref("duplicateGuard", true) && recentIndexSaves.has(duplicateKey)) {
        showReaderToast(reader, "This preview was already saved in this Zotero session.", "warning");
        return null;
      }
      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: [preview],
        scope: "clip",
        qualityKey,
      });
      const imported = await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "clip",
        pageIndex,
      });
      showReaderToast(
        reader,
        `Saved preview index (${formatBytes(preview.byteCount)}).`,
        "success",
      );
      recentIndexSaves.set(duplicateKey, Date.now());
      pruneRecentIndexSaves();
      return imported;
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
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
      const qualityKey = normalizeQualityKey(options.qualityKey);
      const pageIndex = await getCurrentPageIndex(reader, options.pageIndex);
      jobKey = getReaderJobKey(reader, { scope: "auto-page", pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, "Auto image save already running for this page.", "warning");
        return null;
      }

      activeJobs.add(jobKey);
      jobAdded = true;
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Rendered PDF page canvas was not found.");
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
          `${detection.reason || "No embedded images were detected on this page."} Use Clip Figure for manual save.`,
          "warning",
        );
        return null;
      }

      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const previews = [];
      const duplicateGuard = getBoolPref("duplicateGuard", true);
      const maxBytes = getAutoMaxPreviewBytes();
      let totalBytes = 0;
      let skippedDuplicates = 0;
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
        if (duplicateGuard && recentIndexSaves.has(duplicateKey)) {
          skippedDuplicates += 1;
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
        const reason = skippedDuplicates
          ? "All detected previews were already saved in this Zotero session."
          : "Detected previews exceeded the auto-save byte cap.";
        showReaderToast(reader, reason, "warning");
        return null;
      }

      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: previews,
        scope: "auto-page",
        qualityKey,
      });
      const imported = await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "auto-page",
        pageIndex,
      });
      for (const preview of previews) {
        recentIndexSaves.set(getPreviewDuplicateKey(attachment, preview), Date.now());
      }
      pruneRecentIndexSaves();
      const notes = [];
      if (skippedDuplicates) {
        notes.push(`${skippedDuplicates} duplicate skipped`);
      }
      if (skippedByteLimit) {
        notes.push("byte cap reached");
      }
      if (skippedOversized) {
        notes.push(`${skippedOversized} oversized skipped`);
      }
      showReaderToast(
        reader,
        `Saved ${previews.length} detected image preview${previews.length === 1 ? "" : "s"} (${formatBytes(totalBytes)}${notes.length ? `; ${notes.join(", ")}` : ""}).`,
        "success",
      );
      return imported;
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
      return null;
    } finally {
      if (jobAdded) {
        activeJobs.delete(jobKey);
      }
    }
  }

  async function savePagePreviewIndex(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const pageIndex = await getCurrentPageIndex(reader, options.pageIndex);
      const qualityKey = normalizeQualityKey(options.qualityKey);
      jobKey = getReaderJobKey(reader, { scope: "page", pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, "Save already running for this page.", "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Rendered PDF page canvas was not found.");
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
      if (getBoolPref("duplicateGuard", true) && recentIndexSaves.has(duplicateKey)) {
        showReaderToast(reader, "This page preview was already saved in this Zotero session.", "warning");
        return;
      }
      const indexPath = await createIndexHTML({
        attachment,
        parentItem,
        entries: [preview],
        scope: "page",
        qualityKey,
      });
      await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "page",
        pageIndex,
      });
      recentIndexSaves.set(duplicateKey, Date.now());
      pruneRecentIndexSaves();
      showReaderToast(reader, `Saved page preview index (${formatBytes(preview.byteCount)}).`, "success");
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
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
      throw new Error("Rendered PDF page geometry is unavailable.");
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
      throw new Error("Selection does not overlap the rendered page canvas.");
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
      return { candidates: [], reason: "PDF.js page render API is unavailable.", pageLabel: getPageLabel(context, pageIndex) };
    }
    if (!supportsPDFJSImageCoordinates(pdfPage)) {
      return { candidates: [], reason: "Auto raster detection is unavailable in this Zotero PDF.js runtime.", pageLabel: getPageLabel(context, pageIndex) };
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
        return { candidates: [], reason: "No PDF.js image coordinates were recorded.", pageLabel: getPageLabel(context, pageIndex) };
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
      return { candidates: [], reason: "Auto detection is unavailable in this Zotero/PDF.js runtime.", pageLabel: getPageLabel(context, pageIndex) };
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

  async function updateAutoRasterButtonState(reader, button) {
    try {
      const pageIndex = await getCurrentPageIndex(reader);
      const context = await getPDFViewerContext(reader);
      const pageView = getPageView(context, pageIndex);
      const pdfPage = pageView?.pdfPage || await context?.app?.pdfDocument?.getPage?.(pageIndex + 1);
      if (pdfPage && !supportsPDFJSImageCoordinates(pdfPage)) {
        button.disabled = true;
        button.title = "Auto raster detection is unavailable in this Zotero PDF.js runtime. Use Clip Figure.";
      }
    } catch (error) {
      logError(error);
    }
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

  async function createIndexHTML({ attachment, parentItem, entries, scope, qualityKey }) {
    const outputDir = await createTempDirectory();
    const htmlPath = PathUtils.join(outputDir, `pdf-image-index-${Zotero.Utilities.randomString(8)}.html`);
    try {
      const html = buildIndexHTML({
        attachment,
        parentItem,
        entries,
        scope,
        qualityKey,
      });
      const htmlBytes = estimateUTF8Bytes(html);
      const maxBytes = getMaxIndexBytes();
      if (htmlBytes > maxBytes) {
        throw new Error(`Preview index is too large (${formatBytes(htmlBytes)} > ${formatBytes(maxBytes)}). Lower preview quality or reduce auto-detect count.`);
      }
      await Zotero.File.putContentsAsync(htmlPath, html);
      return htmlPath;
    } catch (error) {
      await removeDirectoryIfExists(outputDir);
      throw error;
    }
  }

  function buildIndexHTML({ attachment, parentItem, entries, scope, qualityKey }) {
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
        const uri = buildOpenPDFURI(attachment, entry.pageNumber, entry.annotationKey);
        entry.openPDFURI = uri;
        const pageText = entry.pageLabel && entry.pageLabel !== String(entry.pageNumber)
          ? `${entry.pageNumber} (${entry.pageLabel})`
          : String(entry.pageNumber);
        const sourceRegionLabel = entry.sourceRegion?.label || entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ");
        return `
          <article class="entry">
            <div class="preview-column">
              <a class="preview-link" href="${escapeHTML(uri)}">
                <img src="${escapeHTML(entry.dataURL)}" alt="Saved PDF preview ${index + 1}">
              </a>
              ${buildSourceRegionMapHTML(entry.sourceRegion)}
            </div>
            <dl>
              <div><dt>Page</dt><dd><a href="${escapeHTML(uri)}">${escapeHTML(pageText)}</a></dd></div>
              <div><dt>Quality</dt><dd>${escapeHTML(QUALITY[entry.quality].label)} (${escapeHTML(entry.qualityEstimate)})</dd></div>
              <div><dt>Actual</dt><dd>${formatBytes(entry.byteCount)}, ${formatPreviewDimensions(entry.renderedWidth, entry.renderedHeight)}</dd></div>
              <div><dt>Source</dt><dd>${escapeHTML(entry.detector)}</dd></div>
              <div><dt>Region</dt><dd>${escapeHTML(sourceRegionLabel)}</dd></div>
              <div><dt>BBox</dt><dd>${entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ")}</dd></div>
            </dl>
          </article>`;
      })
      .join("\n");

    const metadata = {
      schema_version: HELPER_SCHEMA_VERSION,
      created_at: createdAt,
      plugin: { id: config.id, version: config.version },
      storage_mode: "reader_preview_index",
      scope: normalizedScope,
      preview_quality: previewQualityKey,
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
        annotation_key: entry.annotationKey,
        detection_area: entry.detectionArea,
        open_pdf_uri: entry.openPDFURI,
      })),
    };

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(sourceTitle)} - PDF image index</title>
  <style>
    body { margin: 24px; font: 14px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { margin-bottom: 18px; }
    h1 { font-size: 18px; margin: 0 0 6px; }
    .meta { color: #555; margin: 0; }
    .entry { display: grid; grid-template-columns: minmax(160px, 360px) 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid #ddd; }
    .preview-column { display: grid; gap: 8px; align-content: start; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; background: #f6f6f6; }
    .source-map { position: relative; width: 72px; aspect-ratio: 0.72; border: 1px solid #bbb; background: #fafafa; }
    .source-map span { position: absolute; min-width: 2px; min-height: 2px; border: 2px solid #1f73b7; background: rgba(31, 115, 183, 0.18); box-sizing: border-box; }
    dl { margin: 0; display: grid; gap: 6px; align-content: start; }
    dl div { display: grid; grid-template-columns: 80px 1fr; gap: 8px; }
    dt { color: #666; }
    dd { margin: 0; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 12px; background: #f6f8fa; border: 1px solid #ddd; }
    @media (max-width: 720px) { .entry { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHTML(sourceTitle)}</h1>
    <p class="meta">Saved ${escapeHTML(createdAt)}. Preview mode, Zotero synced attachment. No original image bytes stored unless explicitly requested.</p>
  </header>
  ${entriesHTML}
  <h2>Metadata</h2>
  <pre>${escapeHTML(JSON.stringify(metadata, null, 2))}</pre>
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

  async function importIndexAttachment({ attachment, parentItem, indexPath, scope, pageIndex }) {
    const parentID = attachment.parentID || undefined;
    try {
      return await Zotero.Attachments.importFromFile({
        file: indexPath,
        parentItemID: parentID,
        libraryID: parentID ? undefined : attachment.libraryID,
        title: buildIndexTitle(parentItem, attachment, scope, pageIndex),
        contentType: "text/html",
        charset: "utf-8",
      });
    } finally {
      await removeDirectoryIfExists(PathUtils.parent(indexPath));
    }
  }

  function buildIndexTitle(parentItem, attachment, scope, pageIndex) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment));
    const targetPage = normalizePageIndex(pageIndex, null);
    const target = targetPage === null ? normalizeScope(scope) : `p${targetPage + 1}`;
    return `${base} - image index ${target}`;
  }

  async function confirmAndSaveOriginalImagesFromReader(reader, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    try {
      const win = Zotero.getMainWindow?.();
      const scope = normalizeOriginalScope(safeOptions.scope);
      const scopeLabel = scope === "document" ? "whole document" : "current page";
      const maxImages = scope === "document"
        ? getHelperMaxImages("document")
        : getHelperMaxImages("page");
      const ok = Services.prompt.confirm(
        win,
        "PDF Image Saver",
        `Save original embedded images from the ${scopeLabel}? This can store up to ${maxImages} original image attachments in Zotero. Preview clipping is safer for sync storage.`,
      );
      if (!ok) {
        showReaderToast(reader, "Original extraction cancelled.", "warning");
        return null;
      }
      return await saveOriginalImagesFromReader(reader, { ...safeOptions, scope });
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
      return null;
    }
  }

  async function saveOriginalImagesFromReader(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const scope = normalizeOriginalScope(options.scope);
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const pageIndex =
        scope === "page"
          ? await getCurrentPageIndex(reader, options.pageIndex)
          : null;
      jobKey = getReaderJobKey(reader, { scope, pageIndex });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, "Original extraction already running for this target.", "warning");
        return;
      }

      activeJobs.add(jobKey);
      jobAdded = true;
      const pdfPath = await getAttachmentPath(attachment);
      showReaderToast(reader, "Trying optional original-image helper...", "info");
      const report = await runHelperExtraction({
        attachment,
        pdfPath,
        pageIndex,
        scope,
      });
      if (report.status !== "ok") {
        showReaderToast(reader, `${formatHelperFailure(report)} Default clip mode still works.`, "warning");
        return;
      }
      if (!report.images?.length) {
        showReaderToast(reader, "No embedded original images matched helper filters.", "warning");
        return;
      }
      const importResult = await importOriginalImages({
        report,
        attachment,
        parentItem,
        scope,
      });
      const skippedText = importResult.omittedCount
        ? buildOriginalImportSkippedText(importResult)
        : "";
      showReaderToast(
        reader,
        `Saved ${importResult.count} original image attachment${importResult.count === 1 ? "" : "s"}.${skippedText}`,
        importResult.omittedCount ? "warning" : "success",
      );
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
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
    const limited = limitOriginalImagesForImport(report, scope);
    const prepared = await filterExistingOriginalImagesForImport(limited);
    try {
      for (const image of prepared.images) {
        try {
          await Zotero.Attachments.importFromFile({
            file: image.filePath,
            parentItemID: parentID,
            libraryID: parentID ? undefined : attachment.libraryID,
            title: buildOriginalImageTitle(parentItem, attachment, image),
            contentType: image.contentType,
          });
          count += 1;
        } catch (error) {
          importErrorCount += 1;
          logError(error);
        }
      }
      if (prepared.images.length && !count && importErrorCount === prepared.images.length) {
        throw new Error(`All ${importErrorCount} Zotero original image imports failed.`);
      }
      return {
        count,
        omittedCount: prepared.omittedCount + importErrorCount,
        invalidCount: prepared.invalidCount,
        overCapCount: prepared.overCapCount,
        missingCount: prepared.missingCount,
        errorCount: prepared.errorCount,
        importErrorCount: importErrorCount,
        maxImages: prepared.maxImages,
      };
    } finally {
      await removeDirectoryIfExists(report.output_dir);
    }
  }

  async function filterExistingOriginalImagesForImport(limited) {
    const images = [];
    let missingCount = 0;
    let errorCount = 0;
    for (const image of limited.images || []) {
      const status = await getHelperImageFileStatus(image.filePath);
      if (status.exists) {
        images.push(image);
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
      omittedCount: (limited.omittedCount || 0) + missingCount + errorCount,
    };
  }

  async function getHelperImageFileStatus(filePath) {
    if (typeof filePath !== "string") {
      return { exists: false, error: false };
    }
    try {
      return { exists: !!(await IOUtils.exists(filePath)), error: false };
    } catch (error) {
      logError(error);
      return { exists: false, error: true };
    }
  }

  function limitOriginalImagesForImport(report, scope) {
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
    const maxImages = getHelperMaxImages(scope);
    const overCapCount = Math.max(0, normalizedImages.length - maxImages);
    return {
      images: normalizedImages.slice(0, maxImages),
      omittedCount: invalidCount + overCapCount,
      invalidCount,
      overCapCount,
      maxImages,
      originalCount: images.length,
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
    return {
      file_path: filePath,
      filePath,
      content_type: contentType,
      contentType,
      extension,
      page_number: pageNumber,
      pageNumber,
      occurrence: normalizePositiveInteger(image?.occurrence, index + 1),
    };
  }

  function buildOriginalImageTitle(parentItem, attachment, image) {
    const base = sanitizeTitle(getSourceTitle(parentItem, attachment));
    const pageNumber = normalizePageNumber(image?.pageNumber ?? image?.page_number, 1);
    const occurrence = normalizePositiveInteger(image?.occurrence, 1);
    return `${base} - original p${pageNumber} image ${occurrence}`;
  }

  function buildOriginalImportSkippedText(importResult) {
    const parts = [];
    if (importResult.invalidCount) {
      parts.push(`skipped ${importResult.invalidCount} malformed helper record${importResult.invalidCount === 1 ? "" : "s"}`);
    }
    if (importResult.missingCount) {
      parts.push(`skipped ${importResult.missingCount} missing helper file${importResult.missingCount === 1 ? "" : "s"}`);
    }
    if (importResult.errorCount) {
      parts.push(`skipped ${importResult.errorCount} unreadable helper file${importResult.errorCount === 1 ? "" : "s"}`);
    }
    if (importResult.importErrorCount) {
      parts.push(`skipped ${importResult.importErrorCount} failed Zotero import${importResult.importErrorCount === 1 ? "" : "s"}`);
    }
    if (importResult.overCapCount) {
      parts.push(`skipped ${importResult.overCapCount} over safety cap ${importResult.maxImages}`);
    }
    return parts.length ? ` ${parts.join("; ")}.` : "";
  }

  async function runHelperExtraction({ attachment, pdfPath, pageIndex, scope }) {
    const outputDir = await createTempDirectory();
    const reportPath = PathUtils.join(outputDir, "report.json");
    const pythonCommands = await getPythonCommands();
    if (!pythonCommands.length) {
      await removeDirectoryIfExists(outputDir);
      return {
        schema_version: HELPER_SCHEMA_VERSION,
        status: "no_python",
        images: [],
        warnings: ["No usable Python executable was found."],
        output_dir: null,
      };
    }

    const helperScriptPath = await ensureHelperScriptPath();
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
          throw new Error(`Helper exited with ${exitCode} and did not create a report.`);
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
        throw new Error("Bundled helper script could not be loaded.");
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
      throw new Error("Helper did not create a report.");
    }
    const raw = await Zotero.File.getContentsAsync(path);
    const report = JSON.parse(raw);
    if (report.schema_version !== HELPER_SCHEMA_VERSION) {
      throw new Error(`Unexpected helper schema: ${normalizeHelperSchemaText(report.schema_version)}`);
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
    try {
      await IOUtils.remove(path, { recursive: true, ignoreAbsent: true });
    } catch (error) {
      logError(error);
    }
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
    throw new Error("Active reader item is not a PDF attachment.");
  }

  async function getAttachmentPath(attachment) {
    const filePath = await attachment.getFilePathAsync();
    if (!filePath || !(await IOUtils.exists(filePath))) {
      throw new Error("PDF file path could not be resolved.");
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
      return normalizeMetadataText(message.message, "PDF Image Saver notification.", 280);
    }
    return normalizeMetadataText(message, "PDF Image Saver notification.", 280);
  }

  function normalizeToastLevel(level) {
    const text = normalizeMetadataText(level, "info", 24);
    return ["info", "success", "warning", "error"].includes(text) ? text : "info";
  }

  function showToastInDocument(doc, message, level) {
    if (!doc?.body) {
      return false;
    }
    ensureReaderStyles(doc);
    const existing = doc.getElementById("pdf-image-saver-toast");
    existing?.remove();
    const toast = doc.createElement("div");
    toast.id = "pdf-image-saver-toast";
    toast.className = `pdf-image-saver-toast pdf-image-saver-${level || "info"}`;
    toast.textContent = message;
    doc.body.appendChild(toast);
    doc.defaultView.setTimeout(() => toast.remove(), level === "error" ? 8000 : 3500);
    return true;
  }

  function showFallbackAlert(fallbackWindow, message) {
    Services.prompt.alert(fallbackWindow, "PDF Image Saver", message);
  }

  function ensureReaderStyles(doc) {
    if (doc.getElementById("pdf-image-saver-style")) {
      return;
    }
    const style = doc.createElement("style");
    style.id = "pdf-image-saver-style";
    style.textContent = `
      .pdf-image-saver-toolbar-button {
        margin: 0 4px;
        padding: 3px 8px;
        border: 1px solid var(--fill-quinary, #b8b8b8);
        border-radius: 4px;
        background: var(--material-background, #fff);
        color: var(--fill-primary, #111);
        font: inherit;
        cursor: pointer;
        min-height: 26px;
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
        margin: 0 4px;
      }
      .pdf-image-saver-quality {
        max-width: 170px;
        min-height: 26px;
        font: inherit;
      }
      .pdf-image-saver-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999999;
        max-width: min(460px, calc(100vw - 36px));
        padding: 10px 12px;
        border-radius: 6px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
        background: #222;
        color: #fff;
        font: 13px system-ui, sans-serif;
        line-height: 1.35;
      }
      .pdf-image-saver-success { background: #176b3a; }
      .pdf-image-saver-warning { background: #8a5a00; }
      .pdf-image-saver-error { background: #8a1f1f; }
      .pdf-image-saver-selection-overlay {
        position: absolute;
        inset: 0;
        z-index: 999998;
        cursor: crosshair;
        background: rgba(0, 0, 0, 0.04);
        outline: 2px solid rgba(31, 115, 183, 0.4);
      }
      .pdf-image-saver-selection-box {
        position: absolute;
        border: 2px solid #1f73b7;
        background: rgba(31, 115, 183, 0.16);
        box-sizing: border-box;
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
      label: `x ${formatPercent(left)}-${formatPercent(right)}, y ${formatPercent(top)}-${formatPercent(bottom)}, size ${formatPercent(width)} x ${formatPercent(height)}`,
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
      return "Optional PyMuPDF helper is unavailable.";
    }
    if (status === "no_python") {
      return "Optional Python helper was not found.";
    }
    const details = normalizeHelperWarningMessages(report?.warnings).join("; ");
    return `Optional original extraction failed: ${status}${details ? ` (${details})` : ""}`;
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
    return `${quality.label}, ${quality.estimate}`;
  }

  function buildToolbarActionTooltip(action, qualityKey) {
    const actionText = normalizeMetadataText(action, "Save preview", 80);
    return `${actionText}. Selected: ${getQualityLabelWithEstimate(qualityKey)}.`;
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

  return {
    init,
    startup,
    shutdown,
    addToWindow,
    removeFromWindow,
    __test__: {
      buildIndexHTML,
      buildIndexTitle,
      buildOriginalImageTitle,
      buildOpenPDFURI,
      buildSourceRegion,
      calculateCanvasCrop,
      cleanupSelectionOverlay,
      confirmAndSaveOriginalImagesFromReader,
      filterExistingOriginalImagesForImport,
      formatDiagnosticsReport,
      formatHelperFailure,
      getErrorMessage,
      getActiveReader,
      getContextPageIndex,
      getPDFViewerContextCandidate,
      buildToolbarActionTooltip,
      getPreviewDuplicateKey,
      importOriginalImages,
      limitOriginalImagesForImport,
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
