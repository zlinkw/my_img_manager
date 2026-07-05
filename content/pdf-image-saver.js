var PdfImageSaver = (() => {
  const ADDON_REF = "pdf-image-saver";
  const HELPER_SCHEMA_VERSION = "zotero-pdf-image-saver/v1";
  const PREF_BRANCH = "extensions.pdfImageSaver.";
  const DEFAULT_MIN_AREA = 0.004;
  const DEFAULT_MAX_PAGE_IMAGES = 80;
  const DEFAULT_MAX_DOCUMENT_IMAGES = 250;
  const DEFAULT_HELPER_TIMEOUT_SECONDS = 60;
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
    const menuitem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    menuitem.id = "pdf-image-saver-tools-menuitem";
    menuitem.setAttribute("label", "PDF Image Saver: clip figure");
    menuitem.setAttribute("tooltiptext", "Draw a box in the active PDF reader and save a synced preview index");
    menuitem.addEventListener("command", () => {
      void startClipFromActiveReader(win, getDefaultQualityKey());
    });
    toolsPopup?.appendChild(menuitem);
    windowState.set(win, { menuitem });
  }

  async function removeFromWindow(win) {
    const state = windowState.get(win);
    if (!state) {
      return;
    }
    state.menuitem?.remove();
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
    for (const { type, handler } of readerHandlers) {
      try {
        Zotero.Reader.unregisterEventListener(type, handler);
      } catch (error) {
        logError(error);
      }
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
    const group = doc.createElement("span");
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
    select.addEventListener("change", () => {
      setStringPref("defaultQuality", normalizeQualityKey(select.value));
    });

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "pdf-image-saver-toolbar-button";
    button.title = "Clip a figure preview. Default: Medium, 60-220 KB/image.";
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
    group.append(select, button);
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
        void saveOriginalImagesFromReader(reader, {
          scope: "page",
          pageIndex: getContextPageIndex(params),
        });
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
    existing?.remove();

    const previousPosition = pageElement.style.position;
    if (!previousPosition || previousPosition === "static") {
      pageElement.style.position = "relative";
    }

    const overlay = doc.createElement("div");
    overlay.id = "pdf-image-saver-selection-overlay";
    overlay.tabIndex = 0;
    overlay.className = "pdf-image-saver-selection-overlay";
    const selection = doc.createElement("div");
    selection.className = "pdf-image-saver-selection-box";
    overlay.appendChild(selection);
    pageElement.appendChild(overlay);
    overlay.focus();

    let start = null;
    let current = null;
    let activePointerID = null;

    const cleanup = () => {
      overlay.remove();
      pageElement.style.position = previousPosition;
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

  function renderSelection(selection, start, current) {
    const rect = normalizedRect(start, current);
    Object.assign(selection.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  async function saveClipPreviewIndex(reader, options) {
    const jobKey = getReaderJobKey(reader, {
      scope: "clip",
      pageIndex: options.pageIndex,
    });
    if (activeJobs.has(jobKey)) {
      showReaderToast(reader, "Save already running for this page.", "warning");
      return;
    }
    activeJobs.add(jobKey);
    try {
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const preview = renderCanvasPreview(options);
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
        qualityKey: options.qualityKey,
      });
      const imported = await importIndexAttachment({
        attachment,
        parentItem,
        indexPath,
        scope: "clip",
        pageIndex: options.pageIndex,
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
      activeJobs.delete(jobKey);
    }
  }

  async function savePagePreviewIndex(reader, options) {
    const pageIndex = await getCurrentPageIndex(reader, options.pageIndex);
    const jobKey = getReaderJobKey(reader, { scope: "page", pageIndex });
    if (activeJobs.has(jobKey)) {
      showReaderToast(reader, "Save already running for this page.", "warning");
      return;
    }
    activeJobs.add(jobKey);
    try {
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
        qualityKey: options.qualityKey,
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
        qualityKey: options.qualityKey,
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
      activeJobs.delete(jobKey);
    }
  }

  function renderCanvasPreview({ canvas, pageElement, pageIndex, qualityKey, selectionRect }) {
    const quality = QUALITY[qualityKey] || QUALITY.medium;
    const canvasRect = canvas.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    const selectionClientRect = {
      left: pageRect.left + selectionRect.left,
      top: pageRect.top + selectionRect.top,
      right: pageRect.left + selectionRect.left + selectionRect.width,
      bottom: pageRect.top + selectionRect.top + selectionRect.height,
    };
    const cropClient = intersectRects(selectionClientRect, canvasRect);
    if (cropClient.width <= 0 || cropClient.height <= 0) {
      throw new Error("Selection does not overlap the rendered page canvas.");
    }

    const sourceX = Math.round(((cropClient.left - canvasRect.left) / canvasRect.width) * canvas.width);
    const sourceY = Math.round(((cropClient.top - canvasRect.top) / canvasRect.height) * canvas.height);
    const sourceWidth = Math.max(1, Math.round((cropClient.width / canvasRect.width) * canvas.width));
    const sourceHeight = Math.max(1, Math.round((cropClient.height / canvasRect.height) * canvas.height));
    const scale = Math.min(1, quality.maxWidth / sourceWidth);
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const outputCanvas = canvas.ownerDocument.createElement("canvas");
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;
    const context = outputCanvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = qualityKey === "high" ? "high" : "medium";
    context.drawImage(
      canvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    const dataURL = outputCanvas.toDataURL("image/jpeg", quality.jpegQuality);
    const bboxNormalized = [
      round6(selectionRect.left / pageRect.width),
      round6(selectionRect.top / pageRect.height),
      round6((selectionRect.left + selectionRect.width) / pageRect.width),
      round6((selectionRect.top + selectionRect.height) / pageRect.height),
    ];
    return {
      id: `preview-p${pageIndex + 1}-${Date.now().toString(36)}`,
      mode: "reader_canvas_preview",
      pageIndex,
      pageNumber: pageIndex + 1,
      quality: qualityKey,
      qualityEstimate: quality.estimate,
      dataURL,
      byteCount: estimateDataURLBytes(dataURL),
      renderedWidth: targetWidth,
      renderedHeight: targetHeight,
      sourceCanvasWidth: canvas.width,
      sourceCanvasHeight: canvas.height,
      bboxNormalized,
      openPDFURI: "",
    };
  }

  async function createIndexHTML({ attachment, parentItem, entries, scope, qualityKey }) {
    const outputDir = await createTempDirectory();
    const htmlPath = PathUtils.join(outputDir, `pdf-image-index-${Zotero.Utilities.randomString(8)}.html`);
    const html = buildIndexHTML({
      attachment,
      parentItem,
      entries,
      scope,
      qualityKey,
    });
    await Zotero.File.putContentsAsync(htmlPath, html);
    return htmlPath;
  }

  function buildIndexHTML({ attachment, parentItem, entries, scope, qualityKey }) {
    const createdAt = new Date().toISOString();
    const sourceTitle = parentItem?.getField("title") || attachment.getField("title") || "PDF";
    const entriesHTML = entries
      .map((entry, index) => {
        const uri = buildOpenPDFURI(attachment, entry.pageNumber);
        entry.openPDFURI = uri;
        return `
          <article class="entry">
            <a class="preview-link" href="${escapeHTML(uri)}">
              <img src="${entry.dataURL}" alt="Saved PDF preview ${index + 1}">
            </a>
            <dl>
              <div><dt>Page</dt><dd><a href="${escapeHTML(uri)}">${entry.pageNumber}</a></dd></div>
              <div><dt>Quality</dt><dd>${escapeHTML(QUALITY[entry.quality].label)} (${escapeHTML(entry.qualityEstimate)})</dd></div>
              <div><dt>Actual</dt><dd>${formatBytes(entry.byteCount)}, ${entry.renderedWidth} x ${entry.renderedHeight}px</dd></div>
              <div><dt>Location</dt><dd>${entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ")}</dd></div>
            </dl>
          </article>`;
      })
      .join("\n");

    const metadata = {
      schema_version: HELPER_SCHEMA_VERSION,
      created_at: createdAt,
      plugin: { id: config.id, version: config.version },
      storage_mode: "reader_preview_index",
      scope,
      preview_quality: qualityKey,
      zotero_version: Zotero.version,
      parent_item: serializeItem(parentItem),
      pdf_attachment: serializeAttachment(attachment),
      entries: entries.map((entry) => ({
        id: entry.id,
        mode: entry.mode,
        page_index: entry.pageIndex,
        page_number: entry.pageNumber,
        quality: entry.quality,
        byte_count: entry.byteCount,
        rendered_width: entry.renderedWidth,
        rendered_height: entry.renderedHeight,
        bbox_normalized: entry.bboxNormalized,
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
    img { max-width: 100%; height: auto; border: 1px solid #ccc; background: #f6f6f6; }
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
    const base = sanitizeTitle(parentItem?.getField("title") || attachment.getField("title") || "PDF");
    const target = pageIndex === null || pageIndex === undefined ? scope : `p${pageIndex + 1}`;
    return `${base} - image index ${target}`;
  }

  async function saveOriginalImagesFromReader(reader, options) {
    const jobKey = getReaderJobKey(reader, options);
    if (activeJobs.has(jobKey)) {
      showReaderToast(reader, "Original extraction already running for this target.", "warning");
      return;
    }

    activeJobs.add(jobKey);
    try {
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const pdfPath = await getAttachmentPath(attachment);
      const pageIndex =
        options.scope === "page"
          ? await getCurrentPageIndex(reader, options.pageIndex)
          : null;
      showReaderToast(reader, "Trying optional original-image helper...", "info");
      const report = await runHelperExtraction({
        attachment,
        pdfPath,
        pageIndex,
        scope: options.scope,
      });
      if (report.status !== "ok") {
        showReaderToast(reader, `${formatHelperFailure(report)} Default clip mode still works.`, "warning");
        return;
      }
      if (!report.images?.length) {
        showReaderToast(reader, "No embedded original images matched helper filters.", "warning");
        return;
      }
      const importedCount = await importOriginalImages({
        report,
        attachment,
        parentItem,
      });
      showReaderToast(reader, `Saved ${importedCount} original image attachment${importedCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      logError(error);
      showReaderToast(reader, getErrorMessage(error), "error");
    } finally {
      activeJobs.delete(jobKey);
    }
  }

  async function importOriginalImages({ report, attachment, parentItem }) {
    const parentID = attachment.parentID || undefined;
    let count = 0;
    try {
      for (const image of report.images) {
        await Zotero.Attachments.importFromFile({
          file: image.file_path,
          parentItemID: parentID,
          libraryID: parentID ? undefined : attachment.libraryID,
          title: buildOriginalImageTitle(parentItem, attachment, image),
          contentType: image.content_type || guessContentType(image.extension),
        });
        count += 1;
      }
      return count;
    } finally {
      await removeDirectoryIfExists(report.output_dir);
    }
  }

  function buildOriginalImageTitle(parentItem, attachment, image) {
    const base = sanitizeTitle(parentItem?.getField("title") || attachment.getField("title") || "PDF");
    return `${base} - original p${image.page_number} image ${image.occurrence}`;
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
      String(scope === "document" ? getIntegerPref("maxDocumentImages", DEFAULT_MAX_DOCUMENT_IMAGES) : getIntegerPref("maxPageImages", DEFAULT_MAX_PAGE_IMAGES)),
    ];
    if (pageIndex !== null && pageIndex !== undefined) {
      argsBase.push("--page-index", String(pageIndex));
    }

    const failures = [];
    let missingPyMuPDFReport = null;
    for (const pythonCommand of pythonCommands) {
      try {
        await runProcess(pythonCommand, argsBase);
        const report = await readJSONReport(reportPath);
        report.output_dir = outputDir;
        report.helper = {
          command: formatCommand(pythonCommand),
          report_path: reportPath,
        };
        if (report.status === "ok") {
          pythonCommandPromise = Promise.resolve(pythonCommand);
          return report;
        }
        if (report.status === "missing_pymupdf") {
          missingPyMuPDFReport = report;
        }
        failures.push(`${formatCommand(pythonCommand)}: ${report.status || "unknown"}`);
      } catch (error) {
        failures.push(`${formatCommand(pythonCommand)}: ${getErrorMessage(error)}`);
      }
    }

    await removeDirectoryIfExists(outputDir);
    if (missingPyMuPDFReport) {
      missingPyMuPDFReport.output_dir = null;
      missingPyMuPDFReport.warnings = [
        ...(missingPyMuPDFReport.warnings || []),
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
      const timeoutMS = Math.max(5, getIntegerPref("helperTimeoutSeconds", DEFAULT_HELPER_TIMEOUT_SECONDS)) * 1000;
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
  }

  async function readJSONReport(path) {
    if (!(await IOUtils.exists(path))) {
      throw new Error("Helper did not create a report.");
    }
    const raw = await Zotero.File.getContentsAsync(path);
    const report = JSON.parse(raw);
    if (report.schema_version !== HELPER_SCHEMA_VERSION) {
      throw new Error(`Unexpected helper schema: ${report.schema_version}`);
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
    if (Number.isInteger(explicitPageIndex) && explicitPageIndex >= 0) {
      return explicitPageIndex;
    }
    const context = await getPDFViewerContext(reader);
    const pageNumber =
      context?.app?.pdfViewer?.currentPageNumber ||
      context?.app?.page ||
      context?.app?.pdfViewer?._currentPageNumber ||
      1;
    return Math.max(0, Number(pageNumber || 1) - 1);
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
    const views = [
      reader?._lastView,
      reader?._primaryView,
      reader?._internalReader?._lastView,
      reader?._internalReader?._primaryView,
    ];
    for (const view of views) {
      const iframeWindow = view?._iframeWindow || view?._iframe?.contentWindow;
      const app =
        iframeWindow?.PDFViewerApplication ||
        iframeWindow?.wrappedJSObject?.PDFViewerApplication;
      if (app) {
        return { app, doc: iframeWindow.document };
      }
    }
    return null;
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
    const pageView =
      context?.app?.pdfViewer?.getPageView?.(pageNumber - 1) ||
      context?.app?.pdfViewer?._pages?.[pageNumber - 1];
    return pageView?.div || null;
  }

  function getPageCanvas(pageElement) {
    return pageElement?.querySelector?.("canvas") || null;
  }

  function getActiveReader(win) {
    const readers = Zotero.Reader?._readers || [];
    const selectedID =
      win?.Zotero_Tabs?.selectedID ||
      win?.Zotero_Tabs?._selectedID ||
      win?.ZoteroPane?.getSelectedItems?.()?.[0]?.id;
    const selectedReader = selectedID && Zotero.Reader?.getByTabID?.(selectedID);
    if (isPDFReader(selectedReader)) {
      return selectedReader;
    }
    return (
      readers.find((reader) => reader.tabID && reader.tabID === selectedID && isPDFReader(reader)) ||
      readers.find((reader) => reader._tabID && reader._tabID === selectedID && isPDFReader(reader)) ||
      readers.find((reader) => isPDFReader(reader)) ||
      null
    );
  }

  function getContextPageIndex(params) {
    if (Number.isInteger(params?.pageIndex)) {
      return params.pageIndex;
    }
    if (Number.isInteger(params?.pageIndexFromContextMenu)) {
      return params.pageIndexFromContextMenu;
    }
    return undefined;
  }

  function isPDFReader(reader) {
    return reader && (!reader.type || reader.type === "pdf");
  }

  function getReaderJobKey(reader, options) {
    const itemID = reader?._item?.id || reader?.itemID || "unknown";
    const page = options.pageIndex ?? "current";
    return `${itemID}:${options.scope}:${page}`;
  }

  function showReaderToast(reader, message, level) {
    const fallbackWindow = Zotero.getMainWindow?.();
    getPDFViewerContext(reader).then((context) => {
      const doc = context?.doc || fallbackWindow?.document;
      if (!doc?.body) {
        Services.prompt.alert(fallbackWindow, "PDF Image Saver", message);
        return;
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
    }).catch((error) => {
      logError(error);
      Services.prompt.alert(fallbackWindow, "PDF Image Saver", message);
    });
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

  function buildOpenPDFURI(attachment, pageNumber) {
    const libraryPath = getLibraryURIPath(attachment.libraryID);
    return `zotero://open-pdf/${libraryPath}/items/${attachment.key}?page=${pageNumber}`;
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

  function serializeItem(item) {
    if (!item) {
      return null;
    }
    return {
      key: item.key,
      title: item.getField("title"),
      date: item.getField("date"),
      doi: item.getField("DOI"),
    };
  }

  function serializeAttachment(item) {
    return {
      key: item.key,
      title: item.getField("title"),
      content_type: item.attachmentContentType,
    };
  }

  function formatHelperFailure(report) {
    if (report.status === "missing_pymupdf") {
      return "Optional PyMuPDF helper is unavailable.";
    }
    if (report.status === "no_python") {
      return "Optional Python helper was not found.";
    }
    const details = (report.warnings || []).join("; ");
    return `Optional original extraction failed: ${report.status || "unknown"}${details ? ` (${details})` : ""}`;
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

  function sanitizeTitle(value) {
    return String(value || "PDF image").replace(/\s+/g, " ").trim().slice(0, 90);
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
    return QUALITY[value] ? value : "medium";
  }

  function getPreviewDuplicateKey(attachment, preview) {
    const bbox = preview.bboxNormalized.map((value) => value.toFixed(4)).join(",");
    return `${attachment.libraryID}:${attachment.key}:${preview.pageIndex}:${preview.quality}:${bbox}`;
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

  function estimateDataURLBytes(dataURL) {
    const base64 = String(dataURL).split(",")[1] || "";
    return Math.round((base64.length * 3) / 4);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 102.4) / 10} KB`;
    }
    return `${Math.round(bytes / 104857.6) / 10} MB`;
  }

  function round6(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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
      return error.message;
    }
    return String(error);
  }

  return {
    init,
    startup,
    shutdown,
    addToWindow,
    removeFromWindow,
    get started() {
      return started;
    },
  };
})();
