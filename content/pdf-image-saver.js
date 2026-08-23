var PdfImageSaver = (() => {
  const ADDON_REF = "pdf-image-saver";
  const HELPER_SCHEMA_VERSION = "zotero-pdf-image-saver/v1";
  const SHARED_DB_SCHEMA_VERSION = 2;
  const SHARED_LIBRARY_LOCATOR_FILE_NAME = "library.json";
  const SHARED_LIBRARY_LOCATOR_SCHEMA_VERSION = 1;
  const SHARED_LIBRARY_LOCATOR_PRODUCER = "zotero-pdf-image-saver";
  const INDEX_INTERACTIVITY_VERSION = "10";
  const SHARED_DB_PATH_SEGMENTS = ["ZLK", "paper-image-library"];
  const SHARED_DB_FILE_NAME = "paper_images.sqlite";
  const INVALID_SHARED_DB_PATH_TOKEN = "invalid-shared-db-path";
  const BRIDGE_ENDPOINT = "/pdf-image-saver/bridge";
  const BRIDGE_URL = `http://127.0.0.1:23119${BRIDGE_ENDPOINT}`;
  const BRIDGE_STATUS_COMMANDS = ["status", "getStatus"];
  const BRIDGE_PROVENANCE_COMMANDS = ["openPdfByImageId", "selectParentItemByImageId", "selectPdfAttachmentByImageId"];
  const BRIDGE_LIBRARY_COMMANDS = ["deleteImages", "exportImages", "importImages", "refreshLibrary"];
  const GLOBAL_LIBRARY_VIEW_VERSION = "37";
  const GLOBAL_LIBRARY_DIRECTORY_NAME = "paper-image-library-view";
  const GLOBAL_LIBRARY_HTML_NAME = "paper-image-library.html";
  const GLOBAL_LIBRARY_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
  const GLOBAL_LIBRARY_ROW_FIELDS = [
    "image_id", "title", "year", "doi", "page_number", "created_at", "source_region_key",
    "preview_duplicate_key", "parent_item_key", "pdf_attachment_key", "zotero_open_pdf_uri",
    "library_id", "library_type", "group_id", "bbox_json", "palette_json", "image_category",
    "color_family", "style_tags_json", "quality", "detector", "rendered_width", "rendered_height",
    "dominant_hex", "contrast_hex", "content_sha256", "origin_type", "source_match_status",
    "imported_at", "zotero_select_item_uri", "image_bytes",
  ];
  const LEGACY_PREVIEW_SYNC_VERSION = "2";
  const LEGACY_PREVIEW_SYNC_PREF = "legacyPreviewSyncVersion";
  const LEGACY_PREVIEW_SYNC_MAX_ITEMS = 4000;
  const SHARED_LIBRARY_PACKAGE_FORMAT = "paper-image-library-share/v1";
  const SHARED_LIBRARY_PACKAGE_EXTENSION = ".pislib";
  const SHARED_LIBRARY_PACKAGE_MAX_IMAGES = 1000;
  const SHARED_LIBRARY_PACKAGE_MAX_BYTES = 512 * 1024 * 1024;
  const SHARED_LIBRARY_PACKAGE_MAX_FILE_BYTES = 720 * 1024 * 1024;
  const PREF_BRANCH = "extensions.pdfImageSaver.";
  const LEGACY_PREFERENCE_NAMES = [
    "minImageArea", "defaultQuality", "defaultImageCategory", "maxIndexBytesMB",
    "maxPageImages", "maxDocumentImages", "helperTimeoutSeconds", "pythonPath", "duplicateGuard",
  ];
  const DEFAULT_MIN_AREA = 0.004;
  const DEFAULT_MAX_INDEX_BYTES_MB = 6;
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
    low: { label: "低", maxWidth: 240, jpegQuality: 0.62, estimate: "约 20–80 KB/张" },
    medium: { label: "中", maxWidth: 480, jpegQuality: 0.78, estimate: "约 60–220 KB/张" },
    high: { label: "高", maxWidth: 960, jpegQuality: 0.9, estimate: "约 180–750 KB/张" },
  };
  const IMAGE_CATEGORIES = {
    auto: { label: "自动判断", mark: "自动" },
    metric_curve: { label: "指标／训练曲线", mark: "曲线" },
    heatmap: { label: "热图／矩阵图", mark: "热图" },
    bar_chart: { label: "柱状／条形图", mark: "柱图" },
    distribution: { label: "分布／降维图", mark: "分布" },
    qualitative: { label: "定性结果对比", mark: "对比" },
    architecture: { label: "网络／模型结构图", mark: "结构" },
    pipeline: { label: "方法流程图", mark: "流程" },
    table: { label: "科研表格", mark: "表格" },
    equation: { label: "公式", mark: "公式" },
    schematic: { label: "装置／原理示意", mark: "示意" },
    photo: { label: "照片／医学影像", mark: "影像" },
    chart: { label: "图表", mark: "图表" },
    diagram: { label: "流程图／示意图", mark: "流程" },
    figure: { label: "其他插图", mark: "插图" },
  };
  const COLOR_FAMILY_LABELS = {
    red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", cyan: "青色", blue: "蓝色",
    purple: "紫色", pink: "粉色", brown: "棕色", gray: "灰色", black: "黑色", white: "白色", unknown: "未知",
  };
  const LAYOUT_HINT_LABELS = { wide: "横向", tall: "纵向", square: "近方形", unknown: "未知" };
  const SLIDE_SLOT_LABELS = { hero: "主视觉区", side: "侧栏区", footer: "底部区", inset: "嵌入区", unknown: "未知" };
  const ROLE_HINT_LABELS = { result: "结果主图", method: "方法说明", evidence: "证据支撑", compare: "对比展示", context: "背景说明", unknown: "未知" };
  const INSERT_SIZE_LABELS = { large: "大", medium: "中", small: "小", unknown: "未知" };
  const ANCHOR_LABELS = {
    center: "居中", left: "左侧", right: "右侧", top: "顶部", bottom: "底部",
    "top-left": "左上", "top-right": "右上", "bottom-left": "左下", "bottom-right": "右下",
  };
  const CAPTION_TONE_LABELS = { result: "结果", method: "方法", compare: "对比", context: "背景", unknown: "未知" };
  const STORY_BEAT_LABELS = { hook: "引入", setup: "铺垫", method: "方法", result: "结果", compare: "对比", close: "收束", unknown: "未知" };
  const STYLE_TAG_LABELS = {
    research: "科研绘图", matrix: "矩阵", table: "表格", bright: "明亮", dark: "深色", balanced: "明暗均衡",
    colorful: "多彩", muted: "低饱和", "moderate-saturation": "中等饱和", warm: "暖色", cool: "冷色",
    grid: "网格", cells: "单元格", wide: "横向", tall: "纵向", square: "近方形",
    result: "结果", method: "方法", evidence: "证据", compare: "对比", context: "背景",
    hero: "主视觉区", side: "侧栏区", footer: "底部区", inset: "嵌入区",
    plot: "科研图表", axes: "坐标轴", metrics: "指标", curve: "曲线", "color-scale": "色标", heatmap: "热图",
    bars: "柱形", distribution: "分布", points: "散点", "result-panels": "结果面板", "visual-comparison": "可视化对比",
    network: "网络结构", blocks: "模块", connections: "连接关系", flow: "流程", steps: "步骤", boxes: "方框",
    circuit: "电路", lines: "线条", math: "数学公式", symbols: "数学符号", "photo-ref": "照片参考", "figure-ref": "插图参考",
    banner: "横幅", landscape: "横版", portrait: "竖版", stack: "堆叠", tile: "方形分块",
    "lead-visual": "主视觉", pipeline: "方法流程", support: "辅助证据", "before-after": "前后对比", background: "背景",
  };
  const RESULT_IMAGE_CATEGORIES = new Set([
    "metric_curve", "heatmap", "bar_chart", "distribution", "qualitative", "table", "chart",
  ]);
  const METHOD_IMAGE_CATEGORIES = new Set(["architecture", "pipeline", "diagram", "schematic"]);
  const readerHandlers = [];
  const windowState = new WeakMap();
  const readerToolbarWorkflowStates = new WeakMap();
  const activeJobs = new Set();
  const recentIndexSaves = new Map();

  let config = null;
  let helperScriptPathPromise = null;
  let pythonCommandPromise = null;
  let sharedDatabaseConnection = null;
  let bridgeToken = "";
  let bridgeEndpointHandler = null;
  let readerToolbarRefreshGeneration = 0;
  let indexInteractivityScriptCache = null;
  let started = false;
  let shuttingDown = false;
  let shutdownPromise = null;
  let applicationShutdownObserver = null;

  function init(data) {
    config = data;
  }

  async function startup() {
    shuttingDown = false;
    shutdownPromise = null;
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);
    registerApplicationShutdownObserver();

    try {
      migrateLegacyPreferenceBranch();
    } catch (error) {
      logError(error);
    }

    try {
      registerReaderHandlers();
    } catch (error) {
      logError(error);
    }
    try {
      await cleanupStaleTempDirectories();
    } catch (error) {
      logError(error);
    }
    // Publish the frozen library.json locator so the PPT add-in resolves the
    // shared paper_images.sqlite path on first run. Best-effort; never touches
    // Zotero internal databases and never blocks startup on a write failure.
    try {
      await safeRefreshSharedStateFromPreferences();
    } catch (error) {
      logError(error);
    }
    try {
      await removeDirectoryIfExists(PathUtils.join(PathUtils.tempDir, ADDON_REF, "interactive-previews"));
    } catch (error) {
      safeLogError(error);
    }
    const mainWindows = Array.from(Zotero.getMainWindows?.() || []);
    const primaryWindow = Zotero.getMainWindow?.();
    if (primaryWindow && !mainWindows.includes(primaryWindow)) {
      mainWindows.push(primaryWindow);
    }
    for (const win of mainWindows) {
      try {
        await addToWindow(win);
      } catch (error) {
        logError(error);
      }
    }
    started = true;
    refreshExistingReaderToolbars();
    scheduleExistingReaderToolbarRefreshes();
    log("已启动");
  }

  function shutdown() {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    shuttingDown = true;
    shutdownPromise = (async () => {
      unregisterApplicationShutdownObserver();
      readerToolbarRefreshGeneration += 1;
      for (const reader of Array.from(Zotero.Reader?._readers || [])) {
        disposeReaderUI(reader);
      }
      unregisterReaderHandlers();
      for (const win of Array.from(Zotero.getMainWindows?.() || [])) {
        await removeFromWindow(win);
      }
      activeJobs.clear();
      helperScriptPathPromise = null;
      pythonCommandPromise = null;
      await disableSharedLibraryBridge();
      await closeSharedDatabaseConnection();
      started = false;
      log("已停止");
    })();
    return shutdownPromise;
  }

  function registerApplicationShutdownObserver() {
    if (applicationShutdownObserver || typeof Services?.obs?.addObserver !== "function") {
      return false;
    }
    applicationShutdownObserver = {
      observe() {
        void shutdown().catch((error) => logError(error));
      },
    };
    Services.obs.addObserver(applicationShutdownObserver, "quit-application-granted");
    return true;
  }

  function unregisterApplicationShutdownObserver() {
    if (!applicationShutdownObserver) {
      return false;
    }
    try {
      Services?.obs?.removeObserver?.(applicationShutdownObserver, "quit-application-granted");
    } catch (error) {
      logError(error);
    }
    applicationShutdownObserver = null;
    return true;
  }

  async function addToWindow(win) {
    if (!win || windowState.has(win)) {
      return;
    }

    const doc = win.document;
    const toolsPopup = doc.getElementById("menu_ToolsPopup");
    doc.getElementById("pdf-image-saver-tools-menuitem")?.remove();
    doc.getElementById("pdf-image-saver-library-menuitem")?.remove();
    doc.getElementById("pdf-image-saver-preview-menuitem")?.remove();
    doc.getElementById("pdf-image-saver-delete-menuitem")?.remove();
    doc.getElementById("pdf-image-saver-diagnostics-menuitem")?.remove();
    const menuitem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    menuitem.id = "pdf-image-saver-tools-menuitem";
    menuitem.setAttribute("label", "保存 PDF 图片");
    menuitem.setAttribute("tooltiptext", "从当前 PDF 页面框选并保存图片");
    menuitem.addEventListener("command", () => {
      void startClipFromActiveReader(win, getDefaultQualityKey());
    });
    const libraryItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    libraryItem.id = "pdf-image-saver-library-menuitem";
    libraryItem.setAttribute("label", "打开全部论文图片库");
    libraryItem.setAttribute("tooltiptext", "从本地外部数据库读取全部已保存图片，并在默认浏览器中筛选、排序和高清查看");
    libraryItem.addEventListener("command", () => {
      void openGlobalImageLibrary(win);
    });
    const previewItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    previewItem.id = "pdf-image-saver-preview-menuitem";
    previewItem.setAttribute("label", "在全部图片库查看当前论文图片");
    previewItem.setAttribute("tooltiptext", "打开唯一外部数据库图片库；不创建 HTML 预览附件");
    previewItem.addEventListener("command", () => {
      void openSavedPreviewFromActiveReader(win);
    });
    const deleteItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    deleteItem.id = "pdf-image-saver-delete-menuitem";
    deleteItem.setAttribute("label", "删除当前论文图片库记录");
    deleteItem.setAttribute("tooltiptext", "仅从外部图片库软删除当前论文图片，不删除 Zotero 文献、PDF 或原始附件");
    deleteItem.addEventListener("command", () => {
      void deleteSavedImagesFromActiveReader(win);
    });
    const diagnosticsItem = doc.createXULElement
      ? doc.createXULElement("menuitem")
      : doc.createElement("menuitem");
    diagnosticsItem.id = "pdf-image-saver-diagnostics-menuitem";
    diagnosticsItem.setAttribute("label", "PDF 图片插件诊断");
    diagnosticsItem.setAttribute("tooltiptext", "检查阅读器、图片助手和外部图片库状态");
    diagnosticsItem.addEventListener("command", () => {
      void showDiagnostics(win);
    });
    toolsPopup?.appendChild(menuitem);
    toolsPopup?.appendChild(libraryItem);
    toolsPopup?.appendChild(previewItem);
    toolsPopup?.appendChild(deleteItem);
    toolsPopup?.appendChild(diagnosticsItem);
    windowState.set(win, { menuitems: [menuitem, libraryItem, previewItem, deleteItem, diagnosticsItem] });
  }

  async function removeFromWindow(win) {
    disposeReaderDocumentUI(win?.document);
    const state = windowState.get(win);
    if (!state) {
      return;
    }
    for (const menuitem of state.menuitems || []) {
      menuitem?.remove();
    }
    windowState.delete(win);
  }

  async function handleMainWindowUnload(win) {
    await removeFromWindow(win);
    const remainingWindows = Array.from(Zotero.getMainWindows?.() || [])
      .filter((candidate) => candidate && candidate !== win && candidate.closed !== true);
    if (remainingWindows.length) {
      return false;
    }
    // Do not make Zotero wait for external SQLite teardown while the native
    // window is unloading. Waiting here leaves a chrome-only strip visible
    // when a real library or bridge request takes longer than the window.
    void shutdown().catch((error) => logError(error));
    return true;
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
    const safeHandler = (event) => {
      try {
        return handler(event);
      } catch (error) {
        logError(error);
      }
    };
    Zotero.Reader.registerEventListener(type, safeHandler, config.id);
    readerHandlers.push({ type, handler: safeHandler });
  }

  function migrateLegacyPreferenceBranch(preferenceService = typeof Services !== "undefined" ? Services.prefs : null) {
    if (!preferenceService || typeof preferenceService.prefHasUserValue !== "function") {
      return 0;
    }
    let migrated = 0;
    for (const name of LEGACY_PREFERENCE_NAMES) {
      const canonicalKey = `${PREF_BRANCH}${name}`;
      const legacyKey = `extensions.zotero.${canonicalKey}`;
      if (preferenceService.prefHasUserValue(canonicalKey) || !preferenceService.prefHasUserValue(legacyKey)) {
        continue;
      }
      const type = preferenceService.getPrefType(legacyKey);
      if (type === preferenceService.PREF_STRING) {
        preferenceService.setStringPref(canonicalKey, preferenceService.getStringPref(legacyKey));
      } else if (type === preferenceService.PREF_INT) {
        preferenceService.setIntPref(canonicalKey, preferenceService.getIntPref(legacyKey));
      } else if (type === preferenceService.PREF_BOOL) {
        preferenceService.setBoolPref(canonicalKey, preferenceService.getBoolPref(legacyKey));
      } else {
        continue;
      }
      migrated += 1;
    }
    return migrated;
  }

  function refreshExistingReaderToolbars() {
    let refreshed = 0;
    for (const reader of Array.from(Zotero.Reader?._readers || [])) {
      try {
        if (refreshExistingReaderToolbar(reader)) {
          refreshed += 1;
        }
      } catch (error) {
        logError(error);
      }
    }
    return refreshed;
  }

  function refreshExistingReaderToolbar(reader) {
    if (!isPDFReader(reader)) {
      return false;
    }
    const doc = getReaderToolbarDocument(reader);
    if (!doc) {
      return false;
    }
    if (doc.getElementById?.("pdf-image-saver-toolbar-group")) {
      return true;
    }
    const customSections = getReaderToolbarCustomSections(doc);
    if (!customSections || typeof customSections.appendChild !== "function") {
      return false;
    }
    onRenderToolbar({
      reader,
      doc,
      append(...nodes) {
        const section = doc.createElement("div");
        section.className = "section";
        if (typeof section.append === "function") {
          section.append(...nodes);
        } else {
          for (const node of nodes) {
            section.appendChild(node);
          }
        }
        customSections.appendChild(section);
      },
    });
    return !!doc.getElementById?.("pdf-image-saver-toolbar-group");
  }

  function getReaderToolbarCustomSections(doc) {
    try {
      return doc?.querySelector?.(".toolbar > .end > .custom-sections")
        || doc?.querySelector?.(".toolbar .end .custom-sections")
        || null;
    } catch (_error) {
      return null;
    }
  }

  function getReaderToolbarDocument(reader) {
    const windows = [
      reader?._iframeWindow,
      reader?._iframe?.contentWindow,
    ];
    for (const iframeWindow of windows) {
      const doc = iframeWindow?.document;
      if (doc && getReaderToolbarCustomSections(doc)) {
        return doc;
      }
    }
    return null;
  }

  function scheduleExistingReaderToolbarRefreshes() {
    const generation = ++readerToolbarRefreshGeneration;
    for (const delay of [120, 500, 1500, 3500]) {
      void Zotero.Promise.delay(delay).then(() => {
        if (started && generation === readerToolbarRefreshGeneration) {
          refreshExistingReaderToolbars();
        }
      }).catch((error) => {
        logError(error);
      });
    }
  }

  function getReaderInteractionDocuments(reader, toolbarDoc) {
    const documents = [];
    const seen = new Set();
    const addDocument = (doc) => {
      if (!doc || seen.has(doc) || typeof doc.addEventListener !== "function") {
        return;
      }
      seen.add(doc);
      documents.push(doc);
    };
    const addWindowDocument = (win) => {
      try {
        addDocument(win?.document);
      } catch (_error) {
        // Cross-document reader internals are optional event sources.
      }
    };
    addDocument(toolbarDoc);
    addWindowDocument(reader?._iframeWindow || reader?._iframe?.contentWindow);
    for (const view of [
      reader?._lastView,
      reader?._primaryView,
      reader?._internalReader?._lastView,
      reader?._internalReader?._primaryView,
    ]) {
      addWindowDocument(view?._iframeWindow || view?._iframe?.contentWindow);
    }
    for (let index = 0; index < documents.length && index < 12; index += 1) {
      try {
        for (const frame of Array.from(documents[index].querySelectorAll?.("iframe") || [])) {
          addWindowDocument(frame?.contentWindow);
          addDocument(frame?.contentDocument);
        }
      } catch (_error) {
        // Inaccessible nested frames cannot participate in reader clicks.
      }
    }
    return documents;
  }

  function normalizeReaderToolbarWorkflowMode(mode) {
    return [
      "clip", "clip-review", "clip-save",
      "page", "page-review", "page-save",
      "original",
    ].includes(mode) ? mode : "idle";
  }

  function getReaderToolbarWorkflowState(reader) {
    if (!reader || (typeof reader !== "object" && typeof reader !== "function")) {
      return null;
    }
    let state = readerToolbarWorkflowStates.get(reader);
    if (!state) {
      state = { mode: "idle", subscribers: new Set() };
      readerToolbarWorkflowStates.set(reader, state);
    }
    return state;
  }

  function getReaderToolbarWorkflowMode(reader) {
    return getReaderToolbarWorkflowState(reader)?.mode || "idle";
  }

  function setReaderToolbarWorkflowMode(reader, mode) {
    if (shuttingDown) {
      return "idle";
    }
    const normalizedMode = normalizeReaderToolbarWorkflowMode(mode);
    const state = getReaderToolbarWorkflowState(reader);
    if (!state) {
      return normalizedMode;
    }
    state.mode = normalizedMode;
    for (const subscriber of Array.from(state.subscribers)) {
      try {
        subscriber(normalizedMode);
      } catch (error) {
        safeLogError(error);
      }
    }
    return normalizedMode;
  }

  function disposeReaderUI(reader) {
    const toolbarDoc = getReaderToolbarDocument(reader);
    const docs = getReaderInteractionDocuments(reader, toolbarDoc);
    for (const doc of docs) {
      disposeReaderDocumentUI(doc);
    }
    readerToolbarWorkflowStates.delete(reader);
  }

  function disposeReaderDocumentUI(doc) {
    if (!doc) {
      return;
    }
    const overlay = doc.getElementById?.("pdf-image-saver-selection-overlay");
    if (overlay) {
      overlay.__pdfImageSaverOnSessionEnd = null;
      cleanupSelectionOverlay(overlay);
    }
    const review = doc.getElementById?.("pdf-image-saver-preview-review-dialog");
    review?.__pdfImageSaverReviewResolve?.();
    review?.remove?.();
    removeReaderToast(doc);
    const managedGroup = doc.__pdfImageSaverToolbarGroup;
    doc.__pdfImageSaverToolbarGroup = null;
    managedGroup?.__pdfImageSaverDestroy?.();
    managedGroup?.remove?.();
    const toolbarGroup = doc.getElementById?.("pdf-image-saver-toolbar-group");
    if (toolbarGroup && toolbarGroup !== managedGroup) {
      toolbarGroup.__pdfImageSaverDestroy?.();
      toolbarGroup.remove?.();
    }
  }

  function subscribeReaderToolbarWorkflowMode(reader, subscriber) {
    const state = getReaderToolbarWorkflowState(reader);
    if (!state || typeof subscriber !== "function") {
      return () => {};
    }
    let active = true;
    state.subscribers.add(subscriber);
    subscriber(state.mode);
    return () => {
      if (!active) {
        return;
      }
      active = false;
      state.subscribers.delete(subscriber);
    };
  }

  function getReaderWorkflowStageLabel(mode) {
    const labels = {
      clip: "正在框选",
      "clip-review": "等待确认框选图片",
      "clip-save": "正在保存框选图片",
      page: "正在生成整页图片",
      "page-review": "等待确认整页图片",
      "page-save": "正在保存整页图片",
      original: "正在处理嵌入原图",
    };
    return labels[normalizeReaderToolbarWorkflowMode(mode)] || "正在处理图片";
  }

  function beginReaderMenuWorkflow(reader, modes) {
    const allowedModes = Array.from(new Set((Array.isArray(modes) ? modes : [])
      .map(normalizeReaderToolbarWorkflowMode)
      .filter((mode) => mode !== "idle")));
    if (!allowedModes.length) {
      return null;
    }
    const currentMode = getReaderToolbarWorkflowMode(reader);
    if (currentMode !== "idle") {
      showReaderToast(
        reader,
        `当前图片采集尚未结束（${getReaderWorkflowStageLabel(currentMode)}）。请先完成或取消当前操作。`,
        "warning",
      );
      return null;
    }
    let active = true;
    setReaderToolbarWorkflowMode(reader, allowedModes[0]);
    return {
      transition(mode) {
        const normalizedMode = normalizeReaderToolbarWorkflowMode(mode);
        if (!active || !allowedModes.includes(normalizedMode)) {
          return false;
        }
        setReaderToolbarWorkflowMode(reader, normalizedMode);
        return true;
      },
      finish() {
        if (!active) {
          return false;
        }
        active = false;
        if (allowedModes.includes(getReaderToolbarWorkflowMode(reader))) {
          setReaderToolbarWorkflowMode(reader, "idle");
        }
        return true;
      },
    };
  }

  function invokeReaderWorkflowCallback(callback, ...args) {
    if (typeof callback !== "function") {
      return;
    }
    try {
      callback(...args);
    } catch (error) {
      safeLogError(error);
    }
  }

  function reportReaderWorkflowFailure(reader, error) {
    safeLogError(error);
    showReaderToast(reader, formatUserFacingError(error), "error");
    return null;
  }

  function startReaderClipMenuWorkflow(reader, qualityKey, explicitPageIndex, options = {}, handler = startClipFromReader) {
    const safeOptions = normalizeOptionsObject(options);
    const controller = beginReaderMenuWorkflow(reader, ["clip", "clip-review", "clip-save"]);
    if (!controller) {
      return null;
    }
    const onSelectionAccepted = safeOptions.onSelectionAccepted;
    const onReviewResolved = safeOptions.onReviewResolved;
    const onSessionEnd = safeOptions.onSessionEnd;
    let ended = false;
    const finish = () => {
      if (ended) {
        return;
      }
      ended = true;
      controller.finish();
      invokeReaderWorkflowCallback(onSessionEnd);
    };
    let result;
    try {
      result = handler(reader, qualityKey, explicitPageIndex, {
        ...safeOptions,
        onSelectionAccepted() {
          controller.transition("clip-review");
          invokeReaderWorkflowCallback(onSelectionAccepted);
        },
        onReviewResolved(confirmed) {
          if (confirmed) {
            controller.transition("clip-save");
          }
          invokeReaderWorkflowCallback(onReviewResolved, confirmed);
        },
        onSessionEnd: finish,
      });
    } catch (error) {
      finish();
      return reportReaderWorkflowFailure(reader, error);
    }
    if (result && typeof result.then === "function") {
      return Promise.resolve(result).catch((error) => {
        finish();
        return reportReaderWorkflowFailure(reader, error);
      });
    }
    return result;
  }

  function startReaderReviewMenuWorkflow(reader, {
    modes,
    options = {},
    handler,
  } = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const controller = beginReaderMenuWorkflow(reader, modes);
    if (!controller || typeof handler !== "function") {
      controller?.finish?.();
      return null;
    }
    const onReviewStart = safeOptions.onReviewStart;
    const onSaveStart = safeOptions.onSaveStart;
    const onSessionEnd = safeOptions.onSessionEnd;
    let result;
    try {
      result = handler(reader, {
        ...safeOptions,
        onReviewStart() {
          controller.transition(modes[1] || modes[0]);
          invokeReaderWorkflowCallback(onReviewStart);
        },
        onSaveStart() {
          controller.transition(modes[2] || modes[0]);
          invokeReaderWorkflowCallback(onSaveStart);
        },
      });
    } catch (error) {
      controller.finish();
      invokeReaderWorkflowCallback(onSessionEnd);
      return reportReaderWorkflowFailure(reader, error);
    }
    const finish = () => {
      controller.finish();
      invokeReaderWorkflowCallback(onSessionEnd);
    };
    if (result && typeof result.then === "function") {
      return Promise.resolve(result)
        .catch((error) => reportReaderWorkflowFailure(reader, error))
        .finally(finish);
    }
    finish();
    return result;
  }

  function startReaderPageMenuWorkflow(reader, options = {}, handler = savePagePreviewIndex) {
    return startReaderReviewMenuWorkflow(reader, {
      modes: ["page", "page-review", "page-save"],
      options,
      handler,
    });
  }

  function startReaderOriginalMenuWorkflow(reader, options = {}, handler = confirmAndSaveOriginalImagesFromReader) {
    return startReaderReviewMenuWorkflow(reader, {
      modes: ["original"],
      options,
      handler,
    });
  }

  function onRenderToolbar(event) {
    if (shuttingDown) {
      return;
    }
    const { reader, doc, append } = event;
    if (!isPDFReader(reader) || !doc || typeof append !== "function") {
      return;
    }

    ensureReaderStyles(doc);
    const managedGroup = doc.__pdfImageSaverToolbarGroup;
    doc.__pdfImageSaverToolbarGroup = null;
    managedGroup?.__pdfImageSaverDestroy?.();
    managedGroup?.remove?.();
    const previousGroup = doc.getElementById("pdf-image-saver-toolbar-group");
    if (previousGroup && previousGroup !== managedGroup) {
      previousGroup.__pdfImageSaverDestroy?.();
      previousGroup.remove?.();
    }
    const group = doc.createElement("span");
    group.id = "pdf-image-saver-toolbar-group";
    group.className = "pdf-image-saver-toolbar-group";
    group.setAttribute?.("aria-label", "PDF 图片采集工具");
    group.title = "PDF 图片采集工具";
    group.__pdfImageSaverDestroyed = false;
    disableToolbarWindowDragging(group);
    const outsideEventTargets = getReaderInteractionDocuments(reader, doc);
    const qualityControl = createToolbarChoiceControl(doc, {
      id: "pdf-image-saver-quality-control",
      className: "pdf-image-saver-toolbar-quality-choice",
      ariaLabel: "保存画质",
      initialValue: getDefaultQualityKey(),
      normalize: normalizeQualityKey,
      triggerLabel: (key) => `清晰度：${QUALITY[normalizeQualityKey(key)].label}`,
      title: (key) => `保存画质：${getQualityLabelWithEstimate(key)}。单击选择。`,
      options: Object.keys(QUALITY).map((key) => ({
        value: key,
        label: getQualityLabelWithEstimate(key),
      })),
      outsideEventTargets,
      onChange(key) {
        const qualityKey = normalizeQualityKey(key);
        setStringPref("defaultQuality", qualityKey);
      },
    });
    const categoryControl = createToolbarChoiceControl(doc, {
      id: "pdf-image-saver-category-control",
      className: "pdf-image-saver-toolbar-category-choice",
      ariaLabel: "图片类别",
      initialValue: getDefaultImageCategoryKey(),
      normalize: normalizeImageCategoryKey,
      triggerLabel: (key) => `类别：${IMAGE_CATEGORIES[normalizeImageCategoryKey(key)].label}`,
      title: (key) => `图片类别：${getImageCategoryLabel(key)}。单击选择。`,
      options: Object.keys(IMAGE_CATEGORIES).map((key) => ({
        value: key,
        label: getChineseImageCategoryLabel(key),
      })),
      outsideEventTargets,
      onChange(key) {
        setStringPref("defaultImageCategory", normalizeImageCategoryKey(key));
      },
    });

    const button = createToolbarActionButton(doc, "pdf-image-saver-clip-button", "框选保存", "开始框选当前页图片");
    const paperButton = createToolbarActionButton(doc, "pdf-image-saver-current-paper-button", "本篇图片", "在浏览器查看当前论文已保存图片");
    const libraryButton = createToolbarActionButton(doc, "pdf-image-saver-saved-button", "全部图库", "在默认浏览器打开全部论文图片库；可筛选、排序和高清查看");
    const toolbarHandlers = normalizeOptionsObject(event.handlers);
    const openCurrentPaper = typeof toolbarHandlers.openCurrentPaper === "function"
      ? toolbarHandlers.openCurrentPaper
      : (currentReader) => openGlobalImageLibrary(Zotero.getMainWindow?.(), currentReader);
    const openLibrary = typeof toolbarHandlers.openLibrary === "function"
      ? toolbarHandlers.openLibrary
      : openGlobalImageLibrary;

    let toolbarMode = getReaderToolbarWorkflowMode(reader);
    const applyToolbarMode = (mode) => {
      toolbarMode = normalizeReaderToolbarWorkflowMode(mode);
      const busy = toolbarMode !== "idle";
      qualityControl.setDisabled(busy);
      categoryControl.setDisabled(busy);
      paperButton.disabled = busy;
      libraryButton.disabled = busy;
      group.setAttribute?.("aria-busy", busy ? "true" : "false");
      group.setAttribute?.("data-mode", toolbarMode);
      if (toolbarMode === "clip") {
        button.disabled = true;
        button.textContent = "请框选";
        button.setAttribute?.("aria-label", "正在框选图片");
        button.title = "请在当前页按住鼠标左键拖动框选；按 Esc 或右键取消";
        qualityControl.setTitle("正在框选，清晰度不可修改");
        categoryControl.setTitle("正在框选，类别不可修改");
        return;
      }
      if (toolbarMode === "clip-review" || toolbarMode === "clip-save") {
        const reviewing = toolbarMode === "clip-review";
        button.disabled = true;
        button.textContent = reviewing ? "等待确认" : "保存中…";
        button.setAttribute?.("aria-label", reviewing ? "等待确认框选图片" : "正在保存框选图片");
        button.title = reviewing
          ? "请在确认窗口检查范围、类别、画质和 PPT 用途，然后确认或取消"
          : "正在写入 Zotero 附件与 PPT 图片库，请稍候";
        qualityControl.setTitle(reviewing ? "等待确认，清晰度不可修改" : "正在保存，清晰度不可修改");
        categoryControl.setTitle(reviewing ? "等待确认，类别请在确认窗口修改" : "正在保存，类别不可修改");
        return;
      }
      if (["page", "page-review", "page-save"].includes(toolbarMode)) {
        const reviewing = toolbarMode === "page-review";
        const saving = toolbarMode === "page-save";
        button.disabled = true;
        button.textContent = reviewing ? "整页待确认" : saving ? "整页保存中" : "整页生成中";
        button.setAttribute?.("aria-label", reviewing
          ? "等待确认整页图片"
          : saving
            ? "正在保存整页图片"
            : "正在生成整页图片");
        button.title = reviewing
          ? "请在确认窗口检查整页图片、类别、画质和 PPT 用途，然后确认或取消"
          : saving
            ? "正在写入已确认的整页图片，请稍候"
            : "正在生成整页图片，生成后需要确认才会保存";
        qualityControl.setTitle(reviewing
          ? "等待确认，清晰度不可修改"
          : saving
            ? "正在保存，清晰度不可修改"
            : "正在生成整页图片，画质不可修改");
        categoryControl.setTitle(reviewing
          ? "等待确认，类别请在确认窗口修改"
          : saving
            ? "正在保存，类别不可修改"
            : "正在生成整页图片，类别不可修改");
        return;
      }
      if (toolbarMode === "original") {
        button.disabled = true;
        button.textContent = "原图处理中";
        button.setAttribute?.("aria-label", "正在处理 PDF 嵌入原图");
        button.title = "正在确认或提取 PDF 嵌入原图，请稍候";
        qualityControl.setTitle("正在处理 PDF 嵌入原图，清晰度不可修改");
        categoryControl.setTitle("正在处理 PDF 嵌入原图，类别不可修改");
        return;
      }
      button.disabled = false;
      button.textContent = "框选保存";
      button.setAttribute?.("aria-label", "框选保存当前页图片");
      paperButton.textContent = "本篇图片";
      paperButton.setAttribute?.("aria-label", "查看当前论文已保存图片");
      libraryButton.textContent = "全部图库";
      libraryButton.setAttribute?.("aria-label", "打开全部论文图片库");
      updateQualityTooltips();
    };
    const setToolbarMode = (mode) => setReaderToolbarWorkflowMode(reader, mode);

    button.addEventListener("click", (domEvent) => {
      domEvent.preventDefault();
      domEvent.stopPropagation();
      if (toolbarMode !== "idle" || button.disabled) {
        return;
      }
      setToolbarMode("clip");
      void startClipFromReader(reader, qualityControl.getValue(), null, {
        imageCategory: categoryControl.getValue(),
        onSelectionAccepted() {
          setToolbarMode("clip-review");
        },
        onReviewResolved(confirmed) {
          if (confirmed) {
            setToolbarMode("clip-save");
          }
        },
        onSessionEnd() {
          setToolbarMode("idle");
        },
      });
    });
    paperButton.addEventListener("click", (domEvent) => {
      domEvent.preventDefault?.();
      domEvent.stopPropagation?.();
      if (toolbarMode !== "idle" || paperButton.disabled) {
        return null;
      }
      return openCurrentPaper(reader);
    });
    libraryButton.addEventListener("click", (domEvent) => {
      domEvent.preventDefault?.();
      domEvent.stopPropagation?.();
      if (toolbarMode !== "idle" || libraryButton.disabled) {
        return null;
      }
      return openLibrary(Zotero.getMainWindow?.(), reader);
    });
    const updateQualityTooltips = () => {
      const qualityKey = qualityControl.getValue();
      const categoryKey = categoryControl.getValue();
      if (toolbarMode !== "idle") {
        return;
      }
      qualityControl.setTitle(`保存画质：${getQualityLabelWithEstimate(qualityKey)}。单击选择。`);
      categoryControl.setTitle(`图片类别：${getImageCategoryLabel(categoryKey)}。单击选择。`);
      button.title = `${buildToolbarActionTooltip("框选保存当前页图片", qualityKey)}；类别：${getChineseImageCategoryLabel(categoryKey)}`;
      paperButton.title = "在全部图片库查看当前论文图片；直接读取外部数据库原图";
      libraryButton.title = "在默认浏览器打开全部论文图片库；直接使用外部数据库中的完整原图，可筛选、排序和定位原文";
    };
    qualityControl.onChange = () => {
      if (toolbarMode !== "idle") {
        return;
      }
      const qualityKey = qualityControl.getValue();
      setStringPref("defaultQuality", qualityKey);
      updateQualityTooltips();
    };
    categoryControl.onChange = () => {
      if (toolbarMode !== "idle") {
        return;
      }
      setStringPref("defaultImageCategory", categoryControl.getValue());
      updateQualityTooltips();
    };
    updateQualityTooltips();
    const unsubscribeWorkflowMode = subscribeReaderToolbarWorkflowMode(reader, applyToolbarMode);
    group.__pdfImageSaverDestroy = () => {
      group.__pdfImageSaverDestroyed = true;
      unsubscribeWorkflowMode();
      qualityControl.destroy();
      categoryControl.destroy();
    };
    doc.__pdfImageSaverToolbarGroup = group;
    // Keep capture actions first, then current-paper and cross-paper review paths.
    group.append(qualityControl.element, button, paperButton, libraryButton, categoryControl.element);
    append(group);
  }

  function createToolbarActionButton(doc, id, label, title) {
    const button = doc.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "pdf-image-saver-toolbar-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute?.("aria-label", label);
    disableToolbarWindowDragging(button);
    bindToolbarButtonEventGuards(button);
    return button;
  }

  function disableToolbarWindowDragging(element) {
    if (!element?.style) {
      return;
    }
    element.style.MozWindowDragging = "no-drag";
    element.style.setProperty?.("-moz-window-dragging", "no-drag", "important");
  }

  function bindToolbarButtonEventGuards(button) {
    for (const type of ["pointerdown", "mousedown", "dblclick"]) {
      button.addEventListener(type, (event) => {
        event.stopPropagation?.();
        if (type === "dblclick") {
          event.preventDefault?.();
        }
      });
    }
  }

  function createToolbarChoiceControl(doc, options = {}) {
    const normalize = typeof options.normalize === "function" ? options.normalize : (value) => value;
    const triggerLabel = typeof options.triggerLabel === "function" ? options.triggerLabel : (value) => String(value || "");
    const title = typeof options.title === "function" ? options.title : () => "单击选择";
    const values = Array.isArray(options.options) ? options.options : [];
    let value = normalize(options.initialValue);
    let disabled = false;
    const element = doc.createElement("span");
    element.id = options.id || "";
    element.className = `pdf-image-saver-toolbar-choice ${options.className || ""}`.trim();
    disableToolbarWindowDragging(element);
    const trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "pdf-image-saver-toolbar-choice-trigger";
    trigger.setAttribute?.("aria-label", options.ariaLabel || "选择");
    trigger.setAttribute?.("aria-haspopup", "menu");
    trigger.setAttribute?.("aria-expanded", "false");
    disableToolbarWindowDragging(trigger);
    const menu = doc.createElement("div");
    menu.className = "pdf-image-saver-toolbar-choice-menu";
    menu.setAttribute?.("role", "menu");
    menu.hidden = true;
    disableToolbarWindowDragging(menu);
    const menuButtons = [];
    const removeDocumentListeners = [];
    const outsideEventTargets = new Set();
    const close = () => {
      menu.hidden = true;
      trigger.setAttribute?.("aria-expanded", "false");
    };
    const toggle = () => {
      const open = !!menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute?.("aria-expanded", open ? "true" : "false");
    };
    const focusMenuItem = (index) => {
      if (disabled || !menuButtons.length) return;
      const bounded = (index + menuButtons.length) % menuButtons.length;
      menuButtons[bounded]?.focus?.();
    };
    let keyboardFocusTimer = 0;
    const openWithKeyboard = (position = "current") => {
      if (disabled) return;
      if (menu.hidden) toggle();
      const selectedIndex = menuButtons.findIndex((item) => item.__pdfImageSaverValue === value);
      const focusIndex = position === "first"
        ? 0
        : position === "last"
          ? menuButtons.length - 1
          : Math.max(0, selectedIndex);
      // Chromium can refuse a same-turn focus request while the just-unhidden menu is laid out.
      if (typeof setTimeout === "function") {
        clearTimeout?.(keyboardFocusTimer);
        keyboardFocusTimer = setTimeout(() => {
          if (!menu.hidden) focusMenuItem(focusIndex);
        }, 0);
      } else {
        focusMenuItem(focusIndex);
      }
    };
    const containsTarget = (target) => {
      if (!target) {
        return false;
      }
      if (target === element || target === trigger || target === menu) {
        return true;
      }
      if (typeof element.contains === "function") {
        try {
          if (element.contains(target)) {
            return true;
          }
        } catch (_error) {
          // Gecko chrome events can expose non-Node retargeting helpers.
        }
      }
      let current = target;
      while (current) {
        if (current === element) {
          return true;
        }
        current = current.parentElement || current.parentNode || null;
      }
      return false;
    };
    const eventHitsControl = (event) => {
      const candidates = [event?.target, event?.originalTarget, event?.explicitOriginalTarget];
      try {
        const path = event?.composedPath?.();
        if (Array.isArray(path)) {
          candidates.push(...path);
        }
      } catch (_error) {
        // Fall back to Gecko's target fields when no composed path is available.
      }
      return candidates.some((target) => containsTarget(target));
    };
    const closeWhenClickingElsewhere = (event) => {
      if (!eventHitsControl(event)) {
        close();
      }
    };
    const bindOutsideEventTarget = (target) => {
      if (!target || outsideEventTargets.has(target) || typeof target.addEventListener !== "function") {
        return;
      }
      outsideEventTargets.add(target);
      for (const type of ["pointerdown", "mousedown", "click", "focusin"]) {
        target.addEventListener(type, closeWhenClickingElsewhere, false);
        removeDocumentListeners.push(() => target.removeEventListener?.(type, closeWhenClickingElsewhere, false));
      }
    };
    bindOutsideEventTarget(doc);
    for (const target of Array.isArray(options.outsideEventTargets) ? options.outsideEventTargets : []) {
      bindOutsideEventTarget(target);
    }
    const closeWhenReaderLosesFocus = (event) => {
      // Capture-phase window listeners also see blur dispatched to menu items.
      if (event?.target !== doc.defaultView) return;
      close();
    };
    if (typeof doc.defaultView?.addEventListener === "function") {
      doc.defaultView.addEventListener("blur", closeWhenReaderLosesFocus, true);
      removeDocumentListeners.push(() => doc.defaultView?.removeEventListener?.("blur", closeWhenReaderLosesFocus, true));
    }
    const update = () => {
      trigger.textContent = `${triggerLabel(value)} ▾`;
      trigger.title = title(value);
      for (const item of menuButtons) {
        const selected = item.__pdfImageSaverValue === value;
        item.setAttribute?.("aria-checked", selected ? "true" : "false");
        item.className = selected
          ? "pdf-image-saver-toolbar-choice-item is-selected"
          : "pdf-image-saver-toolbar-choice-item";
      }
    };
    const setValue = (nextValue, notify = false) => {
      value = normalize(nextValue);
      update();
      if (notify && typeof control.onChange === "function") {
        control.onChange(value);
      }
    };
    for (const option of values) {
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "pdf-image-saver-toolbar-choice-item";
      item.textContent = option.label;
      item.title = option.label;
      item.__pdfImageSaverValue = normalize(option.value);
      item.setAttribute?.("role", "menuitemradio");
      disableToolbarWindowDragging(item);
      item.addEventListener("pointerdown", (event) => {
        if (event?.button !== undefined && event.button !== 0) {
          return;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
        if (disabled) {
          return;
        }
        setValue(item.__pdfImageSaverValue, true);
        close();
      });
      item.addEventListener("mousedown", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
      });
      item.addEventListener("dblclick", (event) => {
        event.stopPropagation?.();
        event.preventDefault?.();
      });
      item.addEventListener("keydown", (event) => {
        const currentIndex = menuButtons.indexOf(item);
        if (event.key === "ArrowDown") {
          event.preventDefault?.();
          event.stopPropagation?.();
          focusMenuItem(currentIndex + 1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault?.();
          event.stopPropagation?.();
          focusMenuItem(currentIndex - 1);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault?.();
          event.stopPropagation?.();
          focusMenuItem(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault?.();
          event.stopPropagation?.();
          focusMenuItem(menuButtons.length - 1);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault?.();
          event.stopPropagation?.();
          close();
          trigger.focus?.();
        }
      });
      item.addEventListener("click", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        if (disabled) {
          return;
        }
        if (!menu.hidden || value !== item.__pdfImageSaverValue) {
          setValue(item.__pdfImageSaverValue, true);
        }
        close();
      });
      menuButtons.push(item);
      menu.appendChild(item);
    }
    const guardTriggerPointerEvent = (event) => {
      if (event?.button !== undefined && event.button !== 0) {
        return;
      }
      event.stopPropagation?.();
    };
    trigger.addEventListener("pointerdown", guardTriggerPointerEvent);
    trigger.addEventListener("mousedown", guardTriggerPointerEvent);
    trigger.addEventListener("click", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (disabled) {
        return;
      }
      toggle();
    });
    trigger.addEventListener("dblclick", (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault?.();
        event.stopPropagation?.();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault?.();
        event.stopPropagation?.();
        openWithKeyboard("current");
        return;
      }
      if (event.key === "Home") {
        event.preventDefault?.();
        event.stopPropagation?.();
        openWithKeyboard("first");
        return;
      }
      if (event.key === "ArrowUp" || event.key === "End") {
        event.preventDefault?.();
        event.stopPropagation?.();
        openWithKeyboard("last");
      }
    });
    element.append(trigger, menu);
    const control = {
      element,
      trigger,
      menu,
      onChange: null,
      getValue() {
        return value;
      },
      setDisabled(nextDisabled) {
        disabled = !!nextDisabled;
        trigger.disabled = disabled;
        for (const item of menuButtons) {
          item.disabled = disabled;
        }
        if (disabled) {
          close();
        }
      },
      setTitle(nextTitle) {
        trigger.title = String(nextTitle || "");
      },
      addOutsideEventTarget(target) {
        bindOutsideEventTarget(target);
      },
      destroy() {
        close();
        clearTimeout?.(keyboardFocusTimer);
        while (removeDocumentListeners.length) {
          removeDocumentListeners.pop()();
        }
      },
    };
    update();
    return control;
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
    const savePage = typeof handlers.savePage === "function" ? handlers.savePage : savePagePreviewIndex;
    const saveOriginal = typeof handlers.saveOriginal === "function" ? handlers.saveOriginal : confirmAndSaveOriginalImagesFromReader;
    const openSaved = typeof handlers.openSaved === "function" ? handlers.openSaved : (currentReader) => openGlobalImageLibrary(Zotero.getMainWindow?.(), currentReader);
    const openLibrary = typeof handlers.openLibrary === "function" ? handlers.openLibrary : openGlobalImageLibrary;
    const diagnostics = typeof handlers.diagnostics === "function" ? handlers.diagnostics : showReaderDiagnostics;
    const actions = [];
    const defaultQualityKey = getDefaultQualityKey();
    const defaultQuality = QUALITY[defaultQualityKey];
    const defaultCategoryKey = getDefaultImageCategoryKey();
    const pageOriginalMaxImages = getHelperMaxImages("page");
    const documentOriginalMaxImages = getHelperMaxImages("document");

    const clipQualityOrder = [defaultQualityKey, ...Object.keys(QUALITY).filter((key) => key !== defaultQualityKey)];
    for (const key of clipQualityOrder) {
      actions.push({
        label: `框选保存${key === defaultQualityKey ? "（当前默认）" : ""}；${QUALITY[key].label}画质；${formatQualityEstimateShort(key)}；初始类别：${getImageCategoryLabel(defaultCategoryKey)}`,
        onCommand() {
          return startReaderClipMenuWorkflow(reader, key, getContextPageIndex(params), {
            imageCategory: defaultCategoryKey,
          }, startClip);
        },
      });
    }

    actions.push({
      label: `整页图片并确认；${defaultQuality.label}画质；${formatQualityEstimateShort(defaultQualityKey)}；初始类别：${getImageCategoryLabel(defaultCategoryKey)}`,
      onCommand() {
        return startReaderPageMenuWorkflow(reader, {
          qualityKey: defaultQualityKey,
          imageCategory: defaultCategoryKey,
          pageIndex: getContextPageIndex(params),
        }, savePage);
      },
    });

    actions.push({
      label: "在全部图片库查看当前论文图片",
      onCommand() {
        void openSaved(reader);
      },
    });

    actions.push({
      label: "打开全部论文图片库",
      onCommand() {
        void openLibrary(Zotero.getMainWindow?.(), reader);
      },
    });

    actions.push({
      label: "删除当前论文图片库记录（不删除文献或 PDF）",
      onCommand() {
        void deleteSavedImagesFromReader(reader);
      },
    });

    actions.push({
      label: `高级：提取本页 PDF 嵌入原图（可选 Python，最多 ${pageOriginalMaxImages} 张）`,
      onCommand() {
        return startReaderOriginalMenuWorkflow(reader, {
          scope: "page",
          pageIndex: getContextPageIndex(params),
        }, saveOriginal);
      },
    });

    actions.push({
      label: `高级：提取全文 PDF 嵌入原图（可选 Python，最多 ${documentOriginalMaxImages} 张）`,
      onCommand() {
        return startReaderOriginalMenuWorkflow(reader, {
          scope: "document",
        }, saveOriginal);
      },
    });

    actions.push({
      label: "PDF 图片插件诊断",
      onCommand() {
        void diagnostics(reader);
      },
    });
    return actions;
  }

  async function startClipFromActiveReader(win, qualityKey) {
    const reader = getActiveReader(win);
    if (!reader) {
      Services.prompt.alert(win, "PDF 图片保存", "未找到已打开的 PDF。请先打开一篇 PDF 文献。");
      return;
    }
    await startReaderClipMenuWorkflow(reader, qualityKey);
  }

  async function openSavedPreviewFromActiveReader(win) {
    const reader = getActiveReader(win);
    if (!reader) {
      Services.prompt.alert(win, "PDF 图片保存", "未找到已打开的 PDF。请先打开一篇 PDF 文献。");
      return null;
    }
    return openGlobalImageLibrary(win, reader);
  }

  async function openSavedPreviewPicker(reader) {
    try {
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const previews = await getSavedPreviewIndexAttachments(parentItem, attachment);
      if (!previews.length) {
        showReaderToast(reader, "当前论文还没有已保存图片。请先使用“框选保存”。", "info");
        return null;
      }
      let selectedIndex = 0;
      if (previews.length > 1 && typeof Services?.prompt?.select === "function") {
        const selected = { value: 0 };
        const labels = previews.map((record, index) => formatSavedPreviewLabel(record, index));
        const accepted = Services.prompt.select(
          Zotero.getMainWindow?.() || null,
          "已保存图片",
          "选择要查看的图片预览组。将在默认浏览器打开；点击图片或“定位原文”即可回到对应论文页面。",
          labels.length,
          labels,
          selected,
        );
        if (!accepted) {
          return null;
        }
        selectedIndex = clampInteger(Number(selected.value), 0, previews.length - 1);
      }
      const record = previews[selectedIndex];
      const openMode = await openPreviewIndexAttachment(record.item);
      showReaderToast(
        reader,
        `${openMode === "external" ? "已在默认浏览器打开" : "已打开"} ${formatSavedPreviewLabel(record, selectedIndex)}。点击图片或“定位原文”可返回论文页面。`,
        "success",
      );
      return record.item;
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      return null;
    }
  }

  async function deleteSavedImagesFromActiveReader(win) {
    const reader = getActiveReader(win);
    if (!reader) {
      Services.prompt.alert(win, "PDF 图片保存", "未找到已打开的 PDF。请先打开一篇 PDF 文献。");
      return null;
    }
    return deleteSavedImagesFromReader(reader);
  }

  async function deleteSavedImagesFromReader(reader) {
    try {
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment?.parentID ? Zotero.Items.get(attachment.parentID) : null;
      if (!attachment) {
        showReaderToast(reader, "未找到当前 PDF，无法删除图片库记录。", "warning");
        return null;
      }
      const database = await ensureSharedLibrarySchema();
      const attachmentKey = normalizeItemKey(attachment.key, "");
      const rows = attachmentKey
        ? await database.queryAsync("SELECT image_id FROM images WHERE pdf_attachment_key = ? AND deleted = 0", [attachmentKey])
        : [];
      const imageIDs = (Array.isArray(rows) ? rows : [])
        .map((row) => normalizeMetadataText(row?.image_id, "", 1000))
        .filter(Boolean);
      if (!imageIDs.length) {
        showReaderToast(reader, "当前论文图片库没有可删除的记录。", "info");
        return { deleted: 0 };
      }
      const title = normalizeMetadataText(getItemField(parentItem, "title"), "当前论文", 120);
      const accepted = Services.prompt.confirm(
        Zotero.getMainWindow?.() || null,
        "删除论文图片库记录",
        `确定软删除“${title}”的 ${imageIDs.length} 张图片吗？\n\n只会从外部图片库隐藏，不删除 Zotero 文献、PDF 或原始附件。`,
      );
      if (!accepted) {
        showReaderToast(reader, "已取消删除。", "info");
        return { deleted: 0, cancelled: true };
      }
      const result = await deleteSharedLibraryImages(imageIDs);
      showReaderToast(reader, `已从图片库删除 ${result.deleted} 张图片；Zotero 文献和 PDF 未改变。`, "success");
      return result;
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      return null;
    }
  }


  async function openGlobalImageLibrary(win = null, reader = null) {
    const ownerWindow = win || Zotero.getMainWindow?.() || null;
    try {
      if (reader) {
        showReaderToast(reader, "正在从本地图片库读取完整图像…", "progress");
      }
      const attachment = reader ? getReaderPDFAttachment(reader) : null;
      const report = await prepareGlobalImageLibraryView({
        pdfAttachmentKey: normalizeItemKey(attachment?.key, ""),
      });
      if (typeof Zotero.launchFile !== "function") {
        throw new Error("Storage failed: library browser unavailable.");
      }
      Zotero.launchFile(report.htmlPath);
      if (reader) {
        showReaderToast(
          reader,
          report.imageCount
            ? `已打开全部论文图片库：${report.imageCount} 张完整图像${report.skippedCount ? `；跳过 ${report.skippedCount} 条无效记录` : ""}。`
            : "已打开论文图片库；当前还没有已保存图像。",
          report.skippedCount ? "warning" : "success",
        );
      }
      return report;
    } catch (error) {
      logError(error);
      const message = formatUserFacingError(error);
      if (reader) {
        showReaderToast(reader, message, "error");
      } else {
        Services.prompt.alert(ownerWindow, "论文图片库", message);
      }
      return null;
    }
  }

  async function prepareGlobalImageLibraryView(options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const pdfAttachmentKey = normalizeItemKey(safeOptions.pdfAttachmentKey, "");
    const database = await ensureSharedLibrarySchema();
    const rows = [];
    await database.queryAsync(`SELECT
      image_id, title, year, doi, page_number, created_at, source_region_key,
      preview_duplicate_key, parent_item_key, pdf_attachment_key, zotero_open_pdf_uri,
      library_id, library_type, group_id, bbox_json, palette_json,
      image_category, color_family, style_tags_json, quality, detector,
      rendered_width, rendered_height, dominant_hex, contrast_hex,
      content_sha256, origin_type, source_match_status, imported_at,
      zotero_select_item_uri,
      length(image_blob) AS image_bytes
      FROM images WHERE deleted = 0
      ORDER BY created_at DESC, title COLLATE NOCASE, page_number, image_id`, [], {
      onRow(rawRow) {
        rows.push(normalizeDatabaseRowKeys(rawRow, GLOBAL_LIBRARY_ROW_FIELDS));
      },
    });
    const records = [];
    let skippedCount = 0;
    const outputDirectory = PathUtils.join(PathUtils.tempDir, ADDON_REF, GLOBAL_LIBRARY_DIRECTORY_NAME);
    const imageDirectory = PathUtils.join(outputDirectory, "images");
    if (typeof IOUtils !== "undefined" && typeof IOUtils.remove === "function") {
      try { await IOUtils.remove(imageDirectory, { recursive: true, ignoreAbsent: true }); } catch (error) { safeLogError(error); }
    }
    await ensureDirectoryRecursively(imageDirectory);
    for (const [index, rawRow] of (Array.isArray(rows) ? rows : []).entries()) {
      try {
        const row = rawRow;
        const imageID = normalizeMetadataText(row?.image_id, "", 1000);
        if (!imageID) {
          skippedCount += 1;
          continue;
        }
        const blobRow = await database.rowQueryAsync(
          "SELECT image_blob FROM images WHERE image_id = ? AND deleted = 0 LIMIT 1",
          [imageID],
        );
        const bytes = normalizeDatabaseImageBytes(
          getDatabaseRowValue(blobRow, "image_blob")
          ?? getDatabaseRowValue(blobRow, "imageBlob")
          ?? blobRow,
        );
        if (!bytes?.length || bytes.length > GLOBAL_LIBRARY_MAX_IMAGE_BYTES) {
          skippedCount += 1;
          continue;
        }
        const fileType = getDatabaseImageFileType(bytes);
        if (!fileType) {
          skippedCount += 1;
          continue;
        }
        const fingerprint = getSourceRegionFingerprint(imageID);
        const fileName = `image-${String(index + 1).padStart(5, "0")}-${fingerprint}.${fileType.extension}`;
        const imagePath = PathUtils.join(imageDirectory, fileName);
        if (typeof IOUtils === "undefined" || typeof IOUtils.write !== "function") {
          throw new Error("Storage failed: image export runtime unavailable.");
        }
        await IOUtils.write(imagePath, bytes);
        const contentSHA256 = normalizeSHA256(row?.content_sha256) || await computeSHA256Hex(bytes);
        if (contentSHA256 && !normalizeSHA256(row?.content_sha256)) {
          await database.queryAsync(
            "UPDATE images SET content_sha256 = ? WHERE image_id = ? AND (content_sha256 IS NULL OR content_sha256 = '')",
            [contentSHA256, imageID],
          );
        }
        records.push(normalizeGlobalImageLibraryRecord({ ...row, content_sha256: contentSHA256 }, `images/${fileName}`, bytes.length));
      } catch (error) {
        skippedCount += 1;
        safeLogError(error);
      }
    }
    const htmlPath = PathUtils.join(outputDirectory, GLOBAL_LIBRARY_HTML_NAME);
    const html = buildGlobalImageLibraryHTML({
      records,
      initialPdfAttachmentKey: pdfAttachmentKey,
      skippedCount,
      bridgeURL: BRIDGE_URL,
      bridgeToken: isBridgeEndpointRegistered() ? bridgeToken : "",
    });
    if (typeof Zotero.File?.putContentsAsync !== "function") {
      throw new Error("Storage failed: library HTML writer unavailable.");
    }
    await Zotero.File.putContentsAsync(htmlPath, html);
    return {
      htmlPath,
      imageCount: records.length,
      skippedCount,
      totalBytes: records.reduce((sum, record) => sum + record.imageBytes, 0),
    };
  }

  function getDatabaseRowValue(row, key) {
    if (!row || typeof row !== "object") return undefined;
    let getResultByName = null;
    try {
      if (typeof row.getResultByName === "function") getResultByName = row.getResultByName.bind(row);
    } catch (_error) {}
    for (const candidate of [key, String(key || "").toLowerCase(), String(key || "").toUpperCase()]) {
      if (!candidate) continue;
      if (getResultByName) {
        try {
          const value = getResultByName(candidate);
          if (value !== undefined && value !== null) return value;
        } catch (_error) {}
      }
      try {
        const value = row[candidate];
        if (value !== undefined && value !== null) return value;
      } catch (_error) {}
    }
    const lowerKey = String(key || "").toLowerCase();
    const matchedKey = Object.keys(row).find((candidate) => String(candidate).toLowerCase() === lowerKey);
    return matchedKey ? row[matchedKey] : undefined;
  }

  function normalizeDatabaseRowKeys(row, expectedKeys = []) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      const lowerKey = String(key).toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(normalized, lowerKey)) normalized[lowerKey] = value;
    }
    for (const key of Array.isArray(expectedKeys) ? expectedKeys : []) {
      const lowerKey = String(key || "").toLowerCase();
      if (!lowerKey || Object.prototype.hasOwnProperty.call(normalized, lowerKey)) continue;
      const value = getDatabaseRowValue(row, key);
      if (value !== undefined) normalized[lowerKey] = value;
    }
    return Object.keys(normalized).length ? normalized : row;
  }

  async function synchronizeLegacyPreviewIndexesToSharedLibrary() {
    if (getStringPref(LEGACY_PREVIEW_SYNC_PREF, "") === LEGACY_PREVIEW_SYNC_VERSION) {
      return { scanned: 0, written: 0, skipped: 0, alreadySynchronized: true };
    }
    const items = getLocalCitationItems();
    const stats = { scanned: 0, written: 0, skipped: 0 };
    for (const item of items.slice(0, LEGACY_PREVIEW_SYNC_MAX_ITEMS)) {
      const parentItem = item?.isRegularItem?.() ? item : null;
      if (!parentItem || typeof parentItem.getAttachments !== "function") continue;
      let childIDs = [];
      try { childIDs = parentItem.getAttachments() || []; } catch (error) { safeLogError(error); continue; }
      for (const childID of Array.isArray(childIDs) ? childIDs : []) {
        const attachment = Zotero.Items?.get?.(childID);
        if (!attachment || !isPDFAttachmentLike(attachment)) continue;
        const originalRecords = await getSavedOriginalImageIndexAttachments(parentItem, attachment);
        for (const record of originalRecords) {
          stats.scanned += 1;
          try {
            const imported = await readOriginalIndexImagesWithBytes(parentItem, attachment, record);
            if (imported.length) {
              const result = await publishPreviewEntriesToSharedLibrary({ attachment, parentItem, entries: imported });
              stats.written += result.written || 0;
            } else {
              stats.skipped += 1;
            }
          } catch (error) {
            stats.skipped += 1;
            safeLogError(error);
          }
        }
        const previewRecords = await getSavedPreviewIndexAttachments(parentItem, attachment);
        for (const record of previewRecords) {
          stats.scanned += 1;
          const metadata = await readPreviewIndexMetadataWithImages(record?.item, record?.metadata);
          const entries = Array.isArray(metadata?.entries) ? metadata.entries : [];
          const usableEntries = entries.filter((entry) => {
            try { normalizePreviewDataURL(entry?.dataURL); return true; } catch (_error) { return false; }
          });
          if (!usableEntries.length) { stats.skipped += 1; continue; }
          try {
            const result = await publishPreviewEntriesToSharedLibrary({ attachment, parentItem, entries: usableEntries });
            stats.written += result.written || 0;
          } catch (error) {
            stats.skipped += 1;
            safeLogError(error);
          }
        }
      }
    }
    setStringPref(LEGACY_PREVIEW_SYNC_PREF, LEGACY_PREVIEW_SYNC_VERSION);
    return stats;
  }

  function isPDFAttachmentLike(item) {
    try {
      return !!(item?.isPDFAttachment?.() || normalizeImageContentType(item?.attachmentContentType) === "application/pdf");
    } catch (_error) {
      return false;
    }
  }

  async function readPreviewIndexMetadataWithImages(item, metadata) {
    if (!metadata || typeof item?.getFilePathAsync !== "function" || typeof Zotero.File?.getContentsAsync !== "function") {
      return metadata;
    }
    try {
      const filePath = await item.getFilePathAsync();
      const html = filePath ? await Zotero.File.getContentsAsync(filePath) : "";
      const dataURLs = [...String(html || "").matchAll(/<img\b[^>]*\bsrc=["'](data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)["']/gi)].map((match) => match[1]);
      const entries = (Array.isArray(metadata.entries) ? metadata.entries : []).map((entry, index) => ({
        ...entry,
        dataURL: dataURLs[index] || entry.dataURL || entry.data_url || "",
      }));
      return { ...metadata, entries };
    } catch (error) {
      safeLogError(error);
      return metadata;
    }
  }

  async function getSavedOriginalImageIndexAttachments(parentItem, attachment = null) {
    const candidates = [];
    try {
      const childIDs = parentItem?.getAttachments?.() || [];
      for (const childID of Array.isArray(childIDs) ? childIDs : []) {
        const item = Zotero.Items?.get?.(childID);
        if (item) candidates.push(item);
      }
    } catch (error) {
      safeLogError(error);
    }
    const expectedKey = normalizeItemKey(attachment?.key, null);
    const records = [];
    for (const item of candidates) {
      const metadata = await readOriginalImageIndexMetadataFromAttachment(item);
      if (!metadata || !Array.isArray(metadata.images)) continue;
      const sourceKey = normalizeItemKey(metadata?.pdf_attachment?.key, null);
      if (expectedKey && sourceKey && expectedKey !== sourceKey) continue;
      records.push({ item, metadata });
    }
    return records;
  }

  async function readOriginalIndexImagesWithBytes(parentItem, attachment, record) {
    const metadataImages = Array.isArray(record?.metadata?.images) ? record.metadata.images : [];
    const children = [];
    try {
      for (const childID of parentItem?.getAttachments?.() || []) {
        const item = Zotero.Items?.get?.(childID);
        if (item && String(item.attachmentContentType || "").toLowerCase().startsWith("image/")) children.push(item);
      }
    } catch (error) {
      safeLogError(error);
    }
    const result = [];
    for (const image of metadataImages) {
      const fingerprint = normalizeMetadataText(image?.original_image_fingerprint, "", 100);
      const child = children.find((item) => fingerprint && normalizeMetadataText(getItemField(item, "title"), "", 300).includes(fingerprint));
      const filePath = child?.getFilePathAsync ? await child.getFilePathAsync() : "";
      if (!filePath || typeof IOUtils === "undefined" || typeof IOUtils.read !== "function") continue;
      const bytes = normalizeDatabaseImageBytes(await IOUtils.read(filePath));
      if (!bytes?.length || bytes.length > GLOBAL_LIBRARY_MAX_IMAGE_BYTES) continue;
      result.push({
        pageNumber: normalizePageNumber(image?.page_number, 1),
        bboxNormalized: normalizeBBoxNormalized(image?.bbox_normalized),
        renderedWidth: null,
        renderedHeight: null,
        imageCategory: "figure",
        detector: "embedded_original",
        quality: "original",
        imageBytes: bytes,
        originType: "original",
        previewDuplicateKey: normalizeMetadataText(image?.original_image_key, "", 1000),
      });
    }
    return result;
  }

  function normalizeDatabaseImageBytes(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Uint8Array) {
      return value;
    }
    if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView?.(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) {
      return Uint8Array.from(value.map((item) => clampInteger(Number(item), 0, 255)));
    }
    if (typeof value === "string" && /^data:image\//i.test(value)) {
      return dataURLToBytes(value);
    }
    return null;
  }

  function getDatabaseImageFileType(bytes) {
    const data = normalizeDatabaseImageBytes(bytes);
    if (!data || data.length < 4) {
      return null;
    }
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
      return { extension: "jpg", mimeType: "image/jpeg" };
    }
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
      return { extension: "png", mimeType: "image/png" };
    }
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
      return { extension: "gif", mimeType: "image/gif" };
    }
    if (
      data.length >= 12
      && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
      && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
    ) {
      return { extension: "webp", mimeType: "image/webp" };
    }
    return null;
  }

  function normalizeSHA256(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : "";
  }

  function getRuntimeGlobalValue(name) {
    try {
      if (typeof globalThis !== "undefined" && globalThis?.[name]) return globalThis[name];
    } catch (_error) {}
    try {
      const win = Zotero.getMainWindow?.();
      if (win?.[name]) return win[name];
    } catch (_error) {}
    try {
      const zoteroGlobal = typeof Components !== "undefined" ? Components.utils?.getGlobalForObject?.(Zotero) : null;
      if (zoteroGlobal?.[name]) return zoteroGlobal[name];
    } catch (_error) {}
    return null;
  }

  async function computeSHA256Hex(value) {
    const bytes = normalizeDatabaseImageBytes(value);
    if (!bytes?.length) return "";
    try {
      const runtimeCrypto = getRuntimeGlobalValue("crypto");
      if (runtimeCrypto?.subtle?.digest) {
        const digest = new Uint8Array(await runtimeCrypto.subtle.digest(
          "SHA-256",
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        ));
        return Array.from(digest, (item) => item.toString(16).padStart(2, "0")).join("");
      }
      const componentSource = typeof Components !== "undefined" ? Components : null;
      const hasher = componentSource?.classes?.["@mozilla.org/security/hash;1"]
        ?.createInstance?.(componentSource.interfaces?.nsICryptoHash);
      if (hasher) {
        hasher.init(hasher.SHA256);
        hasher.update(bytes, bytes.length);
        const binary = hasher.finish(false);
        return Array.from(binary, (item) => item.charCodeAt(0).toString(16).padStart(2, "0")).join("");
      }
    } catch (error) {
      safeLogError(error);
    }
    return "";
  }

  function bytesToBase64(value) {
    const bytes = normalizeDatabaseImageBytes(value);
    if (!bytes?.length || typeof btoa !== "function") {
      return "";
    }
    const chunks = [];
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))));
    }
    return btoa(chunks.join(""));
  }

  function base64ToBytes(value) {
    const source = String(value || "").replace(/\s+/g, "");
    if (!source || source.length > Math.ceil(GLOBAL_LIBRARY_MAX_IMAGE_BYTES * 4 / 3) + 8 || typeof atob !== "function") {
      return null;
    }
    try {
      const binary = atob(source);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    } catch (_error) {
      return null;
    }
  }

  function parseSharedJSON(value, fallback) {
    if (value && typeof value === "object") {
      return value;
    }
    if (typeof value !== "string" || !value.trim()) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeGlobalImageLibraryRecord(row, imageURL, byteCount = null) {
    const palette = normalizePalette(parseSharedJSON(row?.palette_json ?? row?.palette, []));
    const category = normalizeImageCategoryKey(row?.image_category || row?.category || "figure");
    const colorFamily = normalizeColorFamily(row?.color_family || row?.colorFamily || deriveColorFamilyFromPalette(palette));
    const styleTags = normalizeStyleTags(parseSharedJSON(row?.style_tags_json ?? row?.styleTags, []));
    const yearMatch = String(row?.year || "").match(/(?:18|19|20|21)\d{2}/);
    const rawOpenPDFURI = row?.zotero_open_pdf_uri || row?.openPDFURI || "";
    const openPDFURI = isAllowedBridgeZoteroURI(rawOpenPDFURI)
      && String(rawOpenPDFURI).startsWith("zotero://open-pdf/")
      ? String(rawOpenPDFURI)
      : "";
    const rawSelectItemURI = row?.zotero_select_item_uri || row?.selectItemURI || "";
    const selectItemURI = isAllowedBridgeZoteroURI(rawSelectItemURI)
      && String(rawSelectItemURI).startsWith("zotero://select/")
      ? String(rawSelectItemURI)
      : "";
    const originType = String(row?.origin_type || row?.originType || "").toLowerCase() === "shared" ? "shared" : "local";
    const rawMatchStatus = normalizeMetadataText(row?.source_match_status || row?.sourceMatchStatus, "", 40).toLowerCase();
    const sourceMatchStatus = ["local", "doi", "title-year", "unmatched"].includes(rawMatchStatus)
      ? rawMatchStatus
      : (openPDFURI || selectItemURI ? "local" : "unmatched");
    return {
      imageID: normalizeMetadataText(row?.image_id || row?.imageID, "unknown", 1000),
      imageURL: normalizeMetadataText(imageURL, "", 1200),
      title: normalizeMetadataText(row?.title, "未命名论文图像", 300),
      year: yearMatch?.[0] || "",
      doi: normalizeMetadataText(row?.doi, "", 240),
      pageNumber: normalizePageNumber(row?.page_number ?? row?.pageNumber, 1),
      createdAt: normalizeMetadataText(row?.created_at || row?.createdAt, "", 80),
      sourceRegionKey: normalizeMetadataText(row?.source_region_key || row?.sourceRegionKey, "", 1000),
      previewDuplicateKey: normalizeMetadataText(row?.preview_duplicate_key || row?.previewDuplicateKey, "", 1000),
      parentItemKey: normalizeItemKey(row?.parent_item_key || row?.parentItemKey, ""),
      pdfAttachmentKey: normalizeItemKey(row?.pdf_attachment_key || row?.pdfAttachmentKey, ""),
      openPDFURI,
      selectItemURI,
      libraryID: normalizeMetadataText(row?.library_id ?? row?.libraryID, "", 40),
      libraryType: normalizeMetadataText(row?.library_type || row?.libraryType, "user", 40),
      groupID: normalizeMetadataText(row?.group_id ?? row?.groupID, "", 40),
      bboxJSON: normalizeMetadataText(row?.bbox_json || row?.bboxJSON, "", 300),
      category,
      categoryLabel: getSavedImageCategoryLabel(category),
      colorFamily,
      colorFamilyLabel: formatColorFamilyLabel(colorFamily),
      styleTags,
      palette,
      quality: Object.prototype.hasOwnProperty.call(QUALITY, String(row?.quality || "")) ? String(row.quality) : "",
      detector: normalizeMetadataText(row?.detector, "", 80),
      renderedWidth: normalizePositiveInteger(row?.rendered_width ?? row?.renderedWidth, null),
      renderedHeight: normalizePositiveInteger(row?.rendered_height ?? row?.renderedHeight, null),
      dominantHex: normalizeHexColor(row?.dominant_hex || row?.dominantHex) || palette[0]?.hex || "",
      contrastHex: normalizeHexColor(row?.contrast_hex || row?.contrastHex) || "",
      imageBytes: normalizeNonNegativeInteger(byteCount ?? row?.image_bytes ?? row?.imageBytes, 0),
      contentSHA256: normalizeSHA256(row?.content_sha256 || row?.contentSHA256),
      originType,
      sourceMatchStatus,
      importedAt: normalizeMetadataText(row?.imported_at || row?.importedAt, "", 80),
    };
  }

  function getGlobalImageDownloadExtension(imageURL) {
    const value = String(imageURL || "").trim();
    const dataType = value.match(/^data:image\/(jpeg|png|gif|webp|svg\+xml)(?:;|,)/i)?.[1]?.toLowerCase();
    if (dataType) {
      return dataType === "jpeg" ? "jpg" : dataType === "svg+xml" ? "svg" : dataType;
    }
    const pathType = value.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i)?.[1]?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(pathType)
      ? (pathType === "jpeg" ? "jpg" : pathType)
      : "img";
  }

  function buildGlobalImageDownloadName(record, index = 0) {
    const rawTitle = normalizeMetadataText(record?.title, "论文图片", 300);
    const safeTitle = rawTitle
      .normalize?.("NFKC")
      ?.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
      ?.replace(/[\s.]+/g, "_")
      ?.replace(/^_+|_+$/g, "")
      ?.slice(0, 72)
      ?.replace(/_+$/g, "") || "论文图片";
    const year = String(record?.year || "").match(/(?:18|19|20|21)\d{2}/)?.[0] || "";
    const pageNumber = normalizePageNumber(record?.pageNumber ?? record?.page_number, 1);
    const ordinal = String(normalizeNonNegativeInteger(index, 0) + 1).padStart(3, "0");
    const extension = getGlobalImageDownloadExtension(record?.imageURL);
    return `${safeTitle}${year ? `_${year}` : ""}_第${pageNumber}页_图${ordinal}.${extension}`;
  }

  function buildGlobalImageLibraryHTML({ records = [], skippedCount = 0, generatedAt = null, bridgeURL = "", bridgeToken: pageBridgeToken = "", initialPdfAttachmentKey = "" } = {}) {
    const list = (Array.isArray(records) ? records : [])
      .map((record) => normalizeGlobalImageLibraryRecord(record, record?.imageURL, record?.imageBytes))
      .map((record, index) => ({ ...record, downloadName: buildGlobalImageDownloadName(record, index) }));
    const createdAt = generatedAt || new Date().toISOString();
    const totalBytes = list.reduce((sum, record) => sum + record.imageBytes, 0);
    const categoryCounts = new Map();
    const colorCounts = new Map();
    const yearCounts = new Map();
    for (const record of list) {
      categoryCounts.set(record.category, (categoryCounts.get(record.category) || 0) + 1);
      colorCounts.set(record.colorFamily, (colorCounts.get(record.colorFamily) || 0) + 1);
      if (record.year) yearCounts.set(record.year, (yearCounts.get(record.year) || 0) + 1);
    }
    const optionHTML = (counts, labelForValue) => [...counts.entries()]
      .sort((left, right) => String(labelForValue(left[0])).localeCompare(String(labelForValue(right[0])), "zh-CN"))
      .map(([value, count]) => `<option value="${escapeHTML(value)}">${escapeHTML(labelForValue(value))}（${count}）</option>`)
      .join("");
    const yearOptionsHTML = [...yearCounts.entries()]
      .sort((left, right) => Number(right[0]) - Number(left[0]))
      .map(([value, count]) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}（${count}）</option>`)
      .join("");
    const sourceInfo = (record) => {
      if (record.sourceMatchStatus === "doi") return { label: "导入 · DOI 已匹配", kind: "linked" };
      if (record.sourceMatchStatus === "title-year") return { label: "导入 · 标题年份已匹配", kind: "linked" };
      if (record.sourceMatchStatus === "unmatched") return { label: "导入 · 仅文献信息", kind: "unmatched" };
      return { label: "本机采集", kind: record.openPDFURI || record.selectItemURI ? "linked" : "unmatched" };
    };
    const sourceActionHTML = (record, className = "button secondary") => {
      const uri = record.openPDFURI || record.selectItemURI;
      const label = record.openPDFURI ? "定位原文" : record.selectItemURI ? "定位文献" : "无本机文献";
      return uri
        ? `<a class="${className}" href="${escapeHTML(uri)}">${label}</a>`
        : `<span class="${className} is-disabled" aria-disabled="true">${label}</span>`;
    };
    const cardsHTML = list.map((record, index) => {
      const source = sourceInfo(record);
      const searchText = [record.title, record.year, record.doi, record.pageNumber, record.categoryLabel, record.colorFamilyLabel, source.label, ...record.styleTags, ...record.styleTags.map(formatStyleTagLabel)].join(" ").toLowerCase();
      const paletteHTML = record.palette.slice(0, 6).map((swatch) => `<span class="palette-swatch" style="--swatch:${escapeHTML(swatch.hex)}" title="${escapeHTML(swatch.hex)}"><span class="sr-only">${escapeHTML(swatch.hex)}</span></span>`).join("");
      const tagHTML = record.styleTags.slice(0, 4).map((tag) => `<span class="tag">${escapeHTML(formatStyleTagLabel(tag))}</span>`).join("");
      const qualityLabel = record.quality && QUALITY[record.quality] ? `清晰度 ${QUALITY[record.quality].label}` : "";
      return `<article class="library-card" data-id="${escapeHTML(record.imageID)}" data-index="${index}" data-search="${escapeHTML(searchText)}" data-category="${escapeHTML(record.category)}" data-color="${escapeHTML(record.colorFamily)}" data-year="${escapeHTML(record.year)}" data-created="${escapeHTML(record.createdAt)}" data-title="${escapeHTML(record.title.toLowerCase())}" data-page="${record.pageNumber}" data-size="${record.imageBytes}" data-source="${source.kind}" data-pdf-attachment-key="${escapeHTML(record.pdfAttachmentKey)}">
        <button type="button" class="image-button" data-open-image="${escapeHTML(record.imageID)}" aria-label="高清查看：${escapeHTML(record.title)}">
          <img src="${escapeHTML(record.imageURL)}" alt="${escapeHTML(record.title)}，第 ${record.pageNumber} 页" loading="lazy" decoding="async">
        </button>
        <div class="card-body">
          <div class="card-heading"><h2 title="${escapeHTML(record.title)}">${escapeHTML(record.title)}</h2><label class="selection-control" title="选择图片；电脑端按住 Shift 可连续选择"><input type="checkbox" data-select-image="${escapeHTML(record.imageID)}" data-selection-label="选择图片：${escapeHTML(record.title)}" aria-label="选择图片：${escapeHTML(record.title)}；电脑端按住 Shift 可连续选择"><span>选择图片</span></label></div>
          <div class="metadata"><span>${escapeHTML(record.categoryLabel)}</span><span>${record.year ? escapeHTML(record.year) : "年份未知"}</span><span>第 ${record.pageNumber} 页</span><span class="image-dimensions">${escapeHTML(formatPreviewDimensions(record.renderedWidth, record.renderedHeight))}</span><span>${formatBytes(record.imageBytes)}</span></div>
          <div class="detail-line"><span class="source-badge ${source.kind}">${escapeHTML(source.label)}</span>${qualityLabel ? `<span>${escapeHTML(qualityLabel)}</span>` : ""}<span>${escapeHTML(formatLibraryGeneratedTime(record.createdAt))}</span></div>
          ${record.doi ? `<div class="doi" title="${escapeHTML(record.doi)}">DOI ${escapeHTML(record.doi)}</div>` : ""}
          <div class="palette" aria-label="图片配色">${paletteHTML || '<span class="muted">未提取配色</span>'}</div>
          ${tagHTML ? `<div class="tags">${tagHTML}</div>` : ""}
        <div class="card-actions"><button type="button" class="button primary" data-open-image="${escapeHTML(record.imageID)}">查看大图</button>${sourceActionHTML(record)}<a class="button secondary" data-download-image="${escapeHTML(record.imageID)}" href="${escapeHTML(record.imageURL)}" download="${escapeHTML(record.downloadName)}" title="下载为 ${escapeHTML(record.downloadName)}">下载原图</a></div>
        </div>
      </article>`;
    }).join("");
    const rowsHTML = list.map((record, index) => {
      const source = sourceInfo(record);
      return `<tr data-id="${escapeHTML(record.imageID)}" data-index="${index}">
        <td class="table-select"><input type="checkbox" data-select-image="${escapeHTML(record.imageID)}" data-selection-label="选择图片：${escapeHTML(record.title)}" title="选择图片；电脑端按住 Shift 可连续选择" aria-label="选择图片：${escapeHTML(record.title)}；电脑端按住 Shift 可连续选择"></td>
        <td class="table-preview"><button type="button" class="table-image" data-open-image="${escapeHTML(record.imageID)}" title="查看大图：${escapeHTML(record.title)}" aria-label="高清查看：${escapeHTML(record.title)}"><img src="${escapeHTML(record.imageURL)}" alt="" loading="lazy" decoding="async"><span class="table-image-label">查看大图</span></button></td>
        <td class="table-paper"><button type="button" class="table-title-button" data-open-image="${escapeHTML(record.imageID)}" title="高清查看：${escapeHTML(record.title)}" aria-label="高清查看：${escapeHTML(record.title)}">${escapeHTML(record.title)}</button>${record.doi ? `<small class="table-doi">${escapeHTML(record.doi)}</small>` : ""}<small class="table-facts">${escapeHTML(record.categoryLabel)} · ${record.year ? escapeHTML(record.year) : "年份未知"} · 第 ${record.pageNumber} 页 · ${formatBytes(record.imageBytes)} · ${escapeHTML(source.label)}</small></td>
        <td class="table-category">${escapeHTML(record.categoryLabel)}</td><td class="table-year">${record.year ? escapeHTML(record.year) : "未知"}</td><td class="table-page">${record.pageNumber}</td><td class="table-size">${formatBytes(record.imageBytes)}</td><td class="table-source-status"><span class="source-badge ${source.kind}">${escapeHTML(source.label)}</span></td><td class="table-source">${sourceActionHTML(record, "table-link")}</td>
      </tr>`;
    }).join("");
    const libraryData = list.map((record) => {
      const source = sourceInfo(record);
      return {
        id: record.imageID,
        imageURL: record.imageURL,
        downloadName: record.downloadName,
        title: record.title,
        year: record.year,
        pageNumber: record.pageNumber,
        categoryLabel: record.categoryLabel,
        dimensions: formatPreviewDimensions(record.renderedWidth, record.renderedHeight),
        imageBytes: record.imageBytes,
        sourceLabel: source.label,
        openPDFURI: record.openPDFURI,
        selectItemURI: record.selectItemURI,
      };
    });
    const serializedLibraryData = JSON.stringify(libraryData).replace(/</g, "\\u003c");
    const serializedBridgeConfig = JSON.stringify({
      url: String(bridgeURL || ""),
      token: String(pageBridgeToken || ""),
    }).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="zh-CN" data-view="gallery">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>论文图片库</title>
  <style>
    :root { color-scheme:light dark; --bg:#EEF2F7; --surface:#FFFFFF; --surface-2:#F8FAFC; --text:#0F172A; --muted:#64748B; --line:#CBD5E1; --control-line:#64748B; --accent:#2563EB; --accent-hover:#1D4ED8; --accent-emphasis:#2563EB; --link:#2563EB; --success:#16A34A; --danger:#DC2626; --danger-bg:#FEF2F2; --warning:#D97706; --radius:8px; --radius-sm:6px; --control-height:32px; --compact-height:28px; --card-min-width:280px; --library-header-height:0px; }
    * { box-sizing:border-box; letter-spacing:0; }
    html, body { margin:0; min-height:100%; background:var(--bg); color:var(--text); font:14px/1.45 system-ui,"Microsoft YaHei UI",sans-serif; }
    button, input, select { font:inherit; color:inherit; }
    button, a { -webkit-tap-highlight-color:transparent; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--link); outline-offset:2px; }
    [hidden] { display:none!important; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .app-header { position:sticky; top:0; z-index:20; border-bottom:1px solid var(--line); background:var(--surface); box-shadow:0 2px 8px rgba(0,0,0,.06); }
    .header-inner { max-width:1920px; margin:0 auto; padding:11px 18px 10px; }
    .title-row, .toolbar-row, .batch-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .title-row { position:relative; align-items:baseline; margin-bottom:9px; padding-right:96px; }
    #refresh-library { position:absolute; top:0; right:0; }
    .library-source-note { margin:0 0 4px; color:var(--muted); font-size:11px; line-height:1.2; }
    h1 { margin:0; font-size:18px; font-weight:700; }
    .summary { color:var(--muted); font-size:13px; }
    .search-filter-row { display:grid; grid-template-columns:minmax(250px,2fr) minmax(0,5fr); gap:7px; align-items:start; }
    .control { min-width:0; width:100%; height:var(--control-height); border:1px solid var(--control-line); border-radius:var(--radius-sm); background:var(--surface); padding:4px 7px; }
    .search { width:100%; }
    .filter-panel { min-width:0; }
    .filter-panel > summary { display:none; align-items:center; justify-content:space-between; min-height:var(--control-height); padding:4px 7px; border:1px solid var(--control-line); border-radius:var(--radius-sm); background:var(--surface); cursor:pointer; font-weight:600; list-style:none; }
    .filter-panel:not([open]) > summary { display:flex; }
    .filter-panel > summary::-webkit-details-marker { display:none; }
    .filter-panel > summary::after { content:"展开筛选"; margin-left:8px; color:var(--link); font-size:12px; font-weight:400; }
    .filter-panel > summary:focus-visible { outline:2px solid var(--link); outline-offset:2px; }
    .filter-controls { display:grid; grid-template-columns:repeat(5,minmax(124px,1fr)) auto; gap:7px; align-items:center; }
    .filter-actions { display:flex; align-items:center; gap:7px; }
    .filter-actions > button { flex:1 1 auto; white-space:nowrap; }
    .filter-panel-summary { max-width:55%; overflow:hidden; color:var(--muted); font-size:12px; font-weight:400; text-overflow:ellipsis; white-space:nowrap; }
    .filter-panel.is-active .filter-panel-summary { color:var(--accent-emphasis); }
    .toolbar-row { justify-content:space-between; margin-top:8px; }
    .toolbar-group { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
    .segmented { display:inline-flex; align-items:center; border:1px solid var(--control-line); border-radius:var(--radius-sm); overflow:hidden; background:var(--surface); }
    .segmented button { min-height:30px; padding:5px 8px; border:0; border-right:1px solid var(--control-line); background:transparent; cursor:pointer; line-height:1.25; }
    .segmented button:last-child { border-right:0; }
    .segmented button[aria-selected="true"] { background:var(--accent); color:#fff; }
    .size-control { display:grid; grid-template-columns:auto 150px 52px minmax(72px,auto); align-items:center; gap:7px; color:var(--muted); font-size:12px; }
    .size-control input { width:150px; accent-color:var(--accent); }
    .size-control output { color:var(--text); font-variant-numeric:tabular-nums; }
    .size-control .size-layout { min-width:72px; color:var(--muted); white-space:nowrap; }
    .batch-row { margin-top:8px; padding-top:8px; border-top:1px solid var(--line); }
    .batch-row .spacer { flex:1; }
    .batch-row[data-has-selection="false"] #clear-selection,
    .batch-row[data-has-selection="false"] #share-selected,
    .batch-row[data-has-selection="false"] #delete-selected,
    .batch-row[data-has-selection="false"] #selection-summary { display:none; }
    .action, .reset { min-height:var(--control-height); padding:6px 10px; border:1px solid var(--control-line); border-radius:var(--radius-sm); background:var(--surface); cursor:pointer; line-height:1.25; }
    #select-visible { min-width:136px; }
    #share-selected, #delete-selected { min-width:88px; }
    .action.primary { border-color:var(--accent); background:var(--accent); color:#fff; }
    .action.primary:hover { border-color:var(--accent-hover); background:var(--accent-hover); }
    .action.danger { border-color:#FCA5A5; background:var(--danger-bg); color:var(--danger); }
    .action:not(.primary):not(.danger):not(:disabled):hover, .reset:not(:disabled):hover { background:var(--surface-2); }
    .action:disabled, .reset:disabled { opacity:.5; cursor:not-allowed; }
    .message { min-width:160px; color:var(--muted); font-size:13px; }
    .mobile-selection-bar { display:none; }
    main { max-width:1920px; margin:0 auto; padding:16px 18px 40px; }
    .library-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--card-min-width)),1fr)); gap:14px; align-items:start; }
    .library-card { position:relative; min-width:0; overflow:hidden; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); box-shadow:0 1px 3px rgba(15,23,42,.08); }
    .library-card.is-selected { border-color:var(--accent-emphasis); box-shadow:0 0 0 2px color-mix(in srgb,var(--accent-emphasis) 35%,transparent); }
    .selection-control { display:inline-flex; align-items:center; gap:5px; min-height:26px; color:var(--muted); cursor:pointer; white-space:nowrap; }
    .selection-control input { width:17px; height:17px; margin:0; accent-color:var(--accent); }
    .library-card.is-selected .selection-control { color:var(--accent-emphasis); font-weight:600; }
    .image-button { position:relative; display:block; width:100%; aspect-ratio:4/3; padding:0; border:0; border-bottom:1px solid var(--line); background:#fff; cursor:zoom-in; overflow:hidden; }
    .image-button img { width:100%; height:100%; display:block; object-fit:contain; }
    .image-button.is-image-error::after { content:"原图加载失败，请刷新图库"; position:absolute; inset:auto 0 0; padding:7px 8px; background:var(--danger-bg); color:var(--danger); font-size:12px; line-height:1.25; text-align:center; }
    .card-body { padding:10px; }
    .card-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:8px; margin-bottom:6px; }
    .card-body h2 { margin:0; min-height:40px; font-size:14px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .metadata, .detail-line { display:flex; flex-wrap:wrap; gap:4px 9px; color:var(--muted); font-size:12px; }
    .detail-line { align-items:center; margin-top:6px; }
    .source-badge { display:inline-flex; max-width:100%; padding:2px 5px; border:1px solid #BBF7D0; border-radius:var(--radius-sm); background:#F0FDF4; color:#15803D; font-size:11px; }
    .source-badge.unmatched { border-color:#FDE68A; background:#FFFBEB; color:#B45309; }
    .doi { margin-top:6px; overflow:hidden; color:var(--muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
    .palette { display:flex; align-items:center; gap:4px; min-height:23px; margin-top:8px; }
    .palette-swatch { width:22px; height:22px; border:1px solid rgba(0,0,0,.24); border-radius:3px; background:var(--swatch); }
    .tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:7px; }
    .tag { padding:2px 5px; border:1px solid var(--line); border-radius:3px; color:var(--muted); font-size:11px; }
    .card-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
    .button { display:inline-flex; align-items:center; justify-content:center; min-height:var(--control-height); padding:6px 10px; border-radius:var(--radius-sm); text-decoration:none; cursor:pointer; line-height:1.25; }
    .button.primary { border:1px solid var(--accent); background:var(--accent); color:#fff; }
    .button.primary:hover { background:var(--accent-hover); }
    .button.secondary { border:1px solid var(--control-line); background:transparent; color:var(--link); }
    .button.secondary:hover { background:var(--surface-2); }
    .button.is-disabled { color:var(--muted); cursor:not-allowed; opacity:.65; }
    .muted { color:var(--muted); }
    .empty { display:none; padding:64px 20px; text-align:center; color:var(--muted); }
    .empty.is-visible { display:flex; flex-direction:column; align-items:center; gap:10px; }
    .table-view { overflow:visible; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); }
    table { width:100%; border-collapse:collapse; min-width:1050px; }
    th { position:sticky; top:var(--library-header-height); z-index:2; background:var(--surface); text-align:left; font-size:12px; color:var(--muted); }
    th, td { padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:middle; }
    td small { display:block; max-width:360px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }
    .table-preview { width:112px; }
    .table-facts { display:none; }
    .table-image { position:relative; display:block; padding:0; border:0; background:transparent; color:var(--link); cursor:zoom-in; }
    .table-image img { display:block; width:96px; height:72px; object-fit:contain; border:1px solid var(--line); background:#fff; }
    .table-image.is-image-error::after { content:"加载失败"; position:absolute; right:0; bottom:0; padding:1px 4px; border:1px solid var(--danger); background:var(--danger-bg); color:var(--danger); font-size:10px; line-height:1.2; }
    .table-image-label { position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
    .table-title-button { display:block; max-width:100%; padding:0; border:0; background:transparent; color:var(--link); font:inherit; font-weight:600; text-align:left; cursor:zoom-in; }
    .table-title-button:hover, .table-title-button:focus-visible { color:var(--link); text-decoration:underline; }
    .table-link { color:var(--link); white-space:nowrap; }
    .table-link.is-disabled { color:var(--muted); text-decoration:none; }
    .viewer { position:fixed; inset:0; z-index:100; display:grid; grid-template-rows:auto minmax(0,1fr) auto; background:#111827; color:#F8FAFC; }
    .viewer-header, .viewer-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; }
    .viewer-heading { min-width:0; }
    .viewer-header-actions { display:flex; flex:0 0 auto; align-items:center; gap:8px; }
    .viewer-selection { display:inline-flex; align-items:center; gap:6px; min-height:var(--control-height); padding:5px 10px; border:1px solid #94A3B8; border-radius:var(--radius-sm); background:#111827; color:#F8FAFC; cursor:pointer; line-height:1.25; white-space:nowrap; }
    .viewer-selection input { width:16px; height:16px; margin:0; accent-color:#2563EB; }
    .viewer-selection-count { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 5px; border:1px solid rgba(255,255,255,.32); border-radius:3px; background:rgba(0,0,0,.24); color:#fff; font-size:11px; font-variant-numeric:tabular-nums; }
    .viewer-selection.is-selected { border-color:#60A5FA; background:#1E3A8A; }
    .viewer-selection.is-selected .viewer-selection-count { border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A; }
    .viewer-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    .viewer-meta { margin-top:2px; overflow:hidden; color:#cbd3d8; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
    #viewer-close { flex:0 0 auto; min-width:54px; white-space:nowrap; }
    #viewer-close.is-finish { border-color:#2563EB; background:#2563EB; }
    .viewer-stage { min-height:0; padding:0 14px; overflow:auto; overscroll-behavior:contain; }
    .viewer-canvas { display:flex; align-items:center; justify-content:center; min-width:100%; min-height:100%; }
    .viewer-stage img { display:block; flex:0 0 auto; max-width:none; max-height:none; object-fit:contain; background:#fff; }
    .viewer-stage.is-image-error::after { content:"原图加载失败；请刷新图库或重新从 Zotero 打开。"; position:sticky; top:14px; display:block; width:fit-content; max-width:100%; margin:auto; padding:8px 11px; border:1px solid #F87171; border-radius:var(--radius-sm); background:#7F1D1D; color:#FFF; font-size:13px; line-height:1.35; }
    .viewer-status { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .viewer-zoom { display:inline-flex; align-items:center; min-height:var(--control-height); overflow:hidden; border:1px solid #94A3B8; border-radius:var(--radius-sm); background:#111827; }
    .viewer .viewer-zoom button { min-width:32px; min-height:30px; padding:5px 8px; border:0; border-left:1px solid #64748B; border-radius:0; background:transparent; font-weight:600; }
    .viewer .viewer-zoom button:first-child { border-left:0; }
    .viewer .viewer-zoom button:disabled { opacity:.42; cursor:not-allowed; }
    .viewer-zoom output { display:inline-flex; align-items:center; justify-content:center; min-width:76px; min-height:30px; padding:3px 7px; border-left:1px solid rgba(255,255,255,.28); color:#fff; font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .viewer-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .viewer button, .viewer a { display:inline-flex; align-items:center; justify-content:center; min-height:var(--control-height); padding:6px 10px; border:1px solid #94A3B8; border-radius:var(--radius-sm); background:#111827; color:#F8FAFC; text-decoration:none; cursor:pointer; line-height:1.25; }
    .viewer button:hover, .viewer a:not(.is-disabled):hover { background:#1E293B; }
    .viewer a.is-disabled { opacity:.65; cursor:not-allowed; }
    @media (max-width:1450px) { .search-filter-row { grid-template-columns:1fr; } .filter-controls { grid-template-columns:repeat(3,minmax(125px,1fr)); } }
    @media (max-width:1100px) { .table-view { overflow:auto; } th { position:static; } }
    @media (max-width:900px) { .filter-controls { grid-template-columns:1fr 1fr; } .toolbar-row { align-items:flex-start; } }
    @media (max-width:620px) {
      .app-header { position:static; }
      .header-inner, main { padding-left:10px; padding-right:10px; }
      .title-row { gap:4px 8px; margin-bottom:7px; }
      .title-row { padding-right:88px; }
      .title-row .summary { width:100%; }
      .search-filter-row { grid-template-columns:1fr; }
      .filter-panel { border:1px solid var(--control-line); border-radius:var(--radius-sm); background:var(--surface); }
      .filter-panel > summary { display:flex; border:0; }
      .filter-panel > summary::after { content:"展开"; }
      .filter-panel[open] > summary::after { content:"收起"; }
      .filter-controls { grid-template-columns:1fr; padding:0 7px 7px; }
      .filter-collapse { display:none; }
      .size-control { grid-template-columns:auto minmax(80px,1fr) 52px auto; width:100%; }
      .size-control input { width:100%; }
      .batch-row { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
      .batch-row .action { width:100%; }
      .batch-row .spacer { display:none; }
      .batch-row .message, #selection-summary { grid-column:1/-1; width:100%; }
      body.has-mobile-selection-bar main { padding-bottom:104px; }
      .mobile-selection-bar { position:fixed; left:10px; right:10px; bottom:calc(8px + env(safe-area-inset-bottom,0px)); z-index:50; display:flex; align-items:center; gap:6px; padding:8px; border:1px solid var(--control-line); border-radius:6px; background:var(--surface); box-shadow:0 4px 18px rgba(0,0,0,.2); }
      .mobile-selection-bar strong { flex:1 1 auto; min-width:0; overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
      .mobile-selection-bar .action { flex:0 0 auto; min-width:0; min-height:var(--control-height); padding:6px 8px; white-space:nowrap; }
      .table-view { overflow:visible; }
      .table-view table { min-width:0; table-layout:fixed; }
      .table-view th, .table-view td { box-sizing:border-box; padding:6px 5px; }
      .table-category, .table-year, .table-page, .table-size, .table-source-status { display:none; }
      .table-select { width:36px; text-align:center; }
      .table-preview { width:78px; }
      .table-source { width:78px; font-size:12px; }
      .table-image { display:block; width:68px; }
      .table-image img { width:68px; height:51px; }
      .table-paper { overflow-wrap:anywhere; }
      .table-paper .table-title-button { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
      .table-paper small { max-width:none; white-space:normal; }
      .table-paper .table-doi { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .table-paper .table-facts { display:block; }
      .viewer-header { align-items:stretch; flex-direction:column; gap:7px; padding:8px 10px; }
      .viewer-heading { width:100%; }
      .viewer-header-actions { justify-content:space-between; width:100%; gap:6px; }
      .viewer-selection { padding:5px 7px; }
      .viewer-title, .viewer-meta { white-space:normal; }
      .viewer-title { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .viewer-meta { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .viewer-stage { padding:0 6px; }
      .viewer-footer { align-items:flex-start; flex-direction:column; gap:7px; padding:8px 10px; }
      .viewer-status { justify-content:space-between; width:100%; }
      .viewer-zoom output { min-width:68px; }
      .viewer-actions { width:100%; }
      .viewer-actions > * { flex:1 1 auto; }
    }
    @media (prefers-color-scheme:dark) { :root { --bg:#0F172A; --surface:#111827; --surface-2:#1E293B; --text:#F8FAFC; --muted:#94A3B8; --line:#334155; --control-line:#64748B; --accent:#2563EB; --accent-hover:#1D4ED8; --accent-emphasis:#60A5FA; --link:#60A5FA; --danger:#F85149; --danger-bg:#111827; } .library-card { box-shadow:none; } .source-badge { background:#111827; color:#22C55E; border-color:#16A34A; } .source-badge.unmatched { background:#111827; color:#F59E0B; border-color:#D97706; } }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-inner">
      <div class="title-row"><h1>论文图片库</h1><span class="summary" id="library-summary">${list.length} 张 · ${formatBytes(totalBytes)} · 更新于 ${escapeHTML(formatLibraryGeneratedTime(createdAt))}${skippedCount ? ` · 跳过 ${normalizeNonNegativeInteger(skippedCount, 0)} 条无效记录` : ""}</span><button class="action" id="refresh-library" type="button">刷新图库</button></div>
      <p class="library-source-note" id="library-source-note">已自动读取本机固定外部图片库；导入分享包仅用于接收他人图片。</p>
      <div class="search-filter-row">
        <input class="control search" id="library-search" type="search" placeholder="搜索论文、DOI、年份、页码或标签" aria-label="搜索图片库">
        <details class="filter-panel" id="library-filter-panel">
          <summary><span>筛选与排序</span><span class="filter-panel-summary" id="library-filter-summary">未筛选</span></summary>
          <div class="filter-controls">
            <select class="control" id="library-category" aria-label="按图片类别筛选"><option value="">全部类别</option>${optionHTML(categoryCounts, (value) => getSavedImageCategoryLabel(value))}</select>
            <select class="control" id="library-color" aria-label="按色系筛选"><option value="">全部色系</option>${optionHTML(colorCounts, (value) => formatColorFamilyLabel(value))}</select>
            <select class="control" id="library-year" aria-label="按年份筛选"><option value="">全部年份</option>${yearOptionsHTML}</select>
            <select class="control" id="library-source" aria-label="按文献匹配状态筛选"><option value="">全部来源</option><option value="linked">可定位本机文献</option><option value="unmatched">仅文献信息</option></select>
            <select class="control" id="library-sort" aria-label="图片排序"><option value="newest">最新保存</option><option value="oldest">最早保存</option><option value="title">论文标题</option><option value="year-desc">年份从新到旧</option><option value="page">页码从小到大</option><option value="category">图片类别</option><option value="size-desc">文件从大到小</option></select>
            <div class="filter-actions"><button class="reset" id="library-reset" type="button" disabled>清除筛选</button><button class="reset filter-collapse" id="library-filter-collapse" type="button" title="收起筛选与排序，保留当前条件">收起筛选</button></div>
          </div>
        </details>
      </div>
      <div class="toolbar-row">
        <div class="toolbar-group"><div class="segmented" role="tablist" aria-label="查看方式"><button id="library-view-gallery" type="button" data-view="gallery" role="tab" aria-selected="true" aria-controls="library-grid" tabindex="0">图库</button><button id="library-view-table" type="button" data-view="table" role="tab" aria-selected="false" aria-controls="library-table" tabindex="-1">表格</button></div><span class="summary" id="library-status" role="status" aria-live="polite" hidden>显示 ${list.length} 张，共 ${list.length} 张</span></div>
        <label class="size-control" id="library-size-control" for="library-card-size"><span>图片目标宽度</span><input id="library-card-size" type="range" min="220" max="460" step="20" value="280" aria-describedby="library-card-layout"><output id="library-card-size-value" for="library-card-size">280 像素</output><output class="size-layout" id="library-card-layout" aria-live="polite">每行自动排布</output></label>
      </div>
      <div class="batch-row" id="library-batch-row" data-has-selection="false">
        <button class="action" id="select-visible" type="button">全选当前 ${list.length} 张</button><button class="action" id="clear-selection" type="button" disabled>清空选择</button><strong id="selection-summary" role="status" aria-live="polite" title="当前没有选择">未选择图片</strong>
        <span class="spacer"></span><button class="action" id="import-package" type="button">导入分享包</button><button class="action primary" id="share-selected" type="button" disabled>分享所选</button><button class="action danger" id="delete-selected" type="button" disabled>删除所选</button>
        <span class="message" id="library-message" data-default-guidance="${pageBridgeToken ? "true" : "false"}" aria-live="polite">${pageBridgeToken ? "图片库已自动读取外部数据库；勾选后批量操作；导入分享包用于接收他人图片" : "管理功能不可用，请保持 Zotero 运行并从 Zotero 重新打开图库"}</span>
      </div>
    </div>
  </header>
  <main>
    <section class="library-grid" id="library-grid" role="tabpanel" aria-labelledby="library-view-gallery">${cardsHTML}</section>
    <section class="table-view" id="library-table" role="tabpanel" aria-labelledby="library-view-table" hidden><table><thead><tr><th class="table-select">选择</th><th class="table-preview">预览</th><th class="table-paper">论文</th><th class="table-category">类别</th><th class="table-year">年份</th><th class="table-page">页码</th><th class="table-size">大小</th><th class="table-source-status">来源状态</th><th class="table-source">来源</th></tr></thead><tbody>${rowsHTML}</tbody></table></section>
    <div class="empty${list.length ? "" : " is-visible"}" id="library-empty"><span>${list.length ? "没有符合当前筛选条件的图片" : "尚无已保存图片；图片库会自动读取 Zotero 外部数据库。需要接收他人图片时使用上方“导入分享包”。"}</span>${list.length ? '<button class="action" id="library-empty-reset" type="button">清除筛选并显示全部</button>' : ""}</div>
  </main>
  <div class="mobile-selection-bar" id="mobile-selection-bar" role="toolbar" aria-label="移动端批量操作" hidden><strong id="mobile-selection-summary" role="status" aria-live="polite">未选择图片</strong><button class="action" id="mobile-clear-selection" type="button">清空</button><button class="action primary" id="mobile-share-selected" type="button">分享 0 张</button><button class="action danger" id="mobile-delete-selected" type="button">删除 0 张</button></div>
  <div class="viewer" id="library-viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" aria-describedby="viewer-meta viewer-position" aria-keyshortcuts="Escape ArrowLeft ArrowRight = - 0 1" hidden>
    <div class="viewer-header"><div class="viewer-heading"><div class="viewer-title" id="viewer-title"></div><div class="viewer-meta" id="viewer-meta"></div></div><div class="viewer-header-actions"><label class="viewer-selection" id="viewer-selection-label" title="将当前图片加入批量选择；当前共选择 0 张"><input id="viewer-select" type="checkbox" aria-label="将当前图片加入批量选择；当前共选择 0 张"><span>加入批量</span><output class="viewer-selection-count" id="viewer-selection-count" aria-live="polite" title="当前共选择 0 张图片">0</output></label><button type="button" id="viewer-close" title="关闭高清查看；也可按 Esc">关闭</button></div></div>
    <div class="viewer-stage" id="viewer-stage"><div class="viewer-canvas" id="viewer-canvas"><img id="viewer-image" alt=""></div></div>
    <div class="viewer-footer"><div class="viewer-status"><span id="viewer-position" title="可按左右方向键切换图片"></span><div class="viewer-zoom" role="group" aria-label="图像缩放"><button type="button" id="viewer-zoom-out" aria-label="缩小图像" aria-keyshortcuts="-" title="缩小图像；也可按减号键">−</button><output id="viewer-zoom-value" aria-live="polite">适应窗口</output><button type="button" id="viewer-zoom-in" aria-label="放大图像" aria-keyshortcuts="=" title="放大图像；也可按加号键">＋</button><button type="button" id="viewer-zoom-actual" aria-label="按原始像素显示" aria-keyshortcuts="1" title="按原始像素显示；也可按数字 1">1:1</button><button type="button" id="viewer-zoom-fit" aria-label="完整显示当前图片" aria-keyshortcuts="0" title="完整显示当前图片；也可按数字 0">适应</button></div></div><div class="viewer-actions"><button type="button" id="viewer-prev" aria-label="查看上一张图片" aria-keyshortcuts="ArrowLeft" title="查看上一张图片；也可按方向键左">← 上一张</button><button type="button" id="viewer-next" aria-label="查看下一张图片" aria-keyshortcuts="ArrowRight" title="查看下一张图片；也可按方向键右">下一张 →</button><a id="viewer-download" href="" download title="下载当前完整原图">下载原图</a><a id="viewer-source" href="" title="定位当前图片的本机文献">定位原文</a></div></div>
  </div>
  <script data-paper-image-library-version="${GLOBAL_LIBRARY_VIEW_VERSION}">
    (() => {
      const records = ${serializedLibraryData};
      let currentPaperKey = ${JSON.stringify(normalizeItemKey(initialPdfAttachmentKey, ""))};
      const bridge = ${serializedBridgeConfig};
      let managementAvailable = Boolean(bridge.url && bridge.token);
      const managementRecoveryHint = "请保持 Zotero 运行并从 Zotero 重新打开图库";
      const byID = new Map(records.map((record) => [record.id, record]));
      const selected = new Set();
      const grid = document.getElementById("library-grid");
      const table = document.getElementById("library-table");
      const appHeader = document.querySelector(".app-header");
      const tableBody = table.querySelector("tbody");
      const cards = Array.from(grid.querySelectorAll(".library-card"));
      const rows = new Map(Array.from(tableBody.querySelectorAll("tr")).map((row) => [row.dataset.id, row]));
      const search = document.getElementById("library-search");
      const category = document.getElementById("library-category");
      const color = document.getElementById("library-color");
      const year = document.getElementById("library-year");
      const source = document.getElementById("library-source");
      const sort = document.getElementById("library-sort");
      const reset = document.getElementById("library-reset");
      const filterPanel = document.getElementById("library-filter-panel");
      const filterPanelSummary = filterPanel.querySelector("summary");
      const filterSummary = document.getElementById("library-filter-summary");
      const filterCollapse = document.getElementById("library-filter-collapse");
      const status = document.getElementById("library-status");
      const message = document.getElementById("library-message");
      const empty = document.getElementById("library-empty");
      const emptyReset = document.getElementById("library-empty-reset");
      if (currentPaperKey) {
        search.value = "";
      }
      const selectVisible = document.getElementById("select-visible");
      const clearSelection = document.getElementById("clear-selection");
      const shareSelected = document.getElementById("share-selected");
      const deleteSelected = document.getElementById("delete-selected");
      const refreshLibrary = document.getElementById("refresh-library");
      const importPackage = document.getElementById("import-package");
      const selectionSummary = document.getElementById("selection-summary");
      const batchRow = document.getElementById("library-batch-row");
      const mobileSelectionBar = document.getElementById("mobile-selection-bar");
      const mobileSelectionSummary = document.getElementById("mobile-selection-summary");
      const mobileClearSelection = document.getElementById("mobile-clear-selection");
      const mobileShareSelected = document.getElementById("mobile-share-selected");
      const mobileDeleteSelected = document.getElementById("mobile-delete-selected");
      const sizeInput = document.getElementById("library-card-size");
      const sizeValue = document.getElementById("library-card-size-value");
      const sizeLayout = document.getElementById("library-card-layout");
      const sizeControl = document.getElementById("library-size-control");
      const viewButtons = Array.from(document.querySelectorAll("button[data-view]"));
      const viewer = document.getElementById("library-viewer");
      const viewerStage = document.getElementById("viewer-stage");
      const viewerCanvas = document.getElementById("viewer-canvas");
      const viewerImage = document.getElementById("viewer-image");
      const viewerTitle = document.getElementById("viewer-title");
      const viewerMeta = document.getElementById("viewer-meta");
      const viewerPosition = document.getElementById("viewer-position");
      const viewerSource = document.getElementById("viewer-source");
      const viewerDownload = document.getElementById("viewer-download");
      const viewerSelect = document.getElementById("viewer-select");
      const viewerSelectionLabel = document.getElementById("viewer-selection-label");
      const viewerSelectionText = viewerSelectionLabel.querySelector("span");
      const viewerSelectionCount = document.getElementById("viewer-selection-count");
      const viewerClose = document.getElementById("viewer-close");
      const viewerZoomOut = document.getElementById("viewer-zoom-out");
      const viewerZoomIn = document.getElementById("viewer-zoom-in");
      const viewerZoomActual = document.getElementById("viewer-zoom-actual");
      const viewerZoomFit = document.getElementById("viewer-zoom-fit");
      const viewerZoomValue = document.getElementById("viewer-zoom-value");
      const syncDownloadFailure = (download, failed) => {
        if (!download) return;
        if (failed) {
          if (!download.dataset.failureHref) {
            download.dataset.failureHref = download.getAttribute("href") || "";
            download.dataset.failureName = download.getAttribute("download") || "";
          }
          download.removeAttribute("href");
          download.removeAttribute("download");
          download.classList.add("is-disabled");
          download.setAttribute("aria-disabled", "true");
          download.title = "原图加载失败，请刷新图库";
          return;
        }
        if (!download.dataset.failureHref) return;
        if (download.dataset.failureHref) download.href = download.dataset.failureHref;
        if (download.dataset.failureName) download.download = download.dataset.failureName;
        delete download.dataset.failureHref;
        delete download.dataset.failureName;
        download.classList.remove("is-disabled");
        download.removeAttribute("aria-disabled");
      };
      const syncImageFailure = (image, failed) => {
        if (!image || image.tagName !== "IMG") return;
        const host = image.closest?.(".image-button,.table-image");
        if (host) {
          if (failed && !host.dataset.originalAria) {
            host.dataset.originalAria = host.getAttribute("aria-label") || "";
          }
          if (host.dataset.originalAria !== undefined) {
            const originalAria = host.dataset.originalAria;
            host.setAttribute("aria-label", failed
              ? (originalAria ? originalAria + "；" : "") + "原图加载失败，请刷新图库"
              : originalAria);
            if (!originalAria && !failed) host.removeAttribute("aria-label");
          }
          host.classList.toggle("is-image-error", failed);
          syncDownloadFailure(host.closest(".library-card")?.querySelector(".card-actions a[data-download-image]"), failed);
        }
        if (image === viewerImage) {
          viewerStage.classList.toggle("is-image-error", failed);
          syncDownloadFailure(viewerDownload, failed);
        }
      };
      document.addEventListener("load", (event) => syncImageFailure(event.target, false), true);
      document.addEventListener("error", (event) => syncImageFailure(event.target, true), true);
      const syncInitialImageFailures = () => {
        for (const image of document.querySelectorAll(".image-button img,.table-image img")) {
          if (image.complete && !image.naturalWidth) syncImageFailure(image, true);
        }
      };
      syncInitialImageFailures();
      let visibleCards = cards.slice();
      let viewerIndex = -1;
      let viewerReturnFocus = null;
      let viewerZoomMode = "fit";
      let commandBusy = false;
      let selectionAnchorID = null;
      let pendingSelectionGesture = null;
      const mobileFilters = window.matchMedia("(max-width:620px)");
      const compare = (left, right) => {
        const mode = sort.value;
        if (mode === "oldest") return String(left.dataset.created).localeCompare(String(right.dataset.created));
        if (mode === "title") return String(left.dataset.title).localeCompare(String(right.dataset.title), "zh-CN");
        if (mode === "year-desc") return String(right.dataset.year).localeCompare(String(left.dataset.year)) || String(left.dataset.title).localeCompare(String(right.dataset.title), "zh-CN");
        if (mode === "page") return Number(left.dataset.page) - Number(right.dataset.page) || String(left.dataset.title).localeCompare(String(right.dataset.title), "zh-CN");
        if (mode === "category") return String(left.dataset.category).localeCompare(String(right.dataset.category)) || String(left.dataset.title).localeCompare(String(right.dataset.title), "zh-CN");
        if (mode === "size-desc") return Number(right.dataset.size) - Number(left.dataset.size);
        return String(right.dataset.created).localeCompare(String(left.dataset.created));
      };
      const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
      };
      const viewerZoomSteps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
      const getViewerViewportSize = () => {
        const style = getComputedStyle(viewerStage);
        const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
        const verticalPadding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
        return {
          width: Math.max(1, viewerStage.clientWidth - horizontalPadding),
          height: Math.max(1, viewerStage.clientHeight - verticalPadding),
        };
      };
      const getViewerFitScale = () => {
        if (!viewerImage.naturalWidth || !viewerImage.naturalHeight) return 1;
        const viewport = getViewerViewportSize();
        return Math.min(viewport.width / viewerImage.naturalWidth, viewport.height / viewerImage.naturalHeight, 1);
      };
      const renderViewerZoom = (center = true) => {
        if (viewer.hidden || !viewerImage.naturalWidth || !viewerImage.naturalHeight) return;
        const viewport = getViewerViewportSize();
        const fitScale = getViewerFitScale();
        const scale = viewerZoomMode === "fit"
          ? fitScale
          : Math.min(4, Math.max(0.25, Number(viewerZoomMode) || 1));
        const displayWidth = Math.max(1, Math.round(viewerImage.naturalWidth * scale));
        const displayHeight = Math.max(1, Math.round(viewerImage.naturalHeight * scale));
        viewerCanvas.style.width = viewerZoomMode === "fit" ? "100%" : Math.max(viewport.width, displayWidth) + "px";
        viewerCanvas.style.height = viewerZoomMode === "fit" ? "100%" : Math.max(viewport.height, displayHeight) + "px";
        viewerImage.style.width = displayWidth + "px";
        viewerImage.style.height = displayHeight + "px";
        const label = viewerZoomMode === "fit" ? "适应窗口" : Math.round(scale * 100) + "%";
        viewerZoomValue.value = label;
        viewerZoomValue.textContent = label;
        viewerZoomOut.disabled = scale <= fitScale + 0.005;
        viewerZoomIn.disabled = scale >= 3.995;
        viewerZoomFit.disabled = viewerZoomMode === "fit";
        viewerZoomActual.disabled = viewerZoomMode !== "fit" && Math.abs(scale - 1) < 0.005;
        if (center) {
          viewerStage.scrollLeft = Math.max(0, (viewerStage.scrollWidth - viewerStage.clientWidth) / 2);
          viewerStage.scrollTop = Math.max(0, (viewerStage.scrollHeight - viewerStage.clientHeight) / 2);
        }
      };
      const setViewerZoom = (mode) => {
        viewerZoomMode = mode === "fit" ? "fit" : Math.min(4, Math.max(0.25, Number(mode) || 1));
        renderViewerZoom(true);
      };
      const stepViewerZoom = (direction) => {
        const fitScale = getViewerFitScale();
        const current = viewerZoomMode === "fit" ? fitScale : Number(viewerZoomMode);
        if (direction > 0) {
          setViewerZoom(viewerZoomSteps.find((step) => step > current + 0.005) || 4);
          return;
        }
        const previous = viewerZoomSteps.slice().reverse().find((step) => step < current - 0.005);
        if (!previous || previous <= fitScale + 0.005) setViewerZoom("fit");
        else setViewerZoom(previous);
      };
      const desktopBatchGuidance = "勾选后批量操作；按 Shift 连续选择；导入无需选择";
      const mobileBatchGuidance = "勾选图片后使用底部栏批量操作；导入无需选择";
      const setMessage = (text) => { message.dataset.defaultGuidance = "false"; message.textContent = text; };
      const syncResponsiveBatchGuidance = () => {
        if (message.dataset.defaultGuidance !== "true") return;
        message.textContent = mobileFilters.matches ? mobileBatchGuidance : desktopBatchGuidance;
      };
      const syncResponsiveSelectionHints = () => {
        const hint = managementAvailable
          ? mobileFilters.matches
            ? "选中后使用底部栏批量操作"
            : "电脑端按住 Shift 可连续选择"
          : managementRecoveryHint;
        const title = managementAvailable ? "选择图片；" + hint : "批量选择不可用；" + hint;
        document.querySelectorAll("[data-select-image]").forEach((input) => {
          input.disabled = !managementAvailable;
          input.title = title;
          input.setAttribute("aria-label", managementAvailable
            ? (input.dataset.selectionLabel || "选择图片") + "；" + hint
            : title);
          const label = input.closest(".selection-control");
          if (label) label.title = title;
        });
      };
      const selectedOptionLabel = (control) => String(control.options?.[control.selectedIndex]?.textContent || "").replace(/（[0-9]+）$/, "").trim();
      const activeFilterLabels = () => [
        search.value.trim() ? "搜索：" + search.value.trim() : "",
        category.value ? selectedOptionLabel(category) : "",
        color.value ? selectedOptionLabel(color) : "",
        year.value ? "年份：" + selectedOptionLabel(year) : "",
        source.value ? selectedOptionLabel(source) : "",
        sort.value !== "newest" ? "排序：" + selectedOptionLabel(sort) : "",
      ].filter(Boolean);
      const activeFilterCount = () => [
        category.value,
        color.value,
        year.value,
        source.value,
        sort.value !== "newest" ? sort.value : "",
      ].filter(Boolean).length;
      const syncFilterPanel = () => {
        const labels = activeFilterLabels();
        filterSummary.textContent = labels.length > 1 ? labels[0] + " 等 " + labels.length + " 项" : labels[0] || "未筛选";
        filterSummary.title = labels.length ? "当前条件：" + labels.join("；") : "当前没有筛选条件";
        filterSummary.setAttribute("aria-label", filterSummary.title);
        filterPanel.classList.toggle("is-active", labels.length > 0);
      };
      const syncResponsiveFilterPanel = () => {
        if (mobileFilters.matches && !activeFilterCount()) filterPanel.open = false;
      };
      const syncResponsiveUI = () => {
        syncResponsiveFilterPanel();
        syncResponsiveBatchGuidance();
        syncResponsiveSelectionHints();
      };
      const getSelectionScope = () => {
        const visibleIDs = new Set(visibleCards.map((card) => card.dataset.id));
        const visible = Array.from(selected).filter((id) => visibleIDs.has(id)).length;
        return { visible, hidden: Math.max(0, selected.size - visible) };
      };
      const syncViewerSelection = () => {
        const imageID = viewer.hidden ? "" : String(visibleCards[viewerIndex]?.dataset.id || "");
        const isSelected = !!imageID && selected.has(imageID);
        viewerSelect.checked = isSelected;
        viewerSelect.disabled = !imageID || !managementAvailable;
        viewerSelectionLabel.classList.toggle("is-selected", isSelected);
        viewerSelectionText.textContent = !managementAvailable ? "批量不可用" : isSelected ? "移出批量" : "加入批量";
        viewerSelectionCount.value = String(selected.size);
        viewerSelectionCount.textContent = String(selected.size);
        viewerSelectionCount.title = "当前共选择 " + selected.size + " 张图片";
        const actionLabel = isSelected ? "取消当前图片的批量选择" : "将当前图片加入批量选择";
        const selectionLabel = managementAvailable
          ? actionLabel + "；当前共选择 " + selected.size + " 张"
          : "批量选择不可用；" + managementRecoveryHint;
        viewerSelectionLabel.title = selectionLabel;
        viewerSelect.title = selectionLabel;
        viewerSelect.setAttribute("aria-label", selectionLabel);
        const finishSelection = managementAvailable && selected.size > 0;
        viewerClose.textContent = finishSelection ? "完成选择" : "关闭";
        viewerClose.title = finishSelection ? "关闭高清查看并前往批量操作；按 Esc 仅关闭查看" : "关闭高清查看；也可按 Esc";
        viewerClose.classList.toggle("is-finish", finishSelection);
      };
      const syncSelection = () => {
        document.querySelectorAll("[data-select-image]").forEach((input) => { input.checked = selected.has(input.dataset.selectImage); });
        cards.forEach((card) => card.classList.toggle("is-selected", selected.has(card.dataset.id)));
        const selectedBytes = Array.from(selected).reduce((sum, id) => sum + Number(byID.get(id)?.imageBytes || 0), 0);
        const selectionScope = getSelectionScope();
        selectionSummary.textContent = selected.size
          ? "已选择 " + selected.size + " 张 · " + formatSize(selectedBytes) + (selectionScope.hidden ? " · 当前筛选外 " + selectionScope.hidden + " 张" : "")
          : "未选择图片";
        selectionSummary.title = selectionScope.hidden
          ? "批量分享和删除会包含当前筛选外的 " + selectionScope.hidden + " 张图片"
          : selected.size
            ? "批量操作将处理当前所选 " + selected.size + " 张图片"
            : "当前没有选择";
        batchRow.dataset.hasSelection = selected.size ? "true" : "false";
        clearSelection.disabled = selected.size === 0;
        clearSelection.textContent = selected.size
          ? selectionScope.hidden ? "清空全部 " + selected.size + " 张" : "清空已选 " + selected.size + " 张"
          : "清空选择";
        shareSelected.disabled = selected.size === 0 || commandBusy || !managementAvailable;
        deleteSelected.disabled = selected.size === 0 || commandBusy || !managementAvailable;
        shareSelected.textContent = selected.size ? "分享 " + selected.size + " 张" : "分享所选";
        deleteSelected.textContent = selected.size ? "删除 " + selected.size + " 张" : "删除所选";
        const hiddenScopeText = selectionScope.hidden ? "，其中当前筛选外 " + selectionScope.hidden + " 张" : "";
        const shareLabel = managementAvailable
          ? selected.size ? "分享全部所选 " + selected.size + " 张" + hiddenScopeText : "请先选择要分享的图片"
          : "分享不可用；" + managementRecoveryHint;
        const deleteLabel = managementAvailable
          ? selected.size ? "删除全部所选 " + selected.size + " 张" + hiddenScopeText : "请先选择要删除的图片"
          : "删除不可用；" + managementRecoveryHint;
        shareSelected.title = shareLabel;
        shareSelected.setAttribute("aria-label", shareLabel);
        deleteSelected.title = deleteLabel;
        deleteSelected.setAttribute("aria-label", deleteLabel);
        const clearLabel = selected.size ? "清空全部 " + selected.size + " 张选择" + hiddenScopeText : "当前没有选择";
        clearSelection.title = clearLabel;
        clearSelection.setAttribute("aria-label", clearLabel);
        mobileSelectionBar.hidden = selected.size === 0;
        document.body.classList.toggle("has-mobile-selection-bar", selected.size > 0);
        mobileSelectionSummary.textContent = selected.size ? "已选 " + selected.size + " 张" + (selectionScope.hidden ? " · 筛选外 " + selectionScope.hidden + " 张" : "") : "未选择图片";
        mobileSelectionSummary.title = selectionSummary.title;
        mobileClearSelection.disabled = clearSelection.disabled;
        mobileClearSelection.title = clearLabel;
        mobileClearSelection.setAttribute("aria-label", clearLabel);
        mobileShareSelected.disabled = shareSelected.disabled;
        mobileShareSelected.textContent = selected.size ? "分享 " + selected.size + " 张" : "分享";
        mobileShareSelected.title = shareLabel;
        mobileShareSelected.setAttribute("aria-label", shareLabel);
        mobileDeleteSelected.disabled = deleteSelected.disabled;
        mobileDeleteSelected.textContent = selected.size ? "删除 " + selected.size + " 张" : "删除";
        mobileDeleteSelected.title = deleteLabel;
        mobileDeleteSelected.setAttribute("aria-label", deleteLabel);
        importPackage.disabled = commandBusy || !managementAvailable;
        const importLabel = managementAvailable ? "导入图片包" : "导入不可用；" + managementRecoveryHint;
        importPackage.title = importLabel;
        importPackage.setAttribute("aria-label", importLabel);
        const visibleIDs = visibleCards.map((card) => card.dataset.id);
        const allVisibleSelected = visibleIDs.length > 0 && visibleIDs.every((id) => selected.has(id));
        selectVisible.textContent = (allVisibleSelected ? "取消当前 " : "全选当前 ") + visibleIDs.length + " 张";
        const visibleScopeLabel = visibleIDs.length
          ? allVisibleSelected
            ? "取消当前结果中的 " + visibleIDs.length + " 张选择；筛选外选择保留"
            : "选择当前结果中的 " + visibleIDs.length + " 张图片"
          : "当前没有可选择的图片";
        selectVisible.title = visibleScopeLabel;
        selectVisible.setAttribute("aria-label", visibleScopeLabel);
        if (!managementAvailable) {
          selectVisible.title = "批量选择不可用；" + managementRecoveryHint;
          selectVisible.setAttribute("aria-label", selectVisible.title);
        }
        selectVisible.disabled = visibleIDs.length === 0 || !managementAvailable;
        if (!viewer.hidden) syncViewerSelection();
      };
      const apply = () => {
        const query = search.value.trim().toLowerCase();
        const resultSubsetActive = Boolean(currentPaperKey || query || category.value || color.value || year.value || source.value);
        visibleCards = cards.filter((card) => (!query || card.dataset.search.includes(query))
          && (!category.value || card.dataset.category === category.value)
          && (!color.value || card.dataset.color === color.value)
          && (!year.value || card.dataset.year === year.value)
          && (!source.value || card.dataset.source === source.value)
          && (!currentPaperKey || card.dataset.pdfAttachmentKey === currentPaperKey));
        visibleCards.sort(compare);
        const visibleIDs = new Set(visibleCards.map((card) => card.dataset.id));
        for (const card of cards) card.hidden = !visibleIDs.has(card.dataset.id);
        for (const row of rows.values()) row.hidden = !visibleIDs.has(row.dataset.id);
        for (const card of visibleCards) grid.append(card);
        for (const card of visibleCards) tableBody.append(rows.get(card.dataset.id));
        status.textContent = "显示 " + visibleCards.length + " 张，共 " + cards.length + " 张";
        status.hidden = !resultSubsetActive;
        empty.classList.toggle("is-visible", visibleCards.length === 0);
        reset.disabled = !(currentPaperKey || query || category.value || color.value || year.value || source.value || sort.value !== "newest");
        syncFilterPanel();
        syncSelection();
        syncCardLayout();
      };
      const resetFilters = () => {
        currentPaperKey = "";
        search.value = "";
        category.value = "";
        color.value = "";
        year.value = "";
        source.value = "";
        sort.value = "newest";
        apply();
        search.focus();
      };
      const postCommand = async (command, fields = {}) => {
        if (!bridge.url || !bridge.token) throw new Error("Zotero 管理连接不可用，请从 Zotero 重新打开图库");
        const body = new URLSearchParams({ token: bridge.token, command });
        Object.entries(fields).forEach(([key, value]) => body.set(key, String(value)));
        const response = await fetch(bridge.url, { method: "POST", body });
        let result = null;
        try { result = await response.json(); } catch (_error) { throw new Error("Zotero 返回了无法识别的结果"); }
        if (!response.ok || !result?.ok) {
          const errorLabels = {
            "Bridge endpoint not registered": "Zotero 图库连接尚未就绪，请从 Zotero 重新打开图库",
            "Bridge command invalid": "图库操作命令无效",
            "Bridge token invalid": "图库连接已过期，请从 Zotero 重新打开图库",
            "Image not found": "所选图片已不存在",
            "Requested Zotero URI invalid": "该图片的本机文献定位信息无效",
          };
          throw new Error(errorLabels[result?.error] || "图库操作失败，请查看 Zotero 错误控制台");
        }
        return result;
      };
      const runCommand = async (label, callback) => {
        if (commandBusy) return null;
        commandBusy = true;
        setMessage(label);
        syncSelection();
        try { return await callback(); }
        catch (error) {
          const detail = String(error?.message || "");
          const connectionLost = !/[\u3400-\u9fff]/.test(detail)
            || /Zotero 管理连接不可用|Zotero 图库连接尚未就绪|图库连接已过期/.test(detail);
          if (connectionLost) {
            managementAvailable = false;
            selected.clear();
            selectionAnchorID = null;
            syncResponsiveSelectionHints();
            setMessage("管理功能不可用，" + managementRecoveryHint);
          } else {
            setMessage(detail);
          }
          return null;
        }
        finally { commandBusy = false; syncSelection(); }
      };
      const showRecord = (index, opener = null) => {
        if (!visibleCards.length) return;
        const opening = viewer.hidden;
        if (opening) viewerReturnFocus = opener || document.activeElement;
        viewerIndex = (index + visibleCards.length) % visibleCards.length;
        const record = byID.get(visibleCards[viewerIndex].dataset.id);
        if (!record) return;
        const sourceURI = record.openPDFURI || record.selectItemURI || "";
        viewerZoomMode = "fit";
        viewerZoomValue.value = "适应窗口";
        viewerZoomValue.textContent = "适应窗口";
        viewerStage.classList.remove("is-image-error");
        viewerImage.src = record.imageURL;
        viewerImage.alt = record.title + "，第 " + record.pageNumber + " 页";
        viewerTitle.textContent = record.title;
        viewerMeta.textContent = [record.categoryLabel, record.year || "年份未知", "原文第 " + record.pageNumber + " 页", record.dimensions, formatSize(record.imageBytes), record.sourceLabel].join(" · ");
        viewerPosition.textContent = "第 " + (viewerIndex + 1) + " 张，共 " + visibleCards.length + " 张";
        if (sourceURI) {
          viewerSource.href = sourceURI;
          viewerSource.classList.remove("is-disabled");
          viewerSource.removeAttribute("aria-disabled");
          viewerSource.title = record.openPDFURI ? "定位当前图片的 PDF 原文" : "定位当前图片的本机文献";
          viewerSource.textContent = record.openPDFURI ? "定位原文" : "定位文献";
        } else {
          viewerSource.removeAttribute("href");
          viewerSource.classList.add("is-disabled");
          viewerSource.setAttribute("aria-disabled", "true");
          viewerSource.title = "导入图片未匹配到本机文献";
          viewerSource.textContent = "无本机文献";
        }
        viewerDownload.href = record.imageURL;
        viewerDownload.download = record.downloadName;
        viewerDownload.title = "下载为 " + record.downloadName;
        viewer.hidden = false;
        document.body.style.overflow = "hidden";
        syncViewerSelection();
        if (viewerImage.complete && viewerImage.naturalWidth) renderViewerZoom(true);
        if (opening) viewerClose.focus();
      };
      const closeViewer = (focusBatchActions = false) => {
        if (viewer.hidden) return;
        const returnFocus = viewerReturnFocus;
        viewer.hidden = true;
        viewerImage.removeAttribute("src");
        viewerStage.classList.remove("is-image-error");
        document.body.style.overflow = "";
        viewerReturnFocus = null;
        if (focusBatchActions && selected.size) {
          const mobileTarget = !mobileSelectionBar.hidden && getComputedStyle(mobileSelectionBar).display !== "none"
            ? mobileShareSelected.disabled ? mobileClearSelection : mobileShareSelected
            : null;
          if (mobileTarget) { mobileTarget.focus({ preventScroll: true }); return; }
          batchRow.scrollIntoView({ block: "nearest" });
          const target = shareSelected.disabled ? clearSelection : shareSelected;
          target.focus({ preventScroll: true });
          return;
        }
        returnFocus?.focus?.();
      };
      const syncCardLayout = () => {
        const tracks = grid.hidden ? "" : getComputedStyle(grid).gridTemplateColumns.trim();
        const columns = !tracks || tracks === "none" ? 0 : tracks.split(/\\s+/).filter(Boolean).length;
        const layoutLabel = columns ? "每行最多 " + columns + " 张" : "每行自动排布";
        sizeLayout.value = layoutLabel;
        sizeLayout.textContent = layoutLabel;
        const size = Number(sizeInput.value) || 280;
        const accessibleLabel = "目标宽度 " + size + " 像素；" + layoutLabel + "；窄窗口会自动缩小";
        sizeInput.setAttribute("aria-valuetext", accessibleLabel);
        sizeControl.title = accessibleLabel;
      };
      const setCardSize = (value, persist) => {
        const size = Math.max(220, Math.min(460, Math.round(Number(value) / 20) * 20 || 280));
        sizeInput.value = String(size);
        sizeValue.value = size + " 像素";
        document.documentElement.style.setProperty("--card-min-width", size + "px");
        if (persist) { try { localStorage.setItem("pdf-image-saver-library-card-width-v1", String(size)); } catch (_error) {} }
        syncCardLayout();
      };
      const setLibraryView = (value, persist = false, focus = false) => {
        const mode = value === "table" ? "table" : "gallery";
        document.documentElement.dataset.view = mode;
        grid.hidden = mode !== "gallery";
        table.hidden = mode !== "table";
        sizeControl.hidden = mode !== "gallery";
        if (mode === "gallery") syncCardLayout();
        for (const button of viewButtons) {
          const active = button.dataset.view === mode;
          button.setAttribute("aria-selected", String(active));
          button.tabIndex = active ? 0 : -1;
          if (active && focus) button.focus();
        }
        if (persist) { try { localStorage.setItem("pdf-image-saver-library-view-v1", mode); } catch (_error) {} }
        syncStickyOffset();
      };
      const syncStickyOffset = () => {
        const height = getComputedStyle(appHeader).position === "sticky" ? Math.ceil(appHeader.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty("--library-header-height", height + "px");
      };
      try { setCardSize(localStorage.getItem("pdf-image-saver-library-card-width-v1") || sizeInput.value, false); } catch (_error) { setCardSize(sizeInput.value, false); }
      try { setLibraryView(localStorage.getItem("pdf-image-saver-library-view-v1") || "gallery"); } catch (_error) { setLibraryView("gallery"); }
      try {
        const savedFilterPanelState = localStorage.getItem("pdf-image-saver-library-filters-open-v1");
        if (savedFilterPanelState === "open") filterPanel.open = true;
        else if (savedFilterPanelState === "closed") filterPanel.open = false;
      } catch (_error) {}
      sizeInput.addEventListener("input", () => setCardSize(sizeInput.value, true));
      if (typeof ResizeObserver === "function") new ResizeObserver(syncStickyOffset).observe(appHeader);
      window.addEventListener("resize", () => { syncStickyOffset(); syncCardLayout(); });
      if (typeof mobileFilters.addEventListener === "function") mobileFilters.addEventListener("change", syncResponsiveUI);
      else if (typeof mobileFilters.addListener === "function") mobileFilters.addListener(syncResponsiveUI);
      filterPanel.addEventListener("toggle", () => {
        if (!mobileFilters.matches) {
          try { localStorage.setItem("pdf-image-saver-library-filters-open-v1", filterPanel.open ? "open" : "closed"); } catch (_error) {}
          if (filterPanel.open && document.activeElement === filterPanelSummary) category.focus();
        }
        syncStickyOffset();
      });
      filterPanelSummary.addEventListener("click", () => {
        setTimeout(() => {
          if (!mobileFilters.matches && filterPanel.open) category.focus();
        }, 0);
      });
      filterCollapse.addEventListener("click", () => { filterPanel.open = false; filterPanelSummary.focus(); });
      for (const control of [search, category, color, year, source]) control.addEventListener(control === search ? "input" : "change", apply);
      sort.addEventListener("change", apply);
      reset.addEventListener("click", resetFilters);
      emptyReset?.addEventListener("click", resetFilters);
      document.addEventListener("click", (event) => {
        const input = event.target.closest?.("[data-select-image]");
        if (!input) return;
        pendingSelectionGesture = { imageID: input.dataset.selectImage, shiftKey: event.shiftKey === true };
      }, true);
      document.addEventListener("change", (event) => {
        const input = event.target.closest?.("[data-select-image]");
        if (!input) return;
        const imageID = input.dataset.selectImage;
        const gesture = pendingSelectionGesture?.imageID === imageID ? pendingSelectionGesture : null;
        pendingSelectionGesture = null;
        const visibleIDs = visibleCards.map((card) => card.dataset.id);
        const anchorIndex = gesture?.shiftKey ? visibleIDs.indexOf(selectionAnchorID) : -1;
        const currentIndex = gesture?.shiftKey ? visibleIDs.indexOf(imageID) : -1;
        if (anchorIndex >= 0 && currentIndex >= 0) {
          const rangeIDs = visibleIDs.slice(Math.min(anchorIndex, currentIndex), Math.max(anchorIndex, currentIndex) + 1);
          rangeIDs.forEach((id) => input.checked ? selected.add(id) : selected.delete(id));
          setMessage((input.checked ? "已连续选择 " : "已取消连续选择 ") + rangeIDs.length + " 张图片");
        } else if (input.checked) selected.add(imageID); else selected.delete(imageID);
        selectionAnchorID = imageID;
        syncSelection();
      });
      selectVisible.addEventListener("click", () => {
        const ids = visibleCards.map((card) => card.dataset.id);
        const clear = ids.length && ids.every((id) => selected.has(id));
        ids.forEach((id) => clear ? selected.delete(id) : selected.add(id));
        selectionAnchorID = null;
        syncSelection();
      });
      clearSelection.addEventListener("click", () => {
        const clearedCount = selected.size;
        selected.clear();
        selectionAnchorID = null;
        syncSelection();
        if (clearedCount) setMessage("已清空 " + clearedCount + " 张选择");
      });
      shareSelected.addEventListener("click", () => {
        const selectionScope = getSelectionScope();
        const scopeText = selectionScope.hidden ? "，其中 " + selectionScope.hidden + " 张当前不在筛选结果中" : "";
        void runCommand("正在生成 " + selected.size + " 张图片的分享包" + scopeText + "，请在 Zotero 中选择保存位置…", async () => {
          const result = await postCommand("exportImages", { image_ids: JSON.stringify(Array.from(selected)) });
          if (result.cancelled) { setMessage("已取消分享"); return; }
          setMessage("已分享 " + result.exported + " 张图片，不含 PDF 文献文件");
        });
      });
      importPackage.addEventListener("click", () => void runCommand("请在 Zotero 中选择要导入的图片包…", async () => {
        const result = await postCommand("importImages");
        if (result.cancelled) { setMessage("已取消导入"); return; }
        setMessage("已导入 " + result.imported + " 张；匹配文献 " + result.matched + " 张；未匹配 " + result.unmatched + " 张；跳过 " + result.skipped + " 张");
        if (result.imported) setTimeout(() => location.reload(), 500);
      }));
      refreshLibrary.addEventListener("click", () => void runCommand("正在从外部数据库重新读取图片…", async () => {
        const result = await postCommand("refreshLibrary", { pdf_attachment_key: currentPaperKey });
        setMessage("已刷新图库，共读取 " + result.imageCount + " 张原图");
        setTimeout(() => location.reload(), 120);
      }));
      deleteSelected.addEventListener("click", () => {
        const selectionScope = getSelectionScope();
        const hiddenWarning = selectionScope.hidden ? "其中 " + selectionScope.hidden + " 张当前不在筛选结果中。" : "";
        if (!confirm("确定从本地图片库删除所选 " + selected.size + " 张图片吗？" + hiddenWarning + "该操作不会删除 Zotero 文献或 PDF。")) return;
        void runCommand("正在删除所选图片…", async () => {
          const result = await postCommand("deleteImages", { image_ids: JSON.stringify(Array.from(selected)) });
          setMessage("已删除 " + result.deleted + " 张图片；Zotero 文献和 PDF 未改变");
          if (result.deleted) setTimeout(() => location.reload(), 350);
        });
      });
      mobileClearSelection.addEventListener("click", () => clearSelection.click());
      mobileShareSelected.addEventListener("click", () => shareSelected.click());
      mobileDeleteSelected.addEventListener("click", () => deleteSelected.click());
      document.addEventListener("click", (event) => {
        const sourceLink = event.target.closest?.('a[href^="zotero://"]');
        if (sourceLink) { setMessage("已请求 Zotero 定位来源"); return; }
        const opener = event.target.closest?.("[data-open-image]");
        if (opener) { const index = visibleCards.findIndex((card) => card.dataset.id === opener.dataset.openImage); if (index >= 0) showRecord(index, opener); return; }
        const viewButton = event.target.closest?.("button[data-view]");
        if (viewButton) setLibraryView(viewButton.dataset.view, true);
      });
      document.querySelector(".segmented").addEventListener("keydown", (event) => {
        const current = event.target.closest?.("button[data-view]");
        if (!current) return;
        const index = viewButtons.indexOf(current);
        let target = null;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") target = viewButtons[(index - 1 + viewButtons.length) % viewButtons.length];
        else if (event.key === "ArrowRight" || event.key === "ArrowDown") target = viewButtons[(index + 1) % viewButtons.length];
        else if (event.key === "Home") target = viewButtons[0];
        else if (event.key === "End") target = viewButtons[viewButtons.length - 1];
        if (!target) return;
        event.preventDefault();
        setLibraryView(target.dataset.view, true, true);
      });
      viewerClose.addEventListener("click", () => closeViewer(selected.size > 0));
      document.getElementById("viewer-prev").addEventListener("click", () => showRecord(viewerIndex - 1));
      document.getElementById("viewer-next").addEventListener("click", () => showRecord(viewerIndex + 1));
      viewerSelect.addEventListener("change", () => {
        const imageID = String(visibleCards[viewerIndex]?.dataset.id || "");
        if (!imageID) { viewerSelect.checked = false; return; }
        if (viewerSelect.checked) selected.add(imageID); else selected.delete(imageID);
        selectionAnchorID = imageID;
        syncSelection();
      });
      viewerZoomOut.addEventListener("click", () => stepViewerZoom(-1));
      viewerZoomIn.addEventListener("click", () => stepViewerZoom(1));
      viewerZoomActual.addEventListener("click", () => setViewerZoom(1));
      viewerZoomFit.addEventListener("click", () => setViewerZoom("fit"));
      viewerImage.addEventListener("load", () => renderViewerZoom(true));
      window.addEventListener("resize", () => { if (!viewer.hidden) renderViewerZoom(true); });
      viewer.addEventListener("click", (event) => { if (event.target === viewer || event.target === viewerStage || event.target === viewerCanvas) closeViewer(); });
      document.addEventListener("keydown", (event) => {
        if (viewer.hidden) return;
        if (event.key === "Escape") { event.preventDefault(); closeViewer(); return; }
        if (event.key === "ArrowLeft") { event.preventDefault(); showRecord(viewerIndex - 1); return; }
        if (event.key === "ArrowRight") { event.preventDefault(); showRecord(viewerIndex + 1); return; }
        if (event.key === "+" || event.key === "=" || event.key === "Add") { event.preventDefault(); stepViewerZoom(1); return; }
        if (event.key === "-" || event.key === "Subtract") { event.preventDefault(); stepViewerZoom(-1); return; }
        if (event.key === "0") { event.preventDefault(); setViewerZoom("fit"); return; }
        if (event.key === "1") { event.preventDefault(); setViewerZoom(1); return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(viewer.querySelectorAll('input:not(:disabled),button:not(:disabled),a[href]'));
        if (!focusable.length) { event.preventDefault(); viewer.focus?.(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      if (!managementAvailable) {
        refreshLibrary.disabled = true;
        importPackage.disabled = true;
      }
      apply();
      syncResponsiveUI();
    })();
  </script>
</body>
</html>`;
  }

  function formatLibraryGeneratedTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return "未知时间";
    }
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  async function getSavedPreviewIndexAttachments(parentItem, attachment = null) {
    const candidates = [];
    if (parentItem && typeof parentItem.getAttachments === "function") {
      let childIDs = [];
      try {
        childIDs = parentItem.getAttachments() || [];
      } catch (error) {
        logError(error);
      }
      for (const childID of Array.isArray(childIDs) ? childIDs : []) {
        const item = Zotero.Items.get(childID);
        if (item) {
          candidates.push(item);
        }
      }
    } else if (typeof Zotero.Items?.getAll === "function") {
      try {
        candidates.push(...(Zotero.Items.getAll(attachment?.libraryID) || []));
      } catch (error) {
        logError(error);
      }
    }
    const expectedAttachmentKey = normalizeItemKey(attachment?.key, null);
    const records = [];
    for (const item of candidates) {
      if (!item || item.id === attachment?.id || !isPreviewIndexAttachmentCandidate(item)) {
        continue;
      }
      const metadata = await readPreviewIndexMetadataFromAttachment(item);
      if (!metadata || !isSavedPreviewIndexMetadata(metadata)) {
        continue;
      }
      const sourceKey = normalizeItemKey(metadata?.pdf_attachment?.key, null);
      if (!parentItem && expectedAttachmentKey && sourceKey !== expectedAttachmentKey) {
        continue;
      }
      records.push({ item, metadata });
    }
    return records.sort((left, right) => {
      const rightDate = String(right.metadata?.created_at || getItemField(right.item, "dateModified") || "");
      const leftDate = String(left.metadata?.created_at || getItemField(left.item, "dateModified") || "");
      return rightDate.localeCompare(leftDate) || Number(right.item?.id || 0) - Number(left.item?.id || 0);
    });
  }

  function formatSavedPreviewLabel(record, index = 0) {
    const metadata = record?.metadata || {};
    const entries = Array.isArray(metadata.entries) ? metadata.entries : [];
    const count = entries.length;
    const scope = formatPreviewScopeLabel(metadata.scope);
    const createdAt = normalizeMetadataText(metadata.created_at, "未知时间", 40);
    const pageLabels = [];
    const seenPages = new Set();
    for (const entry of entries) {
      const pageNumber = normalizePageNumber(entry?.pageNumber ?? entry?.page_number, null);
      if (pageNumber === null) {
        continue;
      }
      const pageText = formatPageWithLabel(pageNumber, entry?.pageLabel ?? entry?.page_label);
      if (!seenPages.has(pageText)) {
        seenPages.add(pageText);
        pageLabels.push(pageText);
      }
    }
    const pageSummary = pageLabels.length
      ? `；${pageLabels.slice(0, 3).join("、")}${pageLabels.length > 3 ? "等" : ""}`
      : "";
    return `第 ${index + 1} 组：${count} 张图片；${scope}${pageSummary}；${createdAt}`;
  }

  async function openPreviewIndexAttachment(item) {
    if (!item?.id) {
      throw new Error("Storage failed: preview attachment missing.");
    }
    if (typeof item.getFilePathAsync === "function" && typeof Zotero.launchFile === "function") {
      const sourcePath = await item.getFilePathAsync();
      if (sourcePath) {
        try {
          const filePath = await prepareInteractivePreviewIndexFile(item, sourcePath);
          Zotero.launchFile(filePath);
          return "external";
        } catch (error) {
          safeLogError(error);
        }
      }
    }
    if (typeof Zotero.Reader?.open === "function") {
      await Zotero.Reader.open(item.id);
      return "zotero";
    }
    const pane = Zotero.getMainWindow?.()?.ZoteroPane;
    if (typeof pane?.selectItem === "function") {
      await pane.selectItem(item.id);
      return "selected";
    }
    throw new Error("Storage failed: preview open unavailable.");
  }

  async function prepareInteractivePreviewIndexFile(item, sourcePath) {
    if (
      typeof Zotero.File?.getContentsAsync !== "function"
      || typeof Zotero.File?.putContentsAsync !== "function"
    ) {
      return sourcePath;
    }
    try {
      const sourceHTML = await Zotero.File.getContentsAsync(sourcePath);
      const upgradedHTML = upgradePreviewIndexInteractivityHTML(sourceHTML);
      if (!upgradedHTML || upgradedHTML === sourceHTML) {
        return sourcePath;
      }
      const outputDirectory = PathUtils.join(PathUtils.tempDir, ADDON_REF, "interactive-previews");
      await ensureDirectoryRecursively(outputDirectory);
      const identity = normalizeItemKey(item?.key, null) || normalizePositiveInteger(item?.id, 0) || "preview";
      const outputPath = PathUtils.join(outputDirectory, `saved-images-${identity}.html`);
      await Zotero.File.putContentsAsync(outputPath, upgradedHTML);
      return outputPath;
    } catch (error) {
      safeLogError(error);
      return sourcePath;
    }
  }

  function upgradePreviewIndexInteractivityHTML(html) {
    let text = String(html || "");
    if (
      !text
      || text.includes(`data-pdf-image-saver-interactivity="${INDEX_INTERACTIVITY_VERSION}"`)
      || !text.includes("pdf-image-saver-filter-status")
      || !text.includes("reader_preview_index")
    ) {
      return text;
    }
    const script = getCurrentIndexInteractivityScriptHTML();
    if (!script) {
      return text;
    }
    const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script>\s*(?=<\/body>)/i;
    text = scriptPattern.test(text)
      ? text.replace(scriptPattern, `${script}\n`)
      : text.replace(/<\/body>/i, `${script}\n</body>`);
    if (!text.includes('id="pdf-image-saver-action-status"')) {
      text = text.replace(
        /(<span\s+class="filter-status"[^>]*>[\s\S]*?<\/span>)/i,
        '$1<span class="index-action-status" id="pdf-image-saver-action-status" role="status" aria-live="polite"></span>',
      );
    }
    const clearButtonPattern = /\s*<button\b[^>]*id="pdf-image-saver-clear-filters"[^>]*>[\s\S]*?<\/button>/i;
    const hasFilterButtons = /<button\b[^>]*class="[^"]*\bfilter-chip\b[^"]*"/i.test(text);
    if (!hasFilterButtons) {
      text = text.replace(clearButtonPattern, "");
    } else {
      text = text.replace(clearButtonPattern, (buttonHTML) => {
        const normalized = buttonHTML
          .replace(/\s+title="[^"]*"/gi, "")
          .replace(/\s+aria-label="[^"]*"/gi, "")
          .trimStart();
        return ` ${normalized.replace(/<button\b([^>]*)>/i, '<button$1 title="当前没有筛选条件" aria-label="当前没有筛选条件">')}`;
      });
    }
    if (!text.includes(".index-action-status")) {
      text = text.replace(
        /<\/style>/i,
        '    .index-action-status { display: inline-block; min-width: 52px; color: #16A34A; font-weight: 600; }\n    .index-action-status.is-error { color: #DC2626; }\n  </style>',
      );
    }
    return text;
  }

  function getCurrentIndexInteractivityScriptHTML() {
    if (indexInteractivityScriptCache) {
      return indexInteractivityScriptCache;
    }
    const templateHTML = buildIndexHTML({
      attachment: {
        key: "TMPL0001",
        libraryID: 1,
        attachmentContentType: "application/pdf",
        getField() { return ""; },
      },
      parentItem: null,
      entries: [{
        id: "interaction-template",
        mode: "reader_canvas_preview",
        detector: "manual_selection",
        pageIndex: 0,
        pageNumber: 1,
        quality: "low",
        dataURL: "data:image/jpeg;base64,AAAA",
        renderedWidth: 1,
        renderedHeight: 1,
        bboxNormalized: [0, 0, 1, 1],
        detectionArea: 1,
      }],
      scope: "clip",
      qualityKey: "low",
    });
    const scriptPattern = new RegExp(`<script\\s+data-pdf-image-saver-interactivity="${INDEX_INTERACTIVITY_VERSION}">[\\s\\S]*?<\\/script>`, "i");
    indexInteractivityScriptCache = templateHTML.match(scriptPattern)?.[0] || "";
    return indexInteractivityScriptCache;
  }

  async function showDiagnostics(win) {
    const reader = getActiveReader(win);
    const report = reader
      ? await buildRuntimeDiagnostics(reader)
      : await buildRuntimeDiagnostics(null);
    Services.prompt.alert(win, "PDF 图片插件诊断", formatDiagnosticsReport(report));
  }

  async function showReaderDiagnostics(reader) {
    const report = await buildRuntimeDiagnostics(reader);
    const win = Zotero.getMainWindow?.();
    Services.prompt.alert(win, "PDF 图片插件诊断", formatDiagnosticsReport(report));
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
      helper_min_area: clamp(getNumberPref("minImageArea", DEFAULT_MIN_AREA), 0.0001, 0.5),
      helper_page_max: getHelperMaxImages("page"),
      helper_doc_max: getHelperMaxImages("document"),
      helper_timeout_s: getHelperTimeoutSeconds(),
      helper_python_mode: getStringPref("pythonPath", "").trim() ? "custom" : "auto",
      duplicate_guard: getBoolPref("duplicateGuard", true),
      shared_library: "PPT SQLite; fixed",
      shared_database_path: resolveDefaultSharedDatabasePath(),
      shared_locator_path: resolveSharedLocatorPath(),
      shared_database_schema_version: SHARED_DB_SCHEMA_VERSION,
      shared_locator_schema_version: SHARED_LIBRARY_LOCATOR_SCHEMA_VERSION,
      shared_database_exists: null,
      shared_locator_exists: null,
      bridge_status: isBridgeEndpointRegistered() ? "ready" : "n/a",
      warnings: [],
    };

    if (typeof IOUtils?.exists === "function") {
      try {
        [report.shared_database_exists, report.shared_locator_exists] = await Promise.all([
          IOUtils.exists(report.shared_database_path),
          IOUtils.exists(report.shared_locator_path),
        ]);
      } catch (error) {
        report.warnings.push(`外部图片库：${translateUserFacingErrorDetail(getErrorMessage(error))}`);
      }
    }

    try {
      const tempStats = await getTempDirectoryStats(report.temp_dir);
      report.temp_leftovers = tempStats.count;
      report.temp_bytes = tempStats.bytes;
    } catch (error) {
      report.warnings.push(`临时文件：${translateUserFacingErrorDetail(getErrorMessage(error))}`);
    }

    await probeOptionalHelperAvailability(report);

    if (!reader || !isPDFReader(reader)) {
      report.warnings.push("未打开 PDF 阅读器。");
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
      report.page_label = getPageLabel(context, pageIndex);
    } catch (error) {
      report.warnings.push(`当前文献：${translateUserFacingErrorDetail(getErrorMessage(error))}`);
    }

    return report;
  }

  async function probeOptionalHelperAvailability(report, discoverCommands = getPythonCommands) {
    const target = report && typeof report === "object" && !Array.isArray(report) ? report : {};
    if (!Array.isArray(target.warnings)) {
      target.warnings = [];
    }
    try {
      const pythonCommands = await discoverCommands();
      target.optional_helper = Array.isArray(pythonCommands) && pythonCommands.length
        ? "python-available"
        : "python-missing";
    } catch (error) {
      target.optional_helper = "unknown";
      target.warnings.push(`高级原图：${translateUserFacingErrorDetail(getErrorMessage(error))}`);
    }
    return target.optional_helper;
  }

  function formatDiagnosticsReport(report) {
    const safeReport = normalizeOptionsObject(report);
    const pdfAttachment = normalizeOptionsObject(safeReport.pdf_attachment);
    const pageNumber = normalizePageNumber(safeReport.page_number, 1);
    const pageLabel = normalizeDiagnosticText(safeReport.page_label, null, 80);
    const warnings = normalizeDiagnosticWarningMessages(safeReport.warnings);
    const lines = [
      "【运行与存储】",
      `插件：${normalizeDiagnosticText(safeReport.plugin, "未知", 120)}；Zotero ${normalizeDiagnosticText(safeReport.zotero, "未知", 80)}`,
      `运行：${formatDiagnosticBoolean(safeReport.started)}；阅读器 ${normalizeNonNegativeInteger(safeReport.reader_count, 0)}；当前 PDF：${formatDiagnosticBoolean(safeReport.active_pdf_reader)}`,
      "存储：唯一外部 SQLite 原图库；不创建 HTML 预览附件或缩略图",
      `PPT 图片库：${formatDiagnosticSharedLibrary(safeReport.shared_library)}；桥接：${formatDiagnosticBridgeStatus(safeReport.bridge_status)}`,
      `数据库：${formatDiagnosticSharedPath(safeReport.shared_database_path, "paper_images.sqlite")}；文件状态：${formatDiagnosticFileState(safeReport.shared_database_exists)}`,
      `发现文件：${formatDiagnosticSharedPath(safeReport.shared_locator_path, "library.json")}；文件状态：${formatDiagnosticFileState(safeReport.shared_locator_exists)}`,
      `协议版本：外部数据库 schema ${formatDiagnosticSchemaVersion(safeReport.shared_database_schema_version)}；发现文件 schema ${formatDiagnosticSchemaVersion(safeReport.shared_locator_schema_version)}`,
      `临时文件：${normalizeNonNegativeInteger(safeReport.temp_leftovers, 0)} 项（${formatBytes(safeReport.temp_bytes)}）；${normalizeDiagnosticText(safeReport.temp_dir, "未知", 160)}`,
      "",
      "【采集设置】",
      `默认清晰度：${getQualityLabelWithEstimate(safeReport.default_quality)}`,
      `确认窗口初始类别：${formatDiagnosticInitialCategory(safeReport.default_image_category)}`,
      `重复保护：${formatDiagnosticDups(safeReport.duplicate_guard)}`,
      "",
      "【高级原图提取（可选）】",
      `高级原图：可选；${formatOptionalHelperStatus(safeReport.optional_helper)}；Python 路径：${formatHelperPythonMode(safeReport.helper_python_mode)}`,
      `高级原图限制：最小面积 ${formatDiagnosticArea(safeReport.helper_min_area)}；本页最多 ${normalizeNonNegativeInteger(safeReport.helper_page_max, 0)} 张；全文最多 ${normalizeNonNegativeInteger(safeReport.helper_doc_max, 0)} 张；超时 ${normalizeNonNegativeInteger(safeReport.helper_timeout_s, 0)} 秒`,
    ];
    if (safeReport.pdf_attachment) {
      lines.push("", "【当前文献】");
      lines.push(
        `当前 PDF：${normalizeItemKey(pdfAttachment.key, "未知")}；${formatDiagnosticLibraryPrefix(safeReport.library_prefix)}；上级条目 ${normalizeDiagnosticText(pdfAttachment.parent_id, "无", 80)}`,
        `页面：${formatPageWithLabel(pageNumber, pageLabel)}`,
        `定位原文：${normalizeDiagnosticText(safeReport.open_pdf_uri, "不可用", 240)}`,
      );
    }
    if (warnings.length) {
      lines.push("", "【提示】", ...warnings.map((warning) => `- ${warning}`));
    }
    return lines.join("\n");
  }

  function normalizeDiagnosticText(value, fallback = "未知", maxLength = 220) {
    return normalizeMetadataText(value, fallback, maxLength);
  }

  function normalizeDiagnosticWarningMessages(warnings) {
    const values = Array.isArray(warnings) ? warnings : [];
    const normalized = [];
    for (const warning of values) {
      const text = formatDiagnosticWarning(warning);
      if (text) {
        normalized.push(text);
      }
      if (normalized.length >= 6) {
        break;
      }
    }
    return normalized;
  }

  // Single source for "第 N 页（文献页码 X）". The document page label is only shown when it
  // actually differs from the physical page, so front matter reads correctly and body pages
  // do not repeat themselves.
  function formatPageWithLabel(pageNumber, pageLabel) {
    const label = normalizeMetadataText(pageLabel, "", 80);
    return label && label !== String(pageNumber)
      ? `第 ${pageNumber} 页（文献页码 ${label}）`
      : `第 ${pageNumber} 页`;
  }

  function formatDiagnosticBoolean(value) {
    return value === true ? "是" : value === false ? "否" : "未知";
  }

  function formatDiagnosticDups(value) {
    if (value === true) {
      return "开启（本次会话与已保存图片）";
    }
    if (value === false) {
      return "关闭";
    }
    return "未知";
  }

  function formatDiagnosticInitialCategory(value) {
    const key = normalizeImageCategoryKey(value);
    return key === "auto"
      ? "自动判断（先图注，后正文引用）"
      : `${getChineseImageCategoryLabel(key)}（直接预填）`;
  }

  function formatDiagnosticArea(value, fallback = "未知") {
    const number = toFiniteNumber(value);
    if (number === null) {
      return fallback;
    }
    const ratio = Number(clamp(number, 0.0001, 0.5).toFixed(3));
    const percent = Number((ratio * 100).toFixed(1));
    return `${ratio}（页面约 ${percent}%）`;
  }

  function formatOptionalHelperStatus(value) {
    const key = normalizeDiagnosticText(value, "unknown", 40);
    if (key === "python-available") {
      return "Python 可用";
    }
    if (key === "python-missing") {
      return "未找到 Python";
    }
    return "未知";
  }

  function formatHelperPythonMode(value) {
    const key = normalizeDiagnosticText(value, "auto", 24).toLowerCase();
    if (key === "custom" || key === "custom py") {
      return "自定义路径";
    }
    if (key === "auto" || key === "auto py") {
      return "自动查找";
    }
    return "自动查找";
  }

  function formatDiagnosticSharedLibrary(value) {
    const text = normalizeDiagnosticText(value, "未知", 120);
    if (text === "PPT SQLite; fixed" || text === "fixed") {
      return "固定外部 SQLite";
    }
    return text;
  }

  function formatDiagnosticSharedPath(value, filename) {
    const text = normalizeDiagnosticText(value, "未知", 260);
    if (/zotero\.sqlite(?:-|$)/i.test(text)) {
      return "路径无效（禁止访问 Zotero 内部数据库）";
    }
    const expectedName = String(filename || "").toLowerCase();
    return expectedName && text.toLowerCase().endsWith(expectedName) ? text : "路径未知";
  }

  function formatDiagnosticFileState(value) {
    if (value === true) {
      return "已存在";
    }
    if (value === false) {
      return "不存在";
    }
    return "状态未知";
  }

  function formatDiagnosticSchemaVersion(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? String(number) : "未知";
  }

  function formatDiagnosticBridgeStatus(value) {
    const key = normalizeDiagnosticText(value, "未知", 40).toLowerCase();
    if (key === "ready") {
      return "已就绪";
    }
    if (key === "n/a" || key === "disabled") {
      return "未启用";
    }
    if (key === "shutdown" || key === "stopped") return "已停止";
    if (key === "unregistered") return "未注册";
    if (key === "invalid-shared-db-path") return "数据库路径无效";
    return "未知";
  }

  function formatDiagnosticLibraryPrefix(value) {
    const text = normalizeDiagnosticText(value, "library", 80);
    if (text === "library") return "个人文库";
    const groupID = text.match(/^groups\/(\d+)$/)?.[1];
    return groupID ? `群组文库 ${groupID}` : "文库未知";
  }

  function formatDiagnosticWarning(value) {
    const text = normalizeDiagnosticText(value, null, 220);
    if (!text) {
      return null;
    }
    if (text === "No PDF.") {
      return "未打开 PDF 阅读器。";
    }
    if (text.startsWith("Temp:")) {
      const detail = text.replace(/^Temp:\s*/i, "");
      return /[\u3400-\u9fff]/.test(detail)
        ? `临时文件：${detail}`
        : "临时文件异常，详细原因请查看错误控制台。";
    }
    if (text.startsWith("Helper:")) {
      const detail = translateUserFacingErrorDetail(text);
      return detail === "详细原因请查看错误控制台。"
        ? "高级原图异常，详细原因请查看错误控制台。"
        : `高级原图：${detail}`;
    }
    const detail = translateUserFacingErrorDetail(text);
    return /[\u3400-\u9fff]/.test(detail) ? detail : "详细原因请查看错误控制台。";
  }

  async function startClipFromReader(reader, qualityKey, explicitPageIndex, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const onSessionEnd = typeof safeOptions.onSessionEnd === "function" ? safeOptions.onSessionEnd : null;
    const onSelectionAccepted = typeof safeOptions.onSelectionAccepted === "function" ? safeOptions.onSelectionAccepted : null;
    const onReviewResolved = typeof safeOptions.onReviewResolved === "function" ? safeOptions.onReviewResolved : null;
    try {
      const pageIndex = await getCurrentPageIndex(reader, explicitPageIndex);
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: canvas missing.");
      }
      showReaderToast(reader, `已进入框选：在${formatPageToastToken(pageIndex)}按住鼠标左键拖动，松开后预览并确认；按 Esc 或右键取消。清晰度：${getQualityLabelWithEstimate(qualityKey)}。`, "info");
      installSelectionOverlay(reader, context.doc, pageElement, canvas, qualityKey, pageIndex, {
        imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
        onSelectionAccepted,
        onReviewResolved,
        onSessionEnd,
      });
    } catch (error) {
      logError(error);
      showReaderToast(reader, formatUserFacingError(error), "error");
      onSessionEnd?.();
    }
  }

  function installSelectionOverlay(reader, doc, pageElement, canvas, qualityKey, pageIndex, options = {}) {
    if (shuttingDown) {
      return null;
    }
    const safeOptions = normalizeOptionsObject(options);
    const onSessionEnd = typeof safeOptions.onSessionEnd === "function" ? safeOptions.onSessionEnd : null;
    const onSelectionAccepted = typeof safeOptions.onSelectionAccepted === "function" ? safeOptions.onSelectionAccepted : null;
    const onReviewResolved = typeof safeOptions.onReviewResolved === "function" ? safeOptions.onReviewResolved : null;
    const imageCategory = normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey());
    // Clip can be started from a context menu before the toolbar/style event has run.
    // Keep the selection layer self-sufficient in that path.
    ensureReaderStyles(doc);
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
    const dragHint = `框选模式：在${pageToken}按住鼠标左键拖动；松开后预览并确认；按 Esc 或右键取消`;
    overlay.setAttribute?.("aria-label", `框选${pageToken}图片。${dragHint}。清晰度：${qualityToken}。`);
    overlay.title = dragHint;
    overlay.__pdfImageSaverOnSessionEnd = onSessionEnd;
    prepareSelectionOverlayHost(pageElement, overlay);
    overlay.__pdfImageSaverRestoreReaderInteraction = suspendReaderTextSelectionForClip(reader, doc, pageElement);
    const hint = doc.createElement("div");
    hint.className = "pdf-image-saver-selection-hint";
    hint.textContent = dragHint;
    const selection = doc.createElement("div");
    selection.className = "pdf-image-saver-selection-box";
    selection.__pdfImageSaverQualityMark = getQualityMark(qualityKey);
    Object.assign(selection.style, {
      position: "absolute",
      zIndex: "2",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      border: "2px dashed #16A34A",
      background: "transparent",
      boxSizing: "border-box",
      pointerEvents: "none",
      display: "block",
      visibility: "visible",
    });
    const dimPanels = {};
    for (const side of ["top", "bottom", "left", "right"]) {
      const panel = doc.createElement("div");
      panel.className = `pdf-image-saver-selection-dim pdf-image-saver-selection-dim-${side}`;
      Object.assign(panel.style, {
        position: "absolute",
        zIndex: "1",
        boxSizing: "border-box",
        background: "rgba(0, 0, 0, 0.56)",
        pointerEvents: "none",
      });
      dimPanels[side] = panel;
    }
    selection.__pdfImageSaverDimPanels = dimPanels;
    resetSelectionDimming(selection);
    const sizeBadge = doc.createElement("div");
    sizeBadge.className = "pdf-image-saver-selection-size";
    sizeBadge.textContent = "";
    selection.append(sizeBadge);
    overlay.append(hint, dimPanels.top, dimPanels.bottom, dimPanels.left, dimPanels.right, selection);
    // Mount on the page itself. PDF.js keeps each page in its own transformed
    // stacking context, so a body-level fixed overlay can end up visually below
    // the rendered canvas in Zotero 9. A page child reliably owns the cursor and
    // pointer stream after zoom, rotation, and fullscreen changes.
    const overlayMount = pageElement && typeof pageElement.appendChild === "function"
      ? pageElement
      : doc.body;
    const mountedOnPage = overlayMount === pageElement;
    overlay.__pdfImageSaverMountedOnPage = mountedOnPage;
    if (overlay.style) {
      Object.assign(overlay.style, mountedOnPage
        ? {
            position: "absolute",
            inset: "0",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
          }
        : {
            position: "fixed",
            left: "0",
            top: "0",
            width: "0",
            height: "0",
          });
      Object.assign(overlay.style, {
        zIndex: "2147483646",
        display: "block",
        boxSizing: "border-box",
        cursor: "crosshair",
        pointerEvents: "auto",
        touchAction: "none",
        userSelect: "none",
        background: "transparent",
        outline: "none",
        overflow: "hidden",
      });
    }
    const ensureOverlayMounted = () => {
      if (overlay.isConnected || overlay.parentNode === overlayMount || overlay.parentElement === overlayMount) {
        return;
      }
      overlayMount.appendChild(overlay);
    };
    ensureOverlayMounted();

    let start = null;
    let current = null;
    let activeInput = null;
    let activePointerID = null;
    let sessionEnded = false;
    let sessionEndNotified = false;
    const removeListeners = [];
    const addDocumentListener = (type, handler, capture = true) => {
      if (typeof doc.addEventListener !== "function") {
        return;
      }
      doc.addEventListener(type, handler, capture);
      removeListeners.push(() => doc.removeEventListener?.(type, handler, capture));
    };
    const addWindowListener = (type, handler, capture = true) => {
      const win = doc.defaultView;
      if (typeof win?.addEventListener !== "function") {
        return;
      }
      win.addEventListener(type, handler, capture);
      removeListeners.push(() => win.removeEventListener?.(type, handler, capture));
    };
    const addOverlayListener = (type, handler) => {
      if (typeof overlay.addEventListener !== "function") {
        return;
      }
      overlay.addEventListener(type, handler, false);
      removeListeners.push(() => overlay.removeEventListener?.(type, handler, false));
    };
    const syncOverlayBounds = () => {
      if (mountedOnPage) {
        return;
      }
      const rect = pageElement?.getBoundingClientRect?.();
      if (!rect?.width || !rect?.height) {
        return;
      }
      Object.assign(overlay.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    };
    syncOverlayBounds();
    if (doc.defaultView?.addEventListener) {
      doc.defaultView.addEventListener("resize", syncOverlayBounds, true);
      removeListeners.push(() => doc.defaultView?.removeEventListener?.("resize", syncOverlayBounds, true));
    }
    addDocumentListener("scroll", syncOverlayBounds, true);
    overlay.__pdfImageSaverCleanupListeners = () => {
      while (removeListeners.length) {
        try {
          removeListeners.pop()();
        } catch (_error) {
          // Event cleanup must not leave the overlay mounted.
        }
      }
      overlay.__pdfImageSaverCleanupListeners = null;
    };

    const notifySessionEnd = () => {
      if (sessionEndNotified) {
        return;
      }
      sessionEndNotified = true;
      try {
        onSessionEnd?.();
      } catch (error) {
        safeLogError(error);
      }
    };
    overlay.__pdfImageSaverOnSessionEnd = notifySessionEnd;
    const endSession = (notify = true) => {
      if (sessionEnded) {
        return;
      }
      sessionEnded = true;
      overlay.__pdfImageSaverOnSessionEnd = null;
      cleanupSelectionOverlay(overlay);
      if (notify) {
        notifySessionEnd();
      }
    };

    const getPagePoint = (event) => {
      const rect = pageElement?.getBoundingClientRect?.();
      const clientX = Number(event?.clientX);
      const clientY = Number(event?.clientY);
      if (!rect?.width || !rect?.height || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        return null;
      }
      const right = Number.isFinite(Number(rect.right)) ? Number(rect.right) : Number(rect.left) + Number(rect.width);
      const bottom = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : Number(rect.top) + Number(rect.height);
      if (clientX < rect.left || clientX > right || clientY < rect.top || clientY > bottom) {
        return null;
      }
      return {
        clientX,
        clientY,
        x: clamp(clientX - rect.left, 0, rect.width),
        y: clamp(clientY - rect.top, 0, rect.height),
      };
    };

    const isActiveInput = (event, input) => {
      if (!start || activeInput !== input) {
        return false;
      }
      return input !== "pointer" || event?.pointerId === activePointerID;
    };

    const beginSelection = (event, input) => {
      if (sessionEnded || event?.button !== 0) {
        return;
      }
      if (activeInput !== null) {
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
      }
      const point = getPagePoint(event);
      if (!point) {
        return;
      }
      ensureOverlayMounted();
      event.preventDefault?.();
      event.stopPropagation?.();
      activeInput = input;
      activePointerID = input === "pointer" ? event.pointerId : null;
      hint.hidden = true;
      start = point;
      current = point;
      renderSelection(selection, start, current);
      if (input === "pointer" && event.pointerId !== undefined) {
        try {
          overlay.setPointerCapture?.(event.pointerId);
        } catch (_error) {
          // Document-level pointer listeners keep the drag live when Gecko
          // rejects pointer capture across the privileged reader boundary.
        }
      }
    };

    const resetSelectionForRetry = (message = dragHint) => {
      activeInput = null;
      activePointerID = null;
      start = null;
      current = null;
      selection.removeAttribute?.("style");
      Object.assign(selection.style, {
        position: "absolute",
        zIndex: "2",
        left: "0",
        top: "0",
        width: "0",
        height: "0",
        border: "2px dashed #16A34A",
        background: "transparent",
        boxSizing: "border-box",
        pointerEvents: "none",
        display: "block",
        visibility: "visible",
      });
      resetSelectionDimming(selection);
      const badge = selection.querySelector?.(".pdf-image-saver-selection-size");
      if (badge) {
        badge.textContent = "";
        badge.className = "pdf-image-saver-selection-size";
        badge.hidden = true;
      }
      hint.textContent = message;
      hint.hidden = false;
      overlay.title = message;
      overlay.setAttribute?.("aria-label", `框选${pageToken}图片。${message}。清晰度：${qualityToken}。`);
    };

    const moveSelection = (event, input) => {
      if (!isActiveInput(event, input)) {
        if (!sessionEnded && activeInput !== null) {
          event.preventDefault?.();
          event.stopPropagation?.();
        }
        return;
      }
      const point = getPagePoint(event);
      if (!point) {
        return;
      }
      ensureOverlayMounted();
      event.preventDefault?.();
      event.stopPropagation?.();
      current = point;
      renderSelection(selection, start, current);
    };

    const finishSelection = (event, input) => {
      if (!isActiveInput(event, input)) {
        if (!sessionEnded && activeInput !== null) {
          event.preventDefault?.();
          event.stopPropagation?.();
        }
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      if (input === "pointer" && event.pointerId !== undefined) {
        try {
          overlay.releasePointerCapture?.(event.pointerId);
        } catch (_error) {
          // A rejected capture has nothing to release; finish normally.
        }
      }
      const end = getPagePoint(event) || current || start;
      const rect = normalizedRect(start, end);
      if (rect.width < 12 || rect.height < 12) {
        const retryHint = `范围过小：请在${pageToken}重新拖动至少 12 × 12 像素；按 Esc 或右键取消`;
        resetSelectionForRetry(retryHint);
        showReaderToast(reader, `框选范围过小（${pageToken}），框选模式仍保持，请重新拖动至少 12 × 12 像素。`, "warning");
        return;
      }
      endSession(false);
      try {
        onSelectionAccepted?.();
      } catch (error) {
        safeLogError(error);
      }
      const completion = Promise.resolve()
        .then(() => saveClipPreviewIndex(reader, {
          canvas,
          pageElement,
          pageIndex,
          qualityKey,
          selectionRect: rect,
          imageCategory,
          onReviewResolved,
        }))
        .catch((error) => {
          safeLogError(error);
          showReaderToast(reader, formatUserFacingError(error), "error");
          return null;
        })
        .finally(notifySessionEnd);
      overlay.__pdfImageSaverCompletion = completion;
      void completion;
    };

    const abandonSelection = (event, input) => {
      if (activeInput !== null && activeInput !== input) {
        return;
      }
      if (input === "pointer" && activePointerID !== null && event?.pointerId !== activePointerID) {
        return;
      }
      resetSelectionForRetry();
    };

    const cancelSession = (event) => {
      if (sessionEnded) {
        return;
      }
      const point = getPagePoint(event);
      if (!point && Number.isFinite(Number(event?.clientX))) {
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      endSession();
      showReaderToast(reader, `已取消框选（${formatPageToastToken(pageIndex)}）。`, "warning");
    };

    const bindSelectionInputListeners = (addListener) => {
      addListener("pointerdown", (event) => beginSelection(event, "pointer"));
      addListener("pointermove", (event) => moveSelection(event, "pointer"));
      addListener("pointerup", (event) => finishSelection(event, "pointer"));
      addListener("pointercancel", (event) => abandonSelection(event, "pointer"));
      addListener("mousedown", (event) => beginSelection(event, "mouse"));
      addListener("mousemove", (event) => moveSelection(event, "mouse"));
      addListener("mouseup", (event) => finishSelection(event, "mouse"));
    };
    const suppressTextSelectionEvent = (event) => {
      if (sessionEnded) {
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
      try {
        doc.defaultView?.getSelection?.().removeAllRanges?.();
      } catch (_error) {
        // The temporary CSS and reader-tool guard remain active if selection cleanup is unavailable.
      }
    };
    // Window capture runs before PDF.js document handlers, which can otherwise
    // consume the drag before the page overlay receives a move event.
    bindSelectionInputListeners(addWindowListener);
    // Keep both local paths for older reader frames without a usable window and
    // for direct document retargeting during canvas reconstruction.
    bindSelectionInputListeners(addOverlayListener);
    bindSelectionInputListeners(addDocumentListener);
    addWindowListener("selectstart", suppressTextSelectionEvent);
    addWindowListener("dragstart", suppressTextSelectionEvent);
    addOverlayListener("selectstart", suppressTextSelectionEvent);
    addOverlayListener("dragstart", suppressTextSelectionEvent);
    addDocumentListener("selectstart", suppressTextSelectionEvent);
    addDocumentListener("dragstart", suppressTextSelectionEvent);
    addWindowListener("contextmenu", cancelSession);
    addOverlayListener("contextmenu", cancelSession);
    const cancelWithEscape = (event) => {
      if (sessionEnded || event?.key !== "Escape") {
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      endSession();
      showReaderToast(reader, `已取消框选（${formatPageToastToken(pageIndex)}）。`, "warning");
    };
    addWindowListener("keydown", cancelWithEscape);
    addOverlayListener("keydown", cancelWithEscape);
    addDocumentListener("contextmenu", cancelSession);
    addDocumentListener("keydown", cancelWithEscape);
  }

  function prepareSelectionOverlayHost(pageElement, overlay) {
    const previousPosition = pageElement?.style?.position || "";
    const previousCursor = pageElement?.style?.cursor || "";
    overlay.__pdfImageSaverHost = pageElement;
    overlay.__pdfImageSaverPreviousPosition = previousPosition;
    overlay.__pdfImageSaverPreviousCursor = previousCursor;
    overlay.setAttribute?.("data-pdf-image-saver-previous-position", previousPosition);
    overlay.setAttribute?.("data-pdf-image-saver-previous-cursor", previousCursor);
    if (!previousPosition || previousPosition === "static") {
      pageElement.style.position = "relative";
    }
    if (pageElement?.style) {
      pageElement.style.cursor = "crosshair";
    }
  }

  function cleanupSelectionOverlay(overlay) {
    if (!overlay) {
      return;
    }
    overlay.__pdfImageSaverCleanupListeners?.();
    try {
      overlay.__pdfImageSaverRestoreReaderInteraction?.();
    } catch (_error) {
      // Overlay teardown must still restore the page and remove the layer.
    }
    overlay.__pdfImageSaverRestoreReaderInteraction = null;
    const host = overlay.__pdfImageSaverHost || overlay.parentElement;
    if (host?.style) {
      const previousPosition =
        overlay.__pdfImageSaverPreviousPosition ??
        overlay.getAttribute?.("data-pdf-image-saver-previous-position") ??
        "";
      host.style.position = previousPosition;
      const previousCursor =
        overlay.__pdfImageSaverPreviousCursor ??
        overlay.getAttribute?.("data-pdf-image-saver-previous-cursor") ??
        "";
      host.style.cursor = previousCursor;
    }
    overlay.remove?.();
  }

  function suspendReaderTextSelectionForClip(reader, doc, pageElement) {
    const activeClass = "pdf-image-saver-clip-active";
    let restored = false;
    let view = null;
    let previousActionResolver = null;
    let clipActionResolver = null;
    try {
      if (pageElement?.classList?.add) {
        pageElement.classList.add(activeClass);
      } else {
        pageElement?.setAttribute?.("data-pdf-image-saver-clip-active", "true");
      }
      doc?.defaultView?.getSelection?.().removeAllRanges?.();
      view = getReaderPDFViewForDocument(reader, doc);
      if (view && typeof view.getActionAtPosition === "function") {
        previousActionResolver = view.getActionAtPosition;
        clipActionResolver = () => ({ action: { type: "none" }, selectAnnotations: null });
        view.getActionAtPosition = clipActionResolver;
      }
    } catch (error) {
      logError(error);
    }
    return () => {
      if (restored) {
        return;
      }
      restored = true;
      try {
        if (pageElement?.classList?.remove) {
          pageElement.classList.remove(activeClass);
        } else {
          pageElement?.removeAttribute?.("data-pdf-image-saver-clip-active");
        }
        if (view && clipActionResolver && view.getActionAtPosition === clipActionResolver) {
          view.getActionAtPosition = previousActionResolver;
        }
      } catch (error) {
        logError(error);
      }
    };
  }

  function getReaderPDFViewForDocument(reader, doc) {
    const views = [
      reader?._lastView,
      reader?._primaryView,
      reader?._internalReader?._lastView,
      reader?._internalReader?._primaryView,
    ];
    for (const view of views) {
      const viewDocument = view?._iframeWindow?.document || view?._iframe?.contentWindow?.document;
      if (view && viewDocument === doc) {
        return view;
      }
    }
    return null;
  }

  function renderSelection(selection, start, current) {
    const rect = normalizedRect(start, current);
    Object.assign(selection.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    renderSelectionDimming(selection, rect);
    const sizeBadge = selection.querySelector?.(".pdf-image-saver-selection-size");
    if (sizeBadge) {
      const width = Math.max(0, Math.round(rect.width));
      const height = Math.max(0, Math.round(rect.height));
      const tooSmall = width < 12 || height < 12;
      const qualityMark = selection.__pdfImageSaverQualityMark || getQualityMark("medium");
      sizeBadge.textContent = tooSmall
        ? `${width} × ${height} 像素 · 尺寸过小（至少 12 像素） · ${qualityMark}清晰度`
        : `${width} × ${height} 像素 · ${qualityMark}清晰度`;
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
      const onReviewResolved = typeof safeOptions.onReviewResolved === "function" ? safeOptions.onReviewResolved : null;
      const pageIndex = normalizePageIndex(safeOptions.pageIndex, 0);
      const qualityKey = normalizeQualityKey(safeOptions.qualityKey);
      jobKey = getReaderJobKey(reader, {
        scope: "clip",
        pageIndex,
      });
      if (activeJobs.has(jobKey)) {
        showReaderToast(reader, `正在保存${formatPageToastToken(pageIndex)}的框选图片，请稍候。`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `正在生成${formatPageToastToken(pageIndex)}的框选图片；确认后才会保存。`, "progress");
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      let preview = renderCanvasPreview({
        ...safeOptions,
        pageIndex,
        qualityKey,
        imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
      });
      const confirmed = await confirmPreviewBeforeSave(reader, preview, safeOptions.pageElement, {
        scope: "clip",
        requestedCategory: safeOptions.imageCategory,
        onQualityChange(nextQuality) {
          return renderCanvasPreview({
            ...safeOptions,
            pageIndex,
            qualityKey: nextQuality,
            imageCategory: preview.imageCategory,
          });
        },
      });
      if (confirmed && typeof confirmed === "object") preview = confirmed;
      try {
        onReviewResolved?.(Boolean(confirmed));
      } catch (error) {
        safeLogError(error);
      }
      if (!confirmed) {
        showReaderToast(reader, "已取消保存图片。", "warning");
        return null;
      }
      const duplicateKey = getPreviewDuplicateKey(attachment, preview);
      const indexKey = getPreviewIndexKey(attachment, [preview], "clip", preview.quality);
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
      showReaderToast(reader, `正在保存${formatPageToastToken(pageIndex)}已确认的框选图片…`, "progress");
      await publishPreviewEntriesToSharedLibrary({ attachment, parentItem, entries: [preview] });
      showReaderToast(
        reader,
        `已保存${formatPageToastToken(pageIndex)}的框选图片：画质 ${getQualityLabelWithEstimate(preview.quality)}；类别 ${getChineseImageCategoryLabel(preview.imageCategory)}；${formatBytes(preview.byteCount)}。已写入外部 SQLite 图片库。`,
        "success",
      );
      rememberPreviewIndexSave(attachment, [preview], indexKey);
      return true;
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

  function formatPreviewDuplicateSkipReason(scope, reason, pageIndex = null) {
    const pageToken = pageIndex === null || pageIndex === undefined ? "" : ` ${formatPageToastToken(pageIndex)}`;
    const kind = reason === "session"
      ? "本次会话中已保存"
      : reason === "saved"
        ? "此前已保存"
        : "重复图片";
    if (scope === "page") {
      return `整页图片已跳过${pageToken}：${kind}。`;
    }
    return `框选保存已跳过${pageToken}：${kind}。`;
  }

  async function savePagePreviewIndex(reader, options = {}) {
    let jobKey = null;
    let jobAdded = false;
    try {
      const safeOptions = normalizeOptionsObject(options);
      const pageIndex = await getCurrentPageIndex(reader, safeOptions.pageIndex);
      const qualityKey = normalizeQualityKey(safeOptions.qualityKey);
      const onReviewStart = typeof safeOptions.onReviewStart === "function" ? safeOptions.onReviewStart : null;
      const onSaveStart = typeof safeOptions.onSaveStart === "function" ? safeOptions.onSaveStart : null;
      jobKey = getReaderJobKey(reader, { scope: "page", pageIndex });
      if (activeJobs.has(jobKey)) {
      showReaderToast(reader, `正在保存${formatPageToastToken(pageIndex)}整页图片，请稍候。`, "warning");
        return;
      }
      activeJobs.add(jobKey);
      jobAdded = true;
      showReaderToast(reader, `正在生成${formatPageToastToken(pageIndex)}整页图片；确认后才会保存。`, "progress");
      const context = await getPDFViewerContext(reader);
      const pageElement = await waitForPageElement(context, pageIndex + 1);
      const canvas = getPageCanvas(pageElement);
      if (!pageElement || !canvas) {
        throw new Error("Capture failed: canvas missing.");
      }
      const attachment = getReaderPDFAttachment(reader);
      const parentItem = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      const pageRect = pageElement.getBoundingClientRect();
      let preview = renderCanvasPreview({
        canvas,
        pageElement,
        pageIndex,
        qualityKey,
        pageLabel: getPageLabel(context, pageIndex),
        mode: "whole_page_reader_canvas_preview",
        detector: "whole_page_preview",
        selectionRect: {
          left: 0,
          top: 0,
          width: pageRect.width,
          height: pageRect.height,
        },
        imageCategory: normalizeImageCategoryKey(safeOptions.imageCategory || getDefaultImageCategoryKey()),
      });
      try {
        onReviewStart?.();
      } catch (error) {
        safeLogError(error);
      }
      let reviewUnavailable = false;
      const confirmed = await confirmPreviewBeforeSave(reader, preview, pageElement, {
        scope: "page",
        requestedCategory: safeOptions.imageCategory,
        onQualityChange(nextQuality) {
          return renderCanvasPreview({
            canvas,
            pageElement,
            pageIndex,
            qualityKey: nextQuality,
            selectionRect: {
              left: 0,
              top: 0,
              width: pageElement.getBoundingClientRect().width,
              height: pageElement.getBoundingClientRect().height,
            },
            pageLabel: safeOptions.pageLabel,
            mode: "whole_page_reader_canvas_preview",
            detector: "whole_page_preview",
            imageCategory: preview.imageCategory,
          });
        },
        onReviewUnavailable() {
          reviewUnavailable = true;
        },
      });
      if (confirmed && typeof confirmed === "object") preview = confirmed;
      if (reviewUnavailable) {
        return null;
      }
      if (!confirmed) {
        showReaderToast(reader, "已取消保存图片。", "warning");
        return;
      }
      const duplicateKey = getPreviewDuplicateKey(attachment, preview);
      const indexKey = getPreviewIndexKey(attachment, [preview], "page", preview.quality);
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
      try {
        onSaveStart?.();
      } catch (error) {
        safeLogError(error);
      }
      showReaderToast(reader, `正在保存${formatPageToastToken(pageIndex)}已确认的整页图片…`, "progress");
      await publishPreviewEntriesToSharedLibrary({ attachment, parentItem, entries: [preview] });
      rememberPreviewIndexSave(attachment, [preview], indexKey);
      showReaderToast(reader, `已保存${formatPageToastToken(pageIndex)}整页图片：画质 ${getQualityLabelWithEstimate(preview.quality)}；类别 ${getChineseImageCategoryLabel(preview.imageCategory)}；${formatBytes(preview.byteCount)}。已写入外部 SQLite 图片库。`, "success");
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
        throw new Error(`Byte cap: index large (${formatBytes(htmlBytes)} > ${formatBytes(maxBytes)}). Lower Q.`);
      }
      await Zotero.File.putContentsAsync(htmlPath, html);
      return htmlPath;
    } catch (error) {
      await removeDirectoryIfExists(outputDir);
      throw error;
    }
  }

  function safeLogError(error) {
    try {
      logError(error instanceof Error ? error : new Error(String(error == null ? "" : error)));
    } catch (_logError) {
      // Logging must never throw into the caller's save path.
    }
  }

  function getLocalAppDataDir() {
    try {
      if (typeof Services !== "undefined" && Services.env && typeof Services.env.get === "function") {
        const local = Services.env.get("LOCALAPPDATA");
        if (local) return local;
      }
    } catch (_envError) {
      // Fall through to platform-agnostic resolution below.
    }
    try {
      if (typeof process !== "undefined" && process.env && process.env.LOCALAPPDATA) {
        return process.env.LOCALAPPDATA;
      }
    } catch (_processError) {
      // Node-only fallback for tests; absent in Zotero runtime.
    }
    return PathUtils.tempDir;
  }

  function getParentPath(candidate) {
    try {
      if (typeof PathUtils.parent === "function") return PathUtils.parent(candidate);
    } catch (_parentError) {
      // Older PathUtils shims (test sandbox) lack parent(); derive manually.
    }
    if (typeof candidate !== "string" || !candidate) return "";
    const idx = Math.max(candidate.lastIndexOf("/"), candidate.lastIndexOf("\\"));
    return idx > 0 ? candidate.slice(0, idx) : "";
  }

  function pathsEqual(left, right) {
    return String(left || "").trim().replace(/\//g, "\\").toLowerCase()
      === String(right || "").trim().replace(/\//g, "\\").toLowerCase();
  }

  function resolveSharedLibraryDirectory() {
    return PathUtils.join(getLocalAppDataDir(), ...SHARED_DB_PATH_SEGMENTS);
  }

  function resolveSharedLocatorPath() {
    return PathUtils.join(resolveSharedLibraryDirectory(), SHARED_LIBRARY_LOCATOR_FILE_NAME);
  }

  function resolveDefaultSharedDatabasePath() {
    return PathUtils.join(resolveSharedLibraryDirectory(), SHARED_DB_FILE_NAME);
  }

  function isZoteroInternalDatabasePath(rawPath) {
    if (typeof rawPath !== "string" || !rawPath.trim()) return true;
    const fileName = rawPath.split(/[\\/]/).pop().trim().replace(/[. ]+$/, "");
    if (/^zotero\.sqlite$/i.test(fileName)) return true;
    if (/^zotero\.sqlite-(wal|shm)$/i.test(fileName)) return true;
    if (/^zotero\.sqlite:/i.test(fileName)) return true;
    return false;
  }

  function isSafeAbsoluteSharedDatabasePath(rawPath) {
    if (typeof rawPath !== "string") return false;
    const trimmed = rawPath.trim();
    if (!trimmed) return false;
    if (isZoteroInternalDatabasePath(trimmed)) return false;
    return pathsEqual(trimmed, resolveDefaultSharedDatabasePath());
  }

  function normalizeSharedDatabasePath(rawPath) {
    const trimmed = typeof rawPath === "string" ? rawPath.trim() : "";
    if (!isSafeAbsoluteSharedDatabasePath(trimmed)) {
      return { ok: false, reason: INVALID_SHARED_DB_PATH_TOKEN, path: "" };
    }
    return { ok: true, reason: null, path: resolveDefaultSharedDatabasePath() };
  }

  function buildSharedDatabaseLocatorRecord(databasePath) {
    const normalized = normalizeSharedDatabasePath(databasePath);
    if (!normalized.ok) {
      throw new Error(`invalid-shared-db-path: ${normalized.path || "<empty>"}`);
    }
    return {
      schemaVersion: SHARED_LIBRARY_LOCATOR_SCHEMA_VERSION,
      databaseSchemaVersion: SHARED_DB_SCHEMA_VERSION,
      producer: SHARED_LIBRARY_LOCATOR_PRODUCER,
      updatedAt: new Date().toISOString(),
      databasePath: normalized.path,
      locatorPath: resolveSharedLocatorPath(),
    };
  }

  async function ensureDirectoryRecursively(directory) {
    const normalized = normalizeMetadataText(directory, "", 1000);
    if (!normalized) {
      throw new Error("Storage failed: directory unavailable.");
    }
    if (typeof IOUtils !== "undefined" && typeof IOUtils.makeDirectory === "function") {
      await IOUtils.makeDirectory(normalized, {
        createAncestors: true,
        ignoreExisting: true,
      });
      return;
    }
    if (typeof Zotero !== "undefined" && typeof Zotero.File?.createDirectoryIfMissingAsync === "function") {
      await Zotero.File.createDirectoryIfMissingAsync(normalized);
      return;
    }
    throw new Error("Storage failed: directory runtime unavailable.");
  }

  async function ensureSharedLibraryDirectory(directory) {
    return ensureDirectoryRecursively(directory);
  }

  async function safeWriteSharedDatabaseLocator(databasePath) {
    try {
      const record = buildSharedDatabaseLocatorRecord(databasePath);
      const locatorPath = record.locatorPath;
      const directory = getParentPath(locatorPath);
      await ensureSharedLibraryDirectory(directory);
      const payload = JSON.stringify({
        schemaVersion: record.schemaVersion,
        databaseSchemaVersion: record.databaseSchemaVersion,
        producer: record.producer,
        updatedAt: record.updatedAt,
        databasePath: record.databasePath,
      });
      if (typeof Zotero !== "undefined" && Zotero.File && typeof Zotero.File.putContentsAsync === "function") {
        await Zotero.File.putContentsAsync(locatorPath, payload);
      } else if (typeof IOUtils !== "undefined" && typeof IOUtils.writeUTF8 === "function") {
        await IOUtils.writeUTF8(locatorPath, payload);
      }
      return true;
    } catch (error) {
      safeLogError(error);
      return false;
    }
  }

  async function safeRefreshSharedStateFromPreferences() {
    try {
      const databasePath = resolveDefaultSharedDatabasePath();
      await ensureSharedLibrarySchema();
      const wrote = await safeWriteSharedDatabaseLocator(databasePath);
      if (wrote) {
        await enableSharedLibraryBridge();
      }
      return { ok: wrote, reason: wrote ? null : "locator-write-failed", databasePath };
    } catch (error) {
      safeLogError(error);
      return { ok: false, reason: "refresh-failed", databasePath: "" };
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
        const pageText = formatPageWithLabel(entry.pageNumber, entry.pageLabel);
        const regionIdentity = getSourceRegionFingerprint(entry.sourceRegionKey);
        const sourceRegionLabel = entry.sourceRegion?.label || entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ");
        const pptToken = buildPptAssistToken(entry);
        return `
          <article class="entry" id="e${index + 1}" data-entry="${index + 1}" data-category="${escapeHTML(entry.imageCategory)}" data-color-family="${escapeHTML(entry.colorFamily || "unknown")}" data-layout="${escapeHTML(entry.layoutHint || "unknown")}" data-slot="${escapeHTML(entry.slideSlot || "unknown")}" data-role="${escapeHTML(entry.roleHint || "unknown")}" data-insert="${escapeHTML(entry.insertHint?.size || "unknown")}" data-caption="${escapeHTML(entry.captionHint?.tone || "unknown")}" data-hue="${escapeHTML(entry.colorFamily || "unknown")}" data-beat="${escapeHTML(entry.storyBeat || "unknown")}" data-style-tags="${escapeHTML(entry.styleTags.join(","))}">
            <div class="preview-column">
              <div class="entry-badge">第 ${index + 1} 张 · ${escapeHTML(getQualityMark(entry.quality))}清晰度 · ${escapeHTML(getSavedImageCategoryMark(entry.imageCategory))} · ${escapeHTML(getLayoutHintMark(entry.layoutHint))} · ${escapeHTML(getSlideSlotMark(entry.slideSlot))} · ${escapeHTML(getRoleHintMark(entry.roleHint))} · ${escapeHTML(getInsertSizeMark(entry.insertHint))}尺寸 · ${escapeHTML(getCaptionToneMark(entry.captionHint))}图注 · ${escapeHTML(getStoryBeatMark(entry.storyBeat))} · ${escapeHTML(getColorFamilyMark(entry.colorFamily))}</div>
              <a class="preview-link" href="${escapeHTML(uri)}" data-source-region-key="${escapeHTML(entry.sourceRegionKey)}" title="定位原文第 ${escapeHTML(String(entry.pageNumber))} 页；悬停可放大图片">
                <img src="${escapeHTML(entry.dataURL)}" alt="第 ${escapeHTML(String(entry.pageNumber))} 页图片预览 #${index + 1} ${escapeHTML(getSavedImageCategoryMark(entry.imageCategory))} ${escapeHTML(getLayoutHintMark(entry.layoutHint))} ${escapeHTML(getSlideSlotMark(entry.slideSlot))} ${escapeHTML(getRoleHintMark(entry.roleHint))} ${escapeHTML(getInsertSizeMark(entry.insertHint))} ${escapeHTML(getCaptionToneMark(entry.captionHint))} ${escapeHTML(getStoryBeatMark(entry.storyBeat))} ${escapeHTML(getColorFamilyMark(entry.colorFamily))}"><span class="zoom-hint" aria-hidden="true">悬停放大</span>
              </a>
              ${buildSourceRegionMapHTML(entry.sourceRegion, uri, entry.pageNumber)}
              ${buildPaletteChipsHTML(entry.palette)}
              ${buildContrastPairHTML(entry.dominantHex, entry.contrastHex)}
              ${buildInsertHintHTML(entry.insertHint)}
              ${buildCaptionHintHTML(entry.captionHint)}
              ${buildStoryHintHTML(entry)}
              ${buildTagChipsHTML(entry.styleTags)}
              <div class="entry-actions">
                <a class="source-action" href="${escapeHTML(uri)}" title="定位原文第 ${escapeHTML(String(entry.pageNumber))} 页">定位原文第 ${escapeHTML(String(entry.pageNumber))} 页</a>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(pptToken)}" title="复制 PPT 使用信息">复制 PPT 信息</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(formatPaletteLabel(entry.palette))}" title="复制颜色列表">复制颜色</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}" title="复制主色与对比色">复制颜色对</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildRolePackToken(entry))}" title="复制 PPT 绘图角色信息">复制角色信息</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildInsertPackToken(entry))}" title="复制 PPT 位置建议">复制位置建议</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildCaptionPackToken(entry))}" title="复制图注建议">复制图注建议</button>
                <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildStoryPackToken(entry))}" title="复制叙事顺序建议">复制叙事建议</button>
              </div>
            </div>
            <dl class="entry-summary">
              <div><dt>页码</dt><dd><a href="${escapeHTML(uri)}">${escapeHTML(pageText)}</a></dd></div>
              <div><dt>清晰度</dt><dd>${escapeHTML(getQualityLabelWithEstimate(entry.quality))}</dd></div>
              <div><dt>类别</dt><dd>${escapeHTML(getSavedImageCategoryLabel(entry.imageCategory))}</dd></div>
              <div><dt>布局</dt><dd>${escapeHTML(formatLayoutHintLabel(entry.layoutHint, entry.aspectRatio))}</dd></div>
              <div><dt>位置</dt><dd>${escapeHTML(formatSlideSlotLabel(entry.slideSlot))}</dd></div>
              <div><dt>用途</dt><dd>${escapeHTML(formatRoleHintLabel(entry.roleHint))}</dd></div>
              <div><dt>插入</dt><dd>${escapeHTML(formatInsertHintLabel(entry.insertHint))}</dd></div>
              <div><dt>图注</dt><dd>${escapeHTML(formatCaptionHintLabel(entry.captionHint))}</dd></div>
              <div><dt>叙事</dt><dd>${escapeHTML(formatStoryHintLabel(entry))}</dd></div>
              <div><dt>色调</dt><dd>${escapeHTML(formatColorFamilyLabel(entry.colorFamily))}</dd></div>
              <div><dt>颜色对</dt><dd>${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}</dd></div>
              <div><dt>采集方式</dt><dd>${escapeHTML(formatPreviewDetectorLabel(entry.detector))}</dd></div>
              <div><dt>标签</dt><dd>${escapeHTML(formatStyleTagsLabel(entry.styleTags))}</dd></div>
              <div><dt>大小</dt><dd>${formatBytes(entry.byteCount)}；${formatPreviewDimensions(entry.renderedWidth, entry.renderedHeight)}；比例 ${escapeHTML(formatAspectRatioLabel(entry.aspectRatio))}</dd></div>
              <div><dt>来源标识</dt><dd title="${escapeHTML(entry.sourceRegionKey)}">${escapeHTML(regionIdentity)}</dd></div>
            </dl>
            <details class="entry-details">
              <summary>来源与技术信息</summary>
              <dl>
                <div><dt>来源区域</dt><dd>${escapeHTML(sourceRegionLabel)}</dd></div>
                <div><dt>边界框</dt><dd>${entry.bboxNormalized.map((value) => value.toFixed(4)).join(", ")}</dd></div>
                <div><dt>来源键</dt><dd>${escapeHTML(entry.sourceRegionKey)}</dd></div>
                <div><dt>配色</dt><dd>${escapeHTML(formatPaletteLabel(entry.palette))}</dd></div>
                <div><dt>布局</dt><dd>${escapeHTML(formatLayoutHintLabel(entry.layoutHint, entry.aspectRatio))}</dd></div>
                <div><dt>版面位置</dt><dd>${escapeHTML(formatSlideSlotLabel(entry.slideSlot))}</dd></div>
                <div><dt>用途</dt><dd>${escapeHTML(formatRoleHintLabel(entry.roleHint))}</dd></div>
                <div><dt>插入建议</dt><dd>${escapeHTML(formatInsertHintLabel(entry.insertHint))}</dd></div>
                <div><dt>图注</dt><dd>${escapeHTML(formatCaptionHintLabel(entry.captionHint))}</dd></div>
                <div><dt>叙事</dt><dd>${escapeHTML(formatStoryHintLabel(entry))}</dd></div>
                <div><dt>颜色对</dt><dd>${escapeHTML(formatContrastPairLabel(entry.dominantHex, entry.contrastHex))}</dd></div>
                <div><dt>用途数据</dt><dd><code>${escapeHTML(buildRolePackToken(entry))}</code></dd></div>
                <div><dt>插入数据</dt><dd><code>${escapeHTML(buildInsertPackToken(entry))}</code></dd></div>
                <div><dt>图注数据</dt><dd><code>${escapeHTML(buildCaptionPackToken(entry))}</code></dd></div>
                <div><dt>叙事数据</dt><dd><code>${escapeHTML(buildStoryPackToken(entry))}</code></dd></div>
                <div><dt>PPT 数据</dt><dd><code>${escapeHTML(pptToken)}</code></dd></div>
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
    const metadataCopyJSON = JSON.stringify(metadata);
    const filterBarsHTML = [
      buildCategoryFilterBarHTML(normalizedEntries),
      buildHueFilterBarHTML(normalizedEntries),
      buildLayoutFilterBarHTML(normalizedEntries),
      buildSlideSlotFilterBarHTML(normalizedEntries),
      buildRoleFilterBarHTML(normalizedEntries),
      buildInsertFilterBarHTML(normalizedEntries),
      buildCaptionFilterBarHTML(normalizedEntries),
      buildStoryFilterBarHTML(normalizedEntries),
      buildTagFilterBarHTML(normalizedEntries),
    ].filter(Boolean).join("\n    ");
    const filterDisclosureHTML = filterBarsHTML
      ? `<details class="index-filters" id="pdf-image-saver-index-filters"><summary id="pdf-image-saver-filter-summary" title="展开类别、色调、布局等筛选条件">筛选图片</summary><div class="index-filter-groups">${filterBarsHTML}</div></details>`
      : "";
    const headerNavigationHTML = normalizedEntries.length > 1
      ? `<details class="index-jumps" id="pdf-image-saver-index-jumps"><summary title="展开首张、末张和逐图定位入口">快速跳转（${normalizedEntries.length} 张）</summary><div class="index-jump-list"><p class="meta jumps"><a class="source-action" href="${escapeHTML(normalizedEntries[0].openPDFURI)}" title="定位第一张图片的原文第 ${escapeHTML(String(normalizedEntries[0].pageNumber))} 页">定位第一张图片</a> <a class="source-action" href="${escapeHTML(normalizedEntries[normalizedEntries.length - 1].openPDFURI)}" title="定位最后一张图片的原文第 ${escapeHTML(String(normalizedEntries[normalizedEntries.length - 1].pageNumber))} 页">定位最后一张图片</a> ${normalizedEntries.map((entry, index) => `<a href="#e${index + 1}" title="跳转到第 ${index + 1} 张图片（原文第 ${escapeHTML(String(entry.pageNumber))} 页）">第 ${index + 1} 张 · 第 ${escapeHTML(String(entry.pageNumber))} 页</a>`).join(" ")}</p></div></details>`
      : "";
    const clearFiltersActionHTML = filterBarsHTML
      ? ' <button type="button" class="source-action" id="pdf-image-saver-clear-filters" title="当前没有筛选条件" aria-label="当前没有筛选条件" hidden disabled>清除筛选</button>'
      : "";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(sourceTitle)}｜图片索引｜${escapeHTML(formatPreviewScopeLabel(normalizedScope))}${previewQualityKey ? `｜${escapeHTML(getQualityMark(previewQualityKey))}清晰度` : ""}</title>
  <style>
    body { margin: 12px; font: 12.5px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { position: sticky; top: 0; z-index: 2; margin: 0 0 8px; padding: 8px 0 6px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid #e5e5e5; }
    h1 { font-size: 14px; margin: 0 0 3px; }
    .meta { color: #555; margin: 0 0 1px; line-height: 1.3; }
    .meta.actions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .meta.actions.footer-actions { margin-top: 10px; }
    .meta.jumps { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 6px; }
    .meta.jumps a { color: #2563EB; text-decoration: none; font-weight: 600; }
    .meta.jumps a:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    .entry { display: grid; grid-template-columns: minmax(120px, 260px) 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid #ddd; }
    .preview-column { display: grid; gap: 5px; align-content: start; position: relative; }
    .entry-badge { position: absolute; top: 4px; left: 4px; z-index: 1; padding: 1px 5px; border-radius: 3px; background: rgba(17, 24, 39, 0.82); color: #fff; font: 10.5px system-ui, sans-serif; pointer-events: none; }
    .palette-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .palette-chip { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); box-sizing: border-box; cursor: pointer; }
    .palette-chip:focus-visible { outline: 2px solid #2563EB; outline-offset: 1px; }
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
    .filter-label { min-width: 46px; align-self: center; color: #555; font-weight: 600; }
    .filter-chip { appearance: none; min-height: 28px; border: 1px solid #64748B; background: #F8FAFC; color: #2563EB; border-radius: 999px; padding: 3px 8px; font: 11.5px/1.25 system-ui, sans-serif; cursor: pointer; }
    .filter-chip[aria-pressed="true"] { background: #2563EB; border-color: #2563EB; color: #FFFFFF; }
    .index-filters { margin: 7px 0 2px; }
    .index-filters > summary { width: fit-content; cursor: pointer; color: #2563EB; font-weight: 600; }
    .index-filters > summary:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    .index-filter-groups { margin-top: 6px; padding-top: 3px; border-top: 1px solid #e5e7eb; }
    .index-jumps { margin-top: 5px; }
    .index-jumps > summary { width: fit-content; cursor: pointer; color: #2563EB; font-weight: 600; }
    .index-jumps > summary:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    .index-jump-list { margin-top: 6px; }
    .index-jump-list .meta.jumps { margin: 0; }
    .entry.is-hidden { display: none; }
    .entry-actions { display: flex; flex-wrap: wrap; gap: 4px; }
    .source-action { display: inline-flex; align-items: center; width: fit-content; min-height: 32px; padding: 6px 10px; border: 1px solid #64748B; border-radius: 6px; color: #2563EB; text-decoration: none; background: #F8FAFC; cursor: pointer; line-height: 1.25; }
    .source-action:disabled { opacity: 0.5; cursor: default; }
    .source-action[hidden] { display: none !important; }
    .filter-status { display: inline-block; min-width: 78px; color: #555; }
    .filter-status[hidden] { display: none !important; }
    .index-action-status { display: inline-block; min-width: 52px; color: #16A34A; font-weight: 600; }
    .index-action-status.is-error { color: #DC2626; }
    .source-action:focus-visible, .source-map-link:focus-visible, .preview-link:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    img { max-width: 100%; height: auto; border: 1px solid #ccc; background: #f6f6f6; }
    .preview-link { display: inline-block; position: relative; line-height: 0; }
    .preview-link img { transition: transform 120ms ease-out; }
    .preview-link:hover img, .preview-link:focus-within img { position: relative; z-index: 5; transform: scale(2.4); transform-origin: top left; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.45); border-color: #2563EB; cursor: zoom-in; }
    .preview-link .zoom-hint { position: absolute; bottom: 3px; right: 4px; z-index: 2; padding: 0 4px; border-radius: 3px; background: rgba(17, 24, 39, 0.78); color: #fff; font: 9.5px system-ui, sans-serif; pointer-events: none; opacity: 0.85; }
    .preview-link:hover .zoom-hint, .preview-link:focus-within .zoom-hint { opacity: 0; }
    .source-map-link { display: grid; gap: 5px; width: fit-content; text-decoration: none; color: inherit; }
    .source-map-caption { color: #64748B; font: 600 11px/1.25 system-ui, sans-serif; }
    .source-map { position: relative; width: 96px; aspect-ratio: 0.72; overflow: hidden; border: 1px solid #94A3B8; background: #F8FAFC; }
    .source-map-page-label { position: absolute; left: 6px; top: 5px; color: #64748B; font: 600 10px/1.2 system-ui, sans-serif; }
    .source-map-region { position: absolute; min-width: 3px; min-height: 3px; border: 2px dashed #16A34A; background: rgba(22, 163, 74, 0.16); box-sizing: border-box; }
    .source-map-legend { display: flex; align-items: center; gap: 5px; color: #475569; font: 11px/1.25 system-ui, sans-serif; }
    .source-map-legend i { display: inline-block; width: 14px; height: 9px; border: 2px dashed #16A34A; box-sizing: border-box; }
    dl { margin: 0; display: grid; gap: 3px; align-content: start; }
    dl div { display: grid; grid-template-columns: 40px 1fr; gap: 6px; }
    dt { color: #666; }
    dd { margin: 0; word-break: break-word; }
    .entry-details { grid-column: 2; }
    .entry-details summary { cursor: pointer; color: #444; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 8px; background: #f6f8fa; border: 1px solid #ddd; font-size: 11.5px; }
    @media (prefers-color-scheme: dark) {
      body { color: #F8FAFC; background: #0F172A; }
      header { background: #111827; border-bottom-color: #334155; }
      .meta, dt, .caption-note, .filter-label { color: #94A3B8; }
      .index-filters > summary { color: #60A5FA; }
      .index-filter-groups { border-top-color: #334155; }
      .index-jumps > summary { color: #60A5FA; }
      .index-action-status { color: #22C55E; }
      .index-action-status.is-error { color: #F85149; }
      .source-action, .filter-chip { border-color: #64748B; color: #60A5FA; background: #111827; }
      .filter-chip[aria-pressed="true"] { background: #2563EB; border-color: #2563EB; color: #FFFFFF; }
      .entry { border-top-color: #334155; }
      img { border-color: #334155; background: #1E293B; }
      .entry-badge, .preview-link .zoom-hint { background: rgba(0, 0, 0, 0.78); }
      .palette-chip, .contrast-swatch { border-color: rgba(255,255,255,0.36); }
      .insert-chip, .caption-chip, .story-chip, .tag-chip { border-color: #64748B; background: #111827; color: #CBD5E1; }
      .caption-title, .caption-hint, .story-hint, .insert-hint, .contrast-pair { color: #E2E8F0; }
      .source-map { border-color: #64748B; background: #111827; }
      .source-map-caption, .source-map-page-label { color: #94A3B8; }
      .source-map-legend { color: #CBD5E1; }
      .source-map-region { border-color: #22C55E; background: rgba(34, 197, 94, 0.18); }
      .source-map-legend i { border-color: #22C55E; }
      dd a, .meta.jumps a { color: #60A5FA; }
      pre { background: #111827; border-color: #334155; color: #F8FAFC; }
    }
    @media (max-width: 720px) { .entry { grid-template-columns: 1fr; } .entry-details { grid-column: 1; } }
  </style>
</head>
<body>
  <header id="top">
    <h1>${escapeHTML(sourceTitle)}</h1>
    <p class="meta">保存时间：${escapeHTML(createdAt)}。已写入 Zotero 和 PPT 图片库；采集方式：${escapeHTML(formatPreviewScopeLabel(normalizedScope))}。</p>
    <p class="meta">索引 ${escapeHTML(getPreviewIndexFingerprint(previewIndexKey) || "未知")}；共 ${normalizedEntries.length} 张图片；${escapeHTML(formatBytes(totalPreviewBytes))}；${escapeHTML(getQualityLabelWithEstimate(previewQualityKey))}；${escapeHTML(formatCategorySummary(normalizedEntries))}；${escapeHTML(formatColorFamilySummary(normalizedEntries))}；${escapeHTML(formatLayoutHintSummary(normalizedEntries))}；${escapeHTML(formatSlideSlotSummary(normalizedEntries))}；${escapeHTML(formatRoleHintSummary(normalizedEntries))}；${escapeHTML(formatInsertHintSummary(normalizedEntries))}；${escapeHTML(formatCaptionHintSummary(normalizedEntries))}；${escapeHTML(formatStoryHintSummary(normalizedEntries))}</p>
    <p class="meta">PPT 使用信息：${escapeHTML(formatPptAssistSummary(normalizedEntries))}</p>
    ${filterDisclosureHTML}
    ${normalizedEntries.length ? `<p class="meta actions">${normalizedEntries.length === 1 ? `<a class="source-action" href="${escapeHTML(normalizedEntries[0].openPDFURI)}" title="定位第一张图片的原文第 ${escapeHTML(String(normalizedEntries[0].pageNumber))} 页">定位第一张图片</a>` : ""} <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildIndexPptAssistToken(normalizedEntries))}" title="复制全部 PPT 使用信息">复制全部 PPT 信息</button> <button type="button" class="source-action copy-token" data-copy="${escapeHTML(buildIndexStoryboardToken(normalizedEntries))}" title="复制全部叙事顺序建议">复制全部叙事建议</button> <button type="button" class="source-action copy-token" data-copy="${escapeHTML(metadataCopyJSON)}" title="复制机器可读的图片元数据 JSON">复制 JSON</button>${clearFiltersActionHTML} <span class="filter-status" id="pdf-image-saver-filter-status" role="status" aria-live="polite" hidden>显示 ${normalizedEntries.length} 张，共 ${normalizedEntries.length} 张</span><span class="index-action-status" id="pdf-image-saver-action-status" role="status" aria-live="polite"></span></p>` : ""}
    ${headerNavigationHTML}
  </header>
  ${entriesHTML}
  ${normalizedEntries.length > 1 ? `<p class="meta actions footer-actions"><a class="source-action" href="#top" title="返回顶部">返回顶部</a></p>` : ""}
  <details>
    <summary>完整元数据</summary>
    <pre>${escapeHTML(JSON.stringify(metadata, null, 2))}</pre>
  </details>
  <script data-pdf-image-saver-interactivity="${INDEX_INTERACTIVITY_VERSION}">
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
      var readableLabels = {
        category: {
          auto: "未分类", metric_curve: "指标／训练曲线", heatmap: "热图／矩阵图", bar_chart: "柱状／条形图",
          distribution: "分布／降维图", qualitative: "定性结果对比", architecture: "网络／模型结构图",
          pipeline: "方法流程图", table: "科研表格", equation: "公式", schematic: "装置／原理示意",
          photo: "照片／医学影像", chart: "图表", diagram: "流程图／示意图", figure: "其他插图",
        },
        layout: { wide: "横向", tall: "纵向", square: "方形", unknown: "未判断" },
        slot: { hero: "主视觉", side: "侧栏", footer: "底部横幅", inset: "插图", unknown: "未判断" },
        role: { result: "结果展示", method: "方法或流程", evidence: "证据说明", compare: "对比展示", context: "背景或上下文", unknown: "通用图片" },
        insert: { large: "大尺寸", medium: "中尺寸", small: "小尺寸", unknown: "未判断" },
        caption: { result: "结果型", method: "方法型", compare: "对比型", context: "背景型", unknown: "未判断" },
        beat: { hook: "开场", setup: "背景", method: "方法", result: "结果", compare: "对比", close: "收束", unknown: "未判断" },
        hue: { red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", cyan: "青色", blue: "蓝色", purple: "紫色", pink: "粉色", brown: "棕色", gray: "灰色", black: "黑色", white: "白色", unknown: "未判断" },
        anchor: { left: "左侧", right: "右侧", center: "居中", top: "顶部", bottom: "底部", full: "铺满" },
      };
      function readableLabel(group, value) {
        var key = String(value || "unknown").toLowerCase();
        return readableLabels[group] && readableLabels[group][key] ? readableLabels[group][key] : "未判断";
      }
      function readSummaryValue(summary, label) {
        if (!summary) return "";
        var rows = summary.querySelectorAll("div");
        for (var i = 0; i < rows.length; i += 1) {
          var term = rows[i].querySelector("dt");
          var value = rows[i].querySelector("dd");
          if (term && value && term.textContent.trim() === label) return value.textContent.trim();
        }
        return "";
      }
      function humanizePageValue(value) {
        var text = String(value || "").trim();
        var legacy = text.match(/^(\d+)\s*\(([^()]+)\)$/);
        if (legacy) return "第 " + legacy[1] + " 页（文献页码 " + legacy[2].trim() + "）";
        if (/^\d+$/.test(text)) return "第 " + text + " 页";
        return text;
      }
      function appendReadableFact(list, label, value, href) {
        if (!list || !value) return;
        var row = document.createElement("div");
        var term = document.createElement("dt");
        var detail = document.createElement("dd");
        term.textContent = label;
        if (href) {
          var link = document.createElement("a");
          link.href = href;
          link.textContent = value;
          detail.appendChild(link);
        } else {
          detail.textContent = value;
        }
        row.append(term, detail);
        list.appendChild(row);
      }
      function moveAssistItem(container, node, label) {
        if (!container || !node) return;
        var item = document.createElement("section");
        item.className = "entry-assist-item";
        var heading = document.createElement("h3");
        heading.textContent = label;
        item.append(heading, node);
        container.appendChild(item);
      }
      function humanizeEntryHints(entry, previewColumn) {
        var categoryKey = entry.getAttribute("data-category") || "unknown";
        var category = readableLabel("category", categoryKey);
        var captionSubject = categoryKey === "auto" ? "图片" : category;
        var insert = previewColumn.querySelector(".insert-hint");
        if (insert) {
          var insertChips = insert.querySelectorAll(".insert-chip");
          if (insertChips[0]) insertChips[0].textContent = readableLabel("insert", entry.getAttribute("data-insert"));
          if (insertChips[1]) {
            var anchorKey = insertChips[1].textContent.trim();
            if (readableLabels.anchor[anchorKey]) insertChips[1].textContent = readableLabels.anchor[anchorKey];
          }
          if (insertChips[2] && insertChips[2].textContent.indexOf("w") === 0) insertChips[2].textContent = "宽 " + insertChips[2].textContent.slice(1);
        }
        var caption = previewColumn.querySelector(".caption-hint");
        if (caption) {
          var captionChip = caption.querySelector(".caption-chip");
          var captionTitle = caption.querySelector(".caption-title");
          var captionNote = caption.querySelector(".caption-note");
          if (captionChip) captionChip.textContent = readableLabel("caption", entry.getAttribute("data-caption")) + "图注";
          if (captionTitle) captionTitle.textContent = "建议标题：" + captionSubject + (entry.getAttribute("data-role") === "compare" ? "对比" : "重点");
          if (captionNote) captionNote.hidden = true;
        }
        var story = previewColumn.querySelector(".story-hint");
        if (story) {
          var storyChips = story.querySelectorAll(".story-chip");
          if (storyChips[1]) storyChips[1].textContent = readableLabel("beat", entry.getAttribute("data-beat")) + "段";
        }
        var tags = previewColumn.querySelector(".tag-chips");
        if (tags) tags.hidden = true;
      }
      function organizeEntryActions(workflow, actions) {
        if (!workflow || !actions) return false;
        var buttons = Array.from(actions.querySelectorAll("button"));
        var secondary = buttons.slice(1);
        actions.className = "entry-primary-actions";
        workflow.appendChild(actions);
        if (!secondary.length) return true;
        var details = document.createElement("details");
        details.className = "entry-more-actions";
        var summary = document.createElement("summary");
        summary.textContent = "更多复制选项";
        var list = document.createElement("div");
        list.className = "secondary-actions";
        secondary.forEach(function (button) { list.appendChild(button); });
        details.append(summary, list);
        workflow.appendChild(details);
        return true;
      }
      function enhanceEntryLayout(entry, index) {
        if (!entry || entry.querySelector(".entry-workflow")) return;
        var previewColumn = entry.querySelector(".preview-column");
        var technicalSummary = entry.querySelector(".entry-summary");
        if (!previewColumn || !technicalSummary) return;
        var categoryKey = entry.getAttribute("data-category") || "unknown";
        var category = readableLabel("category", categoryKey);
        var layout = readableLabel("layout", entry.getAttribute("data-layout"));
        var slot = readableLabel("slot", entry.getAttribute("data-slot"));
        var role = readableLabel("role", entry.getAttribute("data-role"));
        var insert = readableLabel("insert", entry.getAttribute("data-insert"));
        var hue = readableLabel("hue", entry.getAttribute("data-hue"));
        var openLink = previewColumn.querySelector('a[href^="zotero://"]');
        var page = humanizePageValue(readSummaryValue(technicalSummary, "页码"));
        var quality = readSummaryValue(technicalSummary, "清晰度");
        var detector = readSummaryValue(technicalSummary, "采集方式");
        var size = readSummaryValue(technicalSummary, "大小");
        var badge = previewColumn.querySelector(".entry-badge");
        if (badge) badge.textContent = "第 " + (index + 1) + " 张 · " + category;
        technicalSummary.classList.add("is-technical-summary");
        technicalSummary.hidden = true;
        humanizeEntryHints(entry, previewColumn);

        var workflow = document.createElement("section");
        workflow.className = "entry-workflow";
        var title = document.createElement("h2");
        title.className = "entry-title";
        title.textContent = "第 " + (index + 1) + " 张图片 · " + category;
        var facts = document.createElement("dl");
        facts.className = "entry-readable-summary";
        appendReadableFact(facts, "原文页", page || "未知", openLink ? openLink.getAttribute("href") : "");
        appendReadableFact(facts, "清晰度", quality || "未知");
        appendReadableFact(facts, "版式", layout + " · " + slot);
        appendReadableFact(facts, "PPT 用途", role);
        appendReadableFact(facts, "建议尺寸", insert);
        appendReadableFact(facts, "主色调", hue);
        appendReadableFact(facts, "采集方式", detector || "未知");
        appendReadableFact(facts, "文件信息", size || "未知");
        workflow.append(title, facts);

        var assists = document.createElement("div");
        assists.className = "entry-assists";
        moveAssistItem(assists, previewColumn.querySelector(".palette-chips"), "配色");
        moveAssistItem(assists, previewColumn.querySelector(".contrast-pair"), "主色与对比色");
        moveAssistItem(assists, previewColumn.querySelector(".insert-hint"), "版式建议");
        moveAssistItem(assists, previewColumn.querySelector(".caption-hint"), "图注建议");
        moveAssistItem(assists, previewColumn.querySelector(".story-hint"), "叙事位置");
        if (assists.children.length) workflow.appendChild(assists);

        if (organizeEntryActions(workflow, previewColumn.querySelector(".entry-actions"))) {
          var actionStatus = document.createElement("span");
          actionStatus.className = "entry-action-status";
          actionStatus.setAttribute("role", "status");
          actionStatus.setAttribute("aria-live", "polite");
          workflow.appendChild(actionStatus);
        }
        var technicalDetails = entry.querySelector(".entry-details");
        if (technicalDetails) {
          var technicalTitle = technicalDetails.querySelector("summary");
          if (technicalTitle) technicalTitle.textContent = "来源与技术信息";
          workflow.appendChild(technicalDetails);
        }
        entry.appendChild(workflow);
      }
      function organizeHeaderActions(header, entryCount) {
        if (!header) return;
        var actions = header.querySelector(".meta.actions");
        if (!actions || actions.querySelector(".index-export-actions")) return;
        var buttons = Array.from(actions.querySelectorAll("button.copy-token"));
        if (buttons.length) {
          var details = document.createElement("details");
          details.className = "index-export-actions";
          var summary = document.createElement("summary");
          summary.textContent = entryCount > 1 ? "复制整篇信息" : "复制图片信息";
          summary.title = entryCount > 1
            ? "展开复制全部 PPT、叙事和 JSON 信息"
            : "展开复制当前图片的 PPT、叙事和 JSON 信息";
          var list = document.createElement("div");
          list.className = "index-export-list";
          buttons.forEach(function (button) { list.appendChild(button); });
          details.append(summary, list);
          var filterStatus = actions.querySelector(".filter-status");
          actions.insertBefore(details, filterStatus || null);
        }
        if (!header.querySelector(".filter-chip")) {
          var status = actions.querySelector(".filter-status");
          if (status) status.hidden = true;
        }
      }
      function organizeHeaderFilters(header) {
        if (!header) return null;
        var existing = header.querySelector(".index-filters");
        if (existing) return existing;
        var bars = Array.from(header.children).filter(function (node) {
          return node.classList && node.classList.contains("filter-bar");
        });
        if (!bars.length) return null;
        var details = document.createElement("details");
        details.className = "index-filters";
        details.id = "pdf-image-saver-index-filters";
        var summary = document.createElement("summary");
        summary.id = "pdf-image-saver-filter-summary";
        summary.textContent = "筛选图片";
        summary.title = "展开类别、色调、布局等筛选条件";
        var groups = document.createElement("div");
        groups.className = "index-filter-groups";
        bars.forEach(function (bar) { groups.appendChild(bar); });
        details.append(summary, groups);
        var actions = header.querySelector(".meta.actions");
        header.insertBefore(details, actions || null);
        return details;
      }
      function organizeHeaderJumps(header, entryCount) {
        if (!header) return null;
        var existing = header.querySelector(".index-jumps");
        if (existing) return existing;
        var jumps = header.querySelector(".meta.jumps");
        var actions = header.querySelector(".meta.actions");
        var firstLast = actions ? Array.from(actions.querySelectorAll("a.source-action")).filter(function (link) {
          var title = link.getAttribute("title") || "";
          return title.indexOf("定位第一张图片") >= 0 || title.indexOf("定位最后一张图片") >= 0;
        }) : [];
        if (!jumps && !firstLast.length) return null;
        var details = document.createElement("details");
        details.className = "index-jumps";
        details.id = "pdf-image-saver-index-jumps";
        var summary = document.createElement("summary");
        summary.textContent = "快速跳转（" + (entryCount || 0) + " 张）";
        summary.title = "展开首张、末张和逐图定位入口";
        var list = document.createElement("div");
        list.className = "index-jump-list";
        var nav = document.createElement("p");
        nav.className = "meta jumps";
        firstLast.forEach(function (link) { nav.appendChild(link); });
        if (jumps) {
          Array.from(jumps.childNodes).forEach(function (node) { nav.appendChild(node); });
          jumps.remove();
        }
        list.appendChild(nav);
        details.append(summary, list);
        header.appendChild(details);
        return details;
      }
      function enhanceHeaderLayout(entries) {
        var header = document.querySelector("header");
        if (!header) return;
        var metas = Array.from(header.children).filter(function (node) {
          return node.classList && node.classList.contains("meta") && !node.classList.contains("actions") && !node.classList.contains("jumps");
        });
        var firstSummary = entries[0] ? entries[0].querySelector(".entry-summary") : null;
        var quality = readSummaryValue(firstSummary, "清晰度") || "未知清晰度";
        var categories = [];
        entries.forEach(function (entry) {
          var label = readableLabel("category", entry.getAttribute("data-category"));
          if (!categories.includes(label)) categories.push(label);
        });
        if (metas[0]) {
          var original = metas[0].textContent;
          var timeStart = original.indexOf("保存时间：");
          var timeEnd = original.indexOf("Z。", timeStart);
          var savedAt = "";
          if (timeStart >= 0 && timeEnd > timeStart) {
            var date = new Date(original.slice(timeStart + 5, timeEnd + 1));
            if (Number.isFinite(date.getTime())) savedAt = date.toLocaleString("zh-CN", { hour12: false });
          }
          var scope = original.indexOf("自动") >= 0
            ? "历史候选采集"
            : original.indexOf("整页预览") >= 0
              ? "整页预览"
              : original.indexOf("全文") >= 0
                ? "全文"
                : "框选";
          metas[0].textContent = (savedAt ? "保存于 " + savedAt + " · " : "") + scope + " · 已写入 Zotero 和 PPT 图片库";
        }
        if (metas[1]) metas[1].textContent = "已保存 " + entries.length + " 张图片 · " + quality + " · " + categories.join("、");
        if (metas[2]) metas[2].hidden = true;
        organizeHeaderFilters(header);
        organizeHeaderActions(header, entries.length);
        organizeHeaderJumps(header, entries.length);
      }
      function enhanceSourceMaps() {
        Array.from(document.querySelectorAll(".source-map-link")).forEach(function (link) {
          var map = link.querySelector(".source-map");
          if (!map) return;
          var region = map.querySelector(".source-map-region") || Array.from(map.children).find(function (node) {
            return node.tagName === "SPAN" && !node.classList.contains("source-map-page-label");
          });
          if (region) region.classList.add("source-map-region");
          if (!map.querySelector(".source-map-page-label")) {
            var pageLabel = document.createElement("span");
            pageLabel.className = "source-map-page-label";
            pageLabel.setAttribute("aria-hidden", "true");
            pageLabel.textContent = "原文页";
            map.insertBefore(pageLabel, map.firstChild);
          }
          if (!link.querySelector(".source-map-legend")) {
            var legend = document.createElement("span");
            legend.className = "source-map-legend";
            legend.innerHTML = '<i aria-hidden="true"></i>绿色虚线：保存区域';
            link.appendChild(legend);
          }
        });
      }
      function installReadableIndexStyles() {
        if (document.getElementById("pdf-image-saver-readable-style")) return;
        var style = document.createElement("style");
        style.id = "pdf-image-saver-readable-style";
        style.textContent = [
          "body.pdf-image-saver-readable{box-sizing:border-box;width:100%;max-width:1180px;margin:0 auto;padding:18px 20px;font-size:14px;line-height:1.45;overflow-wrap:anywhere;color:#0F172A;background:#EEF2F7;}",
          "body.pdf-image-saver-readable header{margin:0 0 16px;padding:12px 14px;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:8px;box-shadow:0 2px 8px rgba(15,23,42,.06);}",
          "body.pdf-image-saver-readable h1{font-size:18px;line-height:1.3;margin:0 0 5px;}",
          "body.pdf-image-saver-readable .meta{line-height:1.45;}",
          "body.pdf-image-saver-readable .index-filters{margin:8px 0 4px;}",
          "body.pdf-image-saver-readable .index-filters>summary{width:fit-content;color:#2563EB;font-weight:600;cursor:pointer;}",
          "body.pdf-image-saver-readable .index-filter-groups{margin-top:8px;padding-top:5px;border-top:1px solid #E2E8F0;}",
          "body.pdf-image-saver-readable .index-jumps{margin-top:8px;}",
          "body.pdf-image-saver-readable .index-jumps>summary{width:fit-content;color:#2563EB;font-weight:600;cursor:pointer;}",
          "body.pdf-image-saver-readable .index-jump-list{margin-top:8px;}",
          "body.pdf-image-saver-readable .entry{grid-template-columns:minmax(320px,420px) minmax(0,1fr);gap:22px;margin:0 0 16px;padding:16px;border:1px solid #CBD5E1;border-radius:8px;background:#FFFFFF;}",
          "body.pdf-image-saver-readable .preview-column{gap:8px;}",
          "body.pdf-image-saver-readable .preview-link{display:block;width:100%;max-width:100%;}",
          "body.pdf-image-saver-readable .preview-link img{display:block;width:100%;max-width:100%;height:auto;object-fit:contain;}",
          "body.pdf-image-saver-readable .source-map-link{display:grid;gap:5px;width:fit-content;text-decoration:none;color:inherit;}",
          "body.pdf-image-saver-readable .source-map{position:relative;width:96px;aspect-ratio:.72;overflow:hidden;border:1px solid #94A3B8;background:#F8FAFC;}",
          "body.pdf-image-saver-readable .source-map .source-map-page-label{position:absolute;left:6px;top:5px;min-width:0;min-height:0;border:0;background:transparent;color:#64748B;font:600 10px/1.2 system-ui,sans-serif;}",
          "body.pdf-image-saver-readable .source-map .source-map-region{position:absolute;min-width:3px;min-height:3px;border:2px dashed #16A34A;background:rgba(22,163,74,.16);box-sizing:border-box;}",
          "body.pdf-image-saver-readable .source-map-legend{display:flex;align-items:center;gap:5px;color:#475569;font:11px/1.25 system-ui,sans-serif;}",
          "body.pdf-image-saver-readable .source-map-legend i{display:inline-block;width:14px;height:9px;border:2px dashed #16A34A;box-sizing:border-box;}",
          "body.pdf-image-saver-readable .entry-badge{font-size:11px;padding:2px 6px;}",
          "body.pdf-image-saver-readable .entry-workflow{min-width:0;display:grid;align-content:start;gap:13px;}",
          "body.pdf-image-saver-readable .entry-title{margin:0;font-size:16px;line-height:1.35;}",
          "body.pdf-image-saver-readable .entry-readable-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 18px;}",
          "body.pdf-image-saver-readable .entry-readable-summary>div{display:grid;grid-template-columns:72px minmax(0,1fr);gap:7px;padding:3px 0;border-bottom:1px solid #eef0f3;}",
          "body.pdf-image-saver-readable .entry-readable-summary dt{color:#64748B;}",
          "body.pdf-image-saver-readable .entry-readable-summary dd{color:#0F172A;font-weight:500;}",
          "body.pdf-image-saver-readable .entry-assists{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;padding-top:2px;}",
          "body.pdf-image-saver-readable .entry-assist-item{min-width:0;padding-top:7px;border-top:1px solid #e4e7ec;}",
          "body.pdf-image-saver-readable .entry-assist-item h3{margin:0 0 5px;color:#667085;font-size:12px;font-weight:600;}",
          "body.pdf-image-saver-readable .entry-primary-actions,body.pdf-image-saver-readable .secondary-actions,body.pdf-image-saver-readable .index-export-list{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}",
          "body.pdf-image-saver-readable .source-action{min-height:32px;box-sizing:border-box;padding:6px 10px;border-radius:6px;font-size:13px;line-height:1.25;}",
          "body.pdf-image-saver-readable .entry-primary-actions a.source-action{background:#2563EB;border-color:#2563EB;color:#FFFFFF;}",
          "body.pdf-image-saver-readable .entry-primary-actions button.source-action{background:#16A34A;border-color:#16A34A;color:#FFFFFF;}",
          "body.pdf-image-saver-readable .entry-more-actions,body.pdf-image-saver-readable .index-export-actions{width:fit-content;}",
          "body.pdf-image-saver-readable .entry-more-actions summary,body.pdf-image-saver-readable .index-export-actions summary{cursor:pointer;color:#344054;font-weight:600;}",
          "body.pdf-image-saver-readable .secondary-actions,body.pdf-image-saver-readable .index-export-list{margin-top:7px;}",
          "body.pdf-image-saver-readable .entry-action-status{display:block;min-height:20px;color:#16A34A;font-weight:600;}",
          "body.pdf-image-saver-readable .entry-action-status.is-error{color:#DC2626;}",
          "body.pdf-image-saver-readable .filter-status[hidden]{display:none!important;}",
          "body.pdf-image-saver-readable .insert-chip,body.pdf-image-saver-readable .caption-chip,body.pdf-image-saver-readable .story-chip{border:0;border-radius:0;padding:0;background:transparent;color:inherit;cursor:default;}",
          "body.pdf-image-saver-readable .entry-details{grid-column:auto;margin-top:1px;}",
          "body.pdf-image-saver-readable .entry-details summary,body.pdf-image-saver-readable > details > summary{font-weight:600;color:#475467;}",
          "body.pdf-image-saver-readable .is-technical-summary,body.pdf-image-saver-readable .tag-chips[hidden],body.pdf-image-saver-readable .caption-note[hidden]{display:none!important;}",
          "body.pdf-image-saver-readable > details{margin:8px 0 24px;}",
          "@media(prefers-color-scheme:dark){body.pdf-image-saver-readable{color:#F8FAFC;background:#0F172A;}body.pdf-image-saver-readable header,body.pdf-image-saver-readable .entry{background:#111827;border-color:#334155;}body.pdf-image-saver-readable .entry-readable-summary>div,body.pdf-image-saver-readable .entry-assist-item,body.pdf-image-saver-readable .index-filter-groups{border-color:#334155;}body.pdf-image-saver-readable .entry-readable-summary dd{color:#F8FAFC;}body.pdf-image-saver-readable .entry-readable-summary dt,body.pdf-image-saver-readable .entry-assist-item h3,body.pdf-image-saver-readable .source-map .source-map-page-label{color:#94A3B8;}body.pdf-image-saver-readable .index-filters>summary,body.pdf-image-saver-readable .index-jumps>summary{color:#60A5FA;}body.pdf-image-saver-readable .entry-more-actions summary,body.pdf-image-saver-readable .index-export-actions summary{color:#E2E8F0;}body.pdf-image-saver-readable .source-map{border-color:#64748B;background:#111827;}body.pdf-image-saver-readable .source-map-legend{color:#CBD5E1;}body.pdf-image-saver-readable .source-map .source-map-region{border-color:#22C55E;background:rgba(34,197,94,.18);}body.pdf-image-saver-readable .source-map-legend i{border-color:#22C55E;}}",
          "@media(max-width:760px){body.pdf-image-saver-readable{padding:10px;}body.pdf-image-saver-readable .entry{grid-template-columns:1fr;padding:12px;}body.pdf-image-saver-readable .entry-readable-summary,body.pdf-image-saver-readable .entry-assists{grid-template-columns:1fr;}body.pdf-image-saver-readable .preview-link:hover img,body.pdf-image-saver-readable .preview-link:focus-within img{transform:none;}}",
        ].join("");
        document.head.appendChild(style);
      }
      function enhanceIndexLayout() {
        if (!document.documentElement || !document.head || !document.body || !document.querySelectorAll) return;
        if (document.body.classList.contains("pdf-image-saver-readable")) return;
        var entries = Array.from(document.querySelectorAll("article.entry"));
        installReadableIndexStyles();
        document.body.classList.add("pdf-image-saver-readable");
        enhanceSourceMaps();
        enhanceHeaderLayout(entries);
        entries.forEach(enhanceEntryLayout);
      }
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
        var visibleCount = 0;
        var entries = document.querySelectorAll("article.entry");
        entries.forEach(function (entry) {
          var categoryMatch = activeCategory === "all" || entry.getAttribute("data-category") === activeCategory;
          var hueMatch = activeHue === "all" || entry.getAttribute("data-hue") === activeHue;
          var layoutMatch = activeLayout === "all" || entry.getAttribute("data-layout") === activeLayout;
          var slotMatch = activeSlot === "all" || entry.getAttribute("data-slot") === activeSlot;
          var roleMatch = activeRole === "all" || entry.getAttribute("data-role") === activeRole;
          var insertMatch = activeInsert === "all" || entry.getAttribute("data-insert") === activeInsert;
          var captionMatch = activeCaption === "all" || entry.getAttribute("data-caption") === activeCaption;
          var beatMatch = activeBeat === "all" || entry.getAttribute("data-beat") === activeBeat;
          var tagMatch = activeTag === "all" || (entry.getAttribute("data-style-tags") || "").split(",").includes(activeTag);
          var visible = categoryMatch && hueMatch && layoutMatch && slotMatch && roleMatch && insertMatch && captionMatch && beatMatch && tagMatch;
          entry.classList.toggle("is-hidden", !visible);
          if (visible) visibleCount += 1;
        });
        var activeFilterCount = [activeCategory, activeHue, activeLayout, activeSlot, activeRole, activeInsert, activeCaption, activeBeat, activeTag].filter(function (value) { return value !== "all"; }).length;
        var filterActive = activeFilterCount > 0;
        var clearButton = document.getElementById("pdf-image-saver-clear-filters");
        if (clearButton) {
          clearButton.disabled = !filterActive;
          clearButton.hidden = !filterActive;
          clearButton.title = filterActive ? "清除所有筛选" : "当前没有筛选条件";
          clearButton.setAttribute("aria-label", clearButton.title);
        }
        var status = document.getElementById("pdf-image-saver-filter-status");
        if (status) {
          status.textContent = "显示 " + visibleCount + " 张，共 " + entries.length + " 张";
          status.hidden = !filterActive;
        }
        var filterSummary = document.getElementById("pdf-image-saver-filter-summary");
        if (filterSummary) {
          filterSummary.textContent = activeFilterCount ? "筛选图片（已启用 " + activeFilterCount + " 项）" : "筛选图片";
          filterSummary.title = activeFilterCount ? "已启用 " + activeFilterCount + " 项筛选；展开后可修改" : "展开类别、色调、布局等筛选条件";
        }
        return { visible: visibleCount, total: entries.length };
      }
      var feedbackTimer = null;
      var feedbackSource = null;
      var feedbackSourceLabel = "";
      var feedbackStatuses = [];
      function clearFeedbackStatuses() {
        feedbackStatuses.forEach(function (status) {
          status.textContent = "";
          status.className = status.id === "pdf-image-saver-action-status" ? "index-action-status" : "entry-action-status";
        });
        feedbackStatuses = [];
      }
      function restoreFeedbackSource() {
        if (feedbackSource && feedbackSourceLabel) feedbackSource.textContent = feedbackSourceLabel;
        feedbackSource = null;
        feedbackSourceLabel = "";
      }
      function fallbackCopy(text) {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var copied = false;
        try {
          copied = document.execCommand("copy") === true;
        } catch (_error) {
          copied = false;
        }
        area.remove();
        return copied;
      }
      function showActionFeedback(source, message, ok, sourceMessage) {
        if (feedbackTimer) clearTimeout(feedbackTimer);
        clearFeedbackStatuses();
        restoreFeedbackSource();
        var status = document.getElementById("pdf-image-saver-action-status");
        var entry = source && typeof source.closest === "function" ? source.closest(".entry") : null;
        var localStatus = entry && typeof entry.querySelector === "function" ? entry.querySelector(".entry-action-status") : null;
        [status, localStatus].forEach(function (feedbackStatus) {
          if (!feedbackStatus || feedbackStatuses.includes(feedbackStatus)) return;
          feedbackStatus.textContent = message;
          feedbackStatus.className = feedbackStatus === status
            ? (ok ? "index-action-status" : "index-action-status is-error")
            : (ok ? "entry-action-status" : "entry-action-status is-error");
          feedbackStatuses.push(feedbackStatus);
        });
        var sourceTag = String(source && source.tagName || "").toUpperCase();
        var isPalette = !!(source && source.classList && source.classList.contains("palette-chip"));
        var canReplaceSourceLabel = !!(source && source.textContent && !isPalette && (!sourceTag || sourceTag === "BUTTON"));
        var originalLabel = canReplaceSourceLabel ? source.textContent : "";
        if (originalLabel) {
          feedbackSource = source;
          feedbackSourceLabel = originalLabel;
          source.textContent = sourceMessage || message;
        }
        feedbackTimer = setTimeout(function () {
          clearFeedbackStatuses();
          restoreFeedbackSource();
          feedbackTimer = null;
        }, 1800);
      }
      function showManualCopy(text) {
        var promptHost = typeof window === "object" && typeof window.prompt === "function" ? window : null;
        var promptFunction = promptHost ? promptHost.prompt : (typeof prompt === "function" ? prompt : null);
        if (!promptFunction) return false;
        try {
          promptFunction.call(promptHost, "浏览器阻止了自动复制。请按 Ctrl+C 复制以下内容：", text);
          return true;
        } catch (_error) {
          return false;
        }
      }
      function copyText(text, source) {
        if (!text) {
          showActionFeedback(source, "没有可复制内容", false);
          return Promise.resolve(false);
        }
        var copiedSynchronously = fallbackCopy(text);
        var clipboard = typeof navigator === "object" ? navigator.clipboard : null;
        var attempt = Promise.resolve(copiedSynchronously);
        if (!copiedSynchronously && clipboard && typeof clipboard.writeText === "function") {
          try {
            attempt = Promise.resolve(clipboard.writeText(text)).then(function () { return true; }, function () { return false; });
          } catch (_error) {
            attempt = Promise.resolve(false);
          }
        }
        return attempt.then(function (copied) {
          if (copied) {
            showActionFeedback(source, "已复制", true);
            return true;
          }
          var manualCopyOpened = showManualCopy(text);
          showActionFeedback(source, manualCopyOpened ? "请在弹窗中复制" : "复制失败", false, manualCopyOpened ? "请手动复制" : "复制失败");
          return copied;
        });
      }
      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!target) return;
        if (typeof target.closest === "function") target = target.closest("button, a") || target;
        if (target.classList && target.classList.contains("filter-chip")) {
          event.preventDefault();
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
          var filtered = applyFilters();
          showActionFeedback(null, "已筛选，显示 " + filtered.visible + " 张，共 " + filtered.total + " 张", true);
          return;
        }
        if (target.id === "pdf-image-saver-clear-filters") {
          event.preventDefault();
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
          showActionFeedback(null, "已清除筛选", true);
          return;
        }
        if (target.classList && target.classList.contains("palette-chip")) {
          event.preventDefault();
          copyText(target.getAttribute("data-copy") || target.getAttribute("title") || "", target);
          return;
        }
        if (target.classList && target.classList.contains("copy-token")) {
          event.preventDefault();
          copyText(target.getAttribute("data-copy") || "", target);
          return;
        }
        var href = typeof target.getAttribute === "function" ? target.getAttribute("href") || "" : "";
        if (/^zotero:\\/\\//i.test(href)) {
          showActionFeedback(target, "已请求 Zotero 定位", true);
        }
      });
      enhanceIndexLayout();
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
    const target = targetPage === null ? null : `第 ${targetPage + 1} 页`;
    const entryCount = Array.isArray(entries) ? entries.length : 0;
    const normalizedQuality = qualityKey === null ? null : normalizeQualityKey(qualityKey);
    const qualityLabel = normalizedQuality
      ? `${QUALITY[normalizedQuality].label}清晰度`
      : null;
    const categorySummary = formatCategorySummary(entries);
    const categoryLabel = categorySummary === "类别：无" ? null : categorySummary;
    const normalizedIndexKey = normalizePreviewIndexKey(indexKey);
    const fingerprint = normalizedIndexKey ? getPreviewIndexFingerprint(normalizedIndexKey) : null;
    const suffix = [
      "图片索引",
      scopeLabel,
      target,
      qualityLabel,
      categoryLabel,
      entryCount ? `${entryCount} 张` : null,
      fingerprint,
    ].filter(Boolean).join(" ");
    return `${base}｜${suffix}`.slice(0, 140);
  }

  async function confirmAndSaveOriginalImagesFromReader(reader, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    try {
      const win = Zotero.getMainWindow?.();
      const scope = normalizeOriginalScope(safeOptions.scope);
      const maxImages = scope === "document"
        ? getHelperMaxImages("document")
        : getHelperMaxImages("page");
      const ok = Services.prompt.confirm(
        win,
        "PDF 图片保存",
        `提取${scope === "document" ? "全文" : "本页"} PDF 嵌入原图？最多 ${maxImages} 张；单图上限 ${formatBytes(ORIGINAL_MAX_IMAGE_BYTES)}，本次上限 ${formatBytes(ORIGINAL_MAX_TOTAL_BYTES)}。此高级功能需要 Python 和 PyMuPDF；框选采集不受影响。`,
      );
      if (!ok) {
        const pageIndex = normalizePageIndex(safeOptions.pageIndex, null);
        showReaderToast(reader, `已取消高级原图提取（${formatOriginalScopeToken(scope, pageIndex)}）。`, "warning");
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
        showReaderToast(reader, `正在提取${formatOriginalScopeToken(scope, pageIndex)}的嵌入原图，请稍候。`, "warning");
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
      showReaderToast(reader, `正在提取${formatOriginalScopeToken(scope, pageIndex)}的嵌入原图…`, "progress");
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
            : `${helperMessage}；可继续使用“框选保存”。`,
          "warning",
        );
        return;
      }
      if (!report.images?.length) {
        await removeDirectoryIfExists(report.output_dir);
        showReaderToast(reader, `${formatOriginalScopeToken(scope, pageIndex)}没有可提取的嵌入原图。`, "warning");
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
        showReaderToast(reader, `${formatOriginalScopeToken(scope, pageIndex)}没有新的原图可保存。${skippedText}`, "warning");
        return;
      }
      showReaderToast(
        reader,
        `已保存 ${importResult.count} 张${formatOriginalScopeToken(scope, pageIndex)}嵌入原图。${skippedText}`,
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
          const imageBytes = typeof IOUtils !== "undefined" && typeof IOUtils.read === "function"
            ? normalizeDatabaseImageBytes(await IOUtils.read(image.filePath))
            : null;
          if (imageBytes?.length) {
            await publishPreviewEntriesToSharedLibrary({
              attachment,
              parentItem,
              entries: [{
                ...image,
                imageBytes,
                imageCategory: "figure",
                detector: "embedded_original",
                originType: "original",
                previewDuplicateKey: image.originalImageKey,
                pageNumber: image.pageNumber,
                bboxNormalized: image.bboxNormalized,
              }],
            });
          }
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
        indexErrorCount: 0,
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
    return `${base}｜原图｜第 ${pageNumber} 页｜第 ${occurrence} 张｜${key}`.slice(0, 140);
  }

  function buildOriginalImportSkippedText(importResult) {
    const parts = [];
    if (importResult.invalidCount) {
      parts.push(`无效 ${importResult.invalidCount} 张`);
    }
    if (importResult.missingCount) {
      parts.push(`文件缺失 ${importResult.missingCount} 张`);
    }
    if (importResult.errorCount) {
      parts.push(`无法读取 ${importResult.errorCount} 张`);
    }
    if (importResult.byteCapCount) {
      parts.push(`超过大小上限 ${importResult.byteCapCount} 张`);
    }
    if (importResult.duplicateCount) {
      parts.push(`重复 ${importResult.duplicateCount} 张`);
    }
    if (importResult.importErrorCount) {
      parts.push(`导入失败 ${importResult.importErrorCount} 张`);
    }
    if (importResult.indexErrorCount) {
      parts.push("索引写入失败");
    }
    if (importResult.overCapCount) {
      parts.push(`超过数量上限 ${importResult.overCapCount} 张（上限 ${importResult.maxImages} 张）`);
    }
    return parts.length ? ` 跳过：${parts.join("；")}。` : "";
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
    return `${base}｜原图索引｜${formatOriginalScopeToken(normalizeOriginalScope(scope))}｜${count} 张`.slice(0, 140);
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
        <td>第 ${index + 1} 张</td>
        <td><a href="${escapeHTML(image.open_pdf_uri)}">第 ${escapeHTML(String(image.page_number))} 页</a></td>
        <td title="${escapeHTML(image.original_image_key)}">${escapeHTML(image.original_image_fingerprint)}</td>
        <td>${escapeHTML(formatBytes(image.byte_count))}</td>
        <td>${escapeHTML(image.bbox_normalized.map((value) => value.toFixed(4)).join(", "))}</td>
        <td><a class="source-action" href="${escapeHTML(image.open_pdf_uri)}" title="定位原文第 ${escapeHTML(String(image.page_number))} 页">定位原文第 ${escapeHTML(String(image.page_number))} 页</a></td>
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
  <title>${escapeHTML(getSourceTitle(parentItem, attachment))}｜原图索引｜${escapeHTML(formatOriginalScopeToken(normalizedScope))}</title>
  <style>
    body { margin: 12px; font: 12.5px system-ui, sans-serif; color: #1f1f1f; background: #fff; }
    header { position: sticky; top: 0; z-index: 2; margin: 0 0 6px; padding: 8px 0 6px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid #e5e5e5; }
    h1 { font-size: 14px; margin: 0 0 3px; }
    .meta { color: #555; margin: 0 0 1px; line-height: 1.3; }
    .meta.actions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .meta.actions.footer-actions { margin-top: 10px; }
    .meta.jumps { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 6px; }
    .meta.jumps a { color: #2563EB; text-decoration: none; font-weight: 600; }
    .meta.jumps a:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    table { border-collapse: collapse; width: 100%; margin-top: 6px; }
    th, td { border-top: 1px solid #ddd; padding: 4px 5px; text-align: left; vertical-align: top; }
    th { color: #555; font-weight: 600; position: sticky; top: 52px; background: #fff; z-index: 1; }
    tbody tr:hover { background: #f7faff; }
    .source-action { display: inline-flex; align-items: center; width: fit-content; min-height: 32px; padding: 6px 10px; border: 1px solid #64748B; border-radius: 6px; color: #2563EB; text-decoration: none; background: #F8FAFC; line-height: 1.25; }
    .source-action:focus-visible, .source-map-link:focus-visible, .preview-link:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
    pre { white-space: pre-wrap; word-break: break-word; padding: 8px; background: #f6f8fa; border: 1px solid #ddd; font-size: 11.5px; }
  </style>
</head>
<body>
  <header id="top">
    <h1>${escapeHTML(getSourceTitle(parentItem, attachment))}</h1>
    <p class="meta">保存时间：${escapeHTML(createdAt)}。原图范围：${escapeHTML(formatOriginalScopeToken(normalizedScope))}；由可选原图助手生成。</p>
    <p class="meta">共 ${normalizedImages.length} 张图片；${escapeHTML(formatBytes(normalizedImages.reduce((sum, image) => sum + normalizeNonNegativeInteger(image.byte_count, 0), 0)))}；可定位原文页面。</p>
    ${normalizedImages.length ? `<p class="meta actions"><a class="source-action" href="${escapeHTML(normalizedImages[0].open_pdf_uri)}" title="定位第一张图片的原文第 ${escapeHTML(String(normalizedImages[0].page_number))} 页">定位第一张图片</a>${normalizedImages.length > 1 ? ` <a class="source-action" href="${escapeHTML(normalizedImages[normalizedImages.length - 1].open_pdf_uri)}" title="定位最后一张图片的原文第 ${escapeHTML(String(normalizedImages[normalizedImages.length - 1].page_number))} 页">定位最后一张图片</a>` : ""}</p>` : ""}
    ${normalizedImages.length > 1 ? `<p class="meta jumps">${normalizedImages.map((image, index) => `<a href="#o${index + 1}" title="跳转到第 ${index + 1} 张图片（原文第 ${escapeHTML(String(image.page_number))} 页）">第 ${index + 1} 张 · 第 ${escapeHTML(String(image.page_number))} 页</a>`).join(" ")}</p>` : ""}
  </header>
  <table>
    <thead><tr><th>序号</th><th>页码</th><th>来源标识</th><th>大小</th><th>位置</th><th>定位</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${normalizedImages.length > 1 ? `<p class="meta actions footer-actions"><a class="source-action" href="#top" title="返回顶部">返回顶部</a></p>` : ""}
  <details>
    <summary>完整元数据</summary>
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
        warnings: ["未找到 Python。"],
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
        failures.push(`${formatCommand(pythonCommand)}：${formatHelperStatusLabel(report.status)}`);
      } catch (error) {
        failures.push(`${formatCommand(pythonCommand)}：${translateUserFacingErrorDetail(getErrorMessage(error))}`);
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
    const candidatePaths = getCondaZlkPythonCandidatePaths();
    const existingPaths = await Promise.all(candidatePaths.map(async (candidate) => {
      try {
        return await IOUtils.exists(candidate) ? candidate : null;
      } catch (_error) {
        return null;
      }
    }));
    for (const candidate of existingPaths) {
      if (candidate) {
        commands.push({ command: candidate, args: [] });
      }
    }

    const condaNames = [
      getEnvironmentValue("CONDA_EXE"),
      ...(Services.appinfo.OS === "WINNT" ? ["conda.exe", "conda.bat"] : ["conda"]),
    ].filter(Boolean);
    for (const condaName of condaNames) {
      const conda = await resolvePythonCommand(condaName);
      if (conda) {
        commands.push({ command: conda.command, args: ["run", "-n", "zlk", "python"] });
      }
    }
    return commands;
  }

  function getCondaZlkPythonCandidatePaths() {
    const isWindows = Services.appinfo.OS === "WINNT";
    const candidates = [];
    const addCandidate = (root, ...segments) => {
      const normalizedRoot = String(root || "").trim();
      if (!normalizedRoot) {
        return;
      }
      try {
        candidates.push(PathUtils.join(normalizedRoot, ...segments));
      } catch (_error) {
        // Skip malformed environment variables rather than blocking the optional helper.
      }
    };
    const pythonSegments = isWindows ? ["python.exe"] : ["bin", "python"];
    const condaPrefix = getEnvironmentValue("CONDA_PREFIX");
    if (isZlkCondaEnvironmentPath(condaPrefix)) {
      addCandidate(condaPrefix, ...pythonSegments);
    }

    const home = getEnvironmentValue(isWindows ? "USERPROFILE" : "HOME");
    const localAppData = getEnvironmentValue("LOCALAPPDATA");
    const programData = getEnvironmentValue("PROGRAMDATA");
    const roots = [];
    const addRoot = (base, directory) => {
      const normalizedBase = String(base || "").trim();
      if (!normalizedBase) {
        return;
      }
      try {
        roots.push(PathUtils.join(normalizedBase, directory));
      } catch (_error) {
        // Ignore malformed roots; discovery remains best-effort.
      }
    };
    const rootNames = [".conda", "miniconda3", "anaconda3", "miniforge3", "mambaforge"];
    for (const name of rootNames) {
      addRoot(home, name);
    }
    if (isWindows) {
      for (const name of rootNames.slice(1)) {
        addRoot(localAppData, name);
        addRoot(programData, name);
      }
    }
    for (const root of roots) {
      addCandidate(root, "envs", "zlk", ...pythonSegments);
    }
    return [...new Set(candidates)];
  }

  function getEnvironmentValue(name) {
    try {
      return String(Services.env?.get?.(name) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function resetSelectionDimming(selection) {
    const panels = selection?.__pdfImageSaverDimPanels;
    if (!panels) {
      return;
    }
    Object.assign(panels.top?.style || {}, { left: "0", top: "0", width: "100%", height: "100%" });
    Object.assign(panels.bottom?.style || {}, { left: "0", top: "100%", width: "100%", height: "0" });
    Object.assign(panels.left?.style || {}, { left: "0", top: "0", width: "0", height: "0" });
    Object.assign(panels.right?.style || {}, { left: "100%", top: "0", width: "0", height: "0" });
  }

  function renderSelectionDimming(selection, rect) {
    const panels = selection?.__pdfImageSaverDimPanels;
    if (!panels || !rect) {
      return;
    }
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    Object.assign(panels.top?.style || {}, {
      left: "0",
      top: "0",
      width: "100%",
      height: `${rect.top}px`,
    });
    Object.assign(panels.bottom?.style || {}, {
      left: "0",
      top: `${bottom}px`,
      width: "100%",
      height: `calc(100% - ${bottom}px)`,
    });
    Object.assign(panels.left?.style || {}, {
      left: "0",
      top: `${rect.top}px`,
      width: `${rect.left}px`,
      height: `${rect.height}px`,
    });
    Object.assign(panels.right?.style || {}, {
      left: `${right}px`,
      top: `${rect.top}px`,
      width: `calc(100% - ${right}px)`,
      height: `${rect.height}px`,
    });
  }

  function isZlkCondaEnvironmentPath(value) {
    const normalized = String(value || "").trim().replace(/[\\/]+$/, "");
    const name = normalized.split(/[\\/]/).pop();
    return String(name || "").toLowerCase() === "zlk";
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
      const executable = Services.appinfo.OS === "WINNT"
        ? String(command.command || "").toLowerCase()
        : String(command.command || "");
      const key = `${executable}\u0000${command.args.join("\u0000")}`;
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
      log(`原图助手已退出，代码 ${process.exitValue}：${formatCommand(command)}`);
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
      log("已跳过插件临时目录之外的递归清理", { path });
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
    if (getReaderType(reader) === "pdf") {
      return true;
    }
    const contentType = String(
      reader?._item?.attachmentContentType ||
      reader?.attachmentContentType ||
      "",
    ).toLowerCase();
    return contentType === "application/pdf";
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
    if (shuttingDown) {
      return false;
    }
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
      if (shuttingDown) {
        return;
      }
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
      return normalizeMetadataText(message.message, "PDF 图片插件提示。", 280);
    }
    return normalizeMetadataText(message, "PDF 图片插件提示。", 280);
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
    if (shuttingDown || !doc?.body) {
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
    toast.setAttribute?.("title", "点击关闭；按 Esc 关闭");
    const dismissToast = () => removeReaderToast(doc, toast);
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
    dismissMark.textContent = "关闭";
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
          removeReaderToast(doc, toast);
        }
      }, getToastDuration(level));
    }
    return true;
  }

  function showFallbackAlert(fallbackWindow, message) {
    Services.prompt.alert(fallbackWindow, "PDF 图片保存", message);
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
        border: 1px solid var(--fill-quinary, #CBD5E1);
        border-radius: 6px;
        background: var(--material-background, #FFFFFF);
        color: var(--fill-primary, #0F172A);
        font: inherit;
        cursor: pointer;
        box-sizing: border-box;
        min-height: 28px;
        width: 82px;
        min-width: 82px;
        max-width: 82px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #pdf-image-saver-clip-button {
        width: 94px;
        min-width: 94px;
        max-width: 94px;
      }
      .pdf-image-saver-toolbar-button:hover { background: var(--fill-quinary, #F8FAFC); }
      .pdf-image-saver-toolbar-button:disabled {
        opacity: 0.65;
        cursor: progress;
      }
      .pdf-image-saver-toolbar-group[data-mode="clip"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="page"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="page-review"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="page-save"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="original"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="clip-review"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="clip-save"] .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-group[data-mode="clip"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="page"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="page-review"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="page-save"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="original"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="clip-review"] .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-group[data-mode="clip-save"] .pdf-image-saver-toolbar-choice-trigger {
        border-color: var(--accent-color, #2563EB);
      }
      .pdf-image-saver-toolbar-group {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin: 0 5px;
        padding: 0 1px;
        flex: 0 0 auto;
        position: relative;
        overflow: visible;
        -moz-window-dragging: no-drag !important;
      }
      .pdf-image-saver-toolbar-group *,
      .pdf-image-saver-toolbar-button,
      .pdf-image-saver-toolbar-choice-trigger,
      .pdf-image-saver-toolbar-choice-item {
        -moz-window-dragging: no-drag !important;
      }
      .pdf-image-saver-toolbar-choice {
        position: relative;
        display: inline-flex;
        flex: 0 0 auto;
        overflow: visible;
      }
      .pdf-image-saver-toolbar-choice-trigger {
        box-sizing: border-box;
        min-height: 28px;
        padding: 3px 8px;
        border: 1px solid var(--fill-quinary, #CBD5E1);
        border-radius: 6px;
        background: var(--material-background, #FFFFFF);
        color: var(--fill-primary, #0F172A);
        font: inherit;
        cursor: pointer;
        white-space: nowrap;
      }
      .pdf-image-saver-toolbar-quality-choice .pdf-image-saver-toolbar-choice-trigger {
        width: 112px;
        min-width: 112px;
      }
      .pdf-image-saver-toolbar-category-choice .pdf-image-saver-toolbar-choice-trigger {
        width: 122px;
        min-width: 122px;
      }
      .pdf-image-saver-toolbar-choice-trigger:hover {
        background: var(--fill-quinary, #F8FAFC);
      }
      .pdf-image-saver-toolbar-choice-trigger:disabled {
        opacity: 0.72;
        cursor: not-allowed;
      }
      .pdf-image-saver-toolbar-choice-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 2147483647;
        display: grid;
        gap: 2px;
        min-width: max-content;
        max-width: min(300px, calc(100vw - 12px));
        max-height: min(360px, calc(100vh - 56px));
        overflow: auto;
        padding: 5px;
        border: 1px solid var(--fill-quinary, #CBD5E1);
        border-radius: 8px;
        box-shadow: 0 5px 16px rgba(15, 23, 42, 0.18);
        background: var(--material-background, #FFFFFF);
      }
      .pdf-image-saver-toolbar-choice-menu[hidden] {
        display: none;
      }
      .pdf-image-saver-toolbar-choice-item {
        box-sizing: border-box;
        min-height: 30px;
        padding: 5px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--fill-primary, #0F172A);
        font: inherit;
        text-align: left;
        cursor: pointer;
        white-space: nowrap;
      }
      .pdf-image-saver-toolbar-choice-item:hover,
      .pdf-image-saver-toolbar-choice-item.is-selected {
        border-color: #BFDBFE;
        background: #EFF6FF;
      }
      .pdf-image-saver-toolbar-choice-item:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .pdf-image-saver-toolbar-category-choice { display: none; }
      .pdf-image-saver-toast {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 999999;
        max-width: min(320px, calc(100vw - 24px));
        padding: 6px 8px;
        border-radius: 6px;
        box-shadow: 0 3px 12px rgba(15, 23, 42, 0.2);
        cursor: pointer;
        background: #111827;
        color: #F8FAFC;
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
      .pdf-image-saver-success { background: #16A34A; }
      .pdf-image-saver-warning { background: #D97706; }
      .pdf-image-saver-error { background: #DC2626; }
      .pdf-image-saver-progress {
        background: #2563EB;
        border-left: 3px solid #BFDBFE;
      }
      .pdf-image-saver-selection-overlay {
        position: fixed;
        z-index: 2147483646;
        cursor: crosshair !important;
        pointer-events: auto !important;
        touch-action: none;
        user-select: none;
        overflow: hidden;
        background: transparent;
      }
      .pdf-image-saver-clip-active,
      .pdf-image-saver-clip-active * {
        -moz-user-select: none !important;
        user-select: none !important;
      }
      .pdf-image-saver-selection-hint {
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 3;
        padding: 3px 7px;
        border-radius: 6px;
        background: rgba(15, 23, 42, 0.88);
        color: #fff;
        font: 11.5px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      .pdf-image-saver-selection-dim {
        position: absolute;
        z-index: 1;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.56);
        pointer-events: none;
      }
      .pdf-image-saver-selection-box {
        position: absolute;
        z-index: 2;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        border: 2px dashed #16A34A !important;
        background: transparent;
        box-sizing: border-box;
        pointer-events: none;
      }
      .pdf-image-saver-selection-size {
        position: absolute;
        right: 0;
        bottom: 0;
        padding: 1px 4px;
        border-radius: 6px 0 0 0;
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        font: 10.5px system-ui, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      .pdf-image-saver-selection-size.is-min {
        background: rgba(220, 38, 38, 0.94);
      }
      .pdf-image-saver-preview-review-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 18px;
        overflow: auto;
        background: rgba(0, 0, 0, 0.62);
        color: var(--fill-primary, #0F172A);
        font: 13px system-ui, sans-serif;
      }
      .pdf-image-saver-preview-review-panel {
        width: min(680px, 100%);
        max-height: min(860px, calc(100vh - 36px));
        overflow: auto;
        box-sizing: border-box;
        padding: 16px;
        border: 1px solid var(--fill-quinary, #CBD5E1);
        border-radius: 8px;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.42);
        background: var(--material-background, #FFFFFF);
        color: var(--fill-primary, #0F172A);
        color-scheme: light dark;
      }
      .pdf-image-saver-preview-review-title { margin: 0 0 5px; font: 600 18px system-ui, sans-serif; }
      .pdf-image-saver-preview-review-instruction { margin: 0 0 12px; color: var(--accent-color, #2563EB); font-weight: 600; }
      .pdf-image-saver-preview-review-image {
        display: block;
        box-sizing: border-box;
        width: auto;
        max-width: 100%;
        max-height: min(48vh, 440px);
        margin: 0 auto;
        border: 1px solid rgba(0, 0, 0, 0.24);
        background: #F8FAFC;
        object-fit: contain;
      }
      .pdf-image-saver-preview-review-meta,
      .pdf-image-saver-preview-review-suggestion,
      .pdf-image-saver-preview-review-evidence { margin: 9px 0 0; line-height: 1.45; }
      .pdf-image-saver-preview-review-meta { color: var(--fill-secondary, #64748B); font-size: 12px; }
      .pdf-image-saver-preview-review-suggestion { font-weight: 600; }
      .pdf-image-saver-preview-review-evidence { padding: 7px 8px; border-left: 3px solid var(--accent-color, #2563EB); background: #EFF6FF; }
      .pdf-image-saver-preview-review-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
      .pdf-image-saver-preview-review-field { display: grid; gap: 5px; color: inherit; font-weight: 600; }
      .pdf-image-saver-preview-review-field-help { margin: 7px 0 0; color: var(--fill-secondary, #64748B); font-size: 12px; line-height: 1.4; }
      .pdf-image-saver-preview-review-field select {
        width: 100%;
        min-height: 32px;
        box-sizing: border-box;
        padding: 4px 7px;
        border: 1px solid var(--fill-secondary, #64748B);
        border-radius: 6px;
        background: var(--material-background, #FFFFFF);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .pdf-image-saver-preview-review-actions { position: sticky; bottom: -16px; z-index: 2; display: flex; justify-content: flex-end; gap: 8px; margin: 16px -16px -16px; padding: 11px 16px 16px; border-top: 1px solid var(--fill-quinary, #CBD5E1); background: var(--material-background, #FFFFFF); }
      .pdf-image-saver-preview-review-actions button { min-height: 32px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font: 600 13px/1.25 system-ui, sans-serif; }
      .pdf-image-saver-preview-review-cancel { border: 1px solid var(--fill-secondary, #64748B); background: var(--material-background, #FFFFFF); color: inherit; }
      .pdf-image-saver-preview-review-confirm { border: 1px solid #2563EB; background: #2563EB; color: #FFFFFF; }
      .pdf-image-saver-preview-review-field select:focus-visible,
      .pdf-image-saver-preview-review-actions button:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
      @media (max-width: 460px) {
        .pdf-image-saver-preview-review-backdrop { padding: 8px; }
        .pdf-image-saver-preview-review-panel { padding: 12px; }
        .pdf-image-saver-preview-review-fields { grid-template-columns: 1fr; }
        .pdf-image-saver-preview-review-actions { bottom: -12px; margin: 14px -12px -12px; padding: 10px 12px 12px; }
        .pdf-image-saver-preview-review-actions button { flex: 1 1 0; }
      }
      @media (prefers-color-scheme: dark) {
        .pdf-image-saver-preview-review-panel,
        .pdf-image-saver-preview-review-actions,
        .pdf-image-saver-preview-review-field select,
        .pdf-image-saver-preview-review-cancel { background: var(--material-background, #111827); color: var(--fill-primary, #F8FAFC); }
        .pdf-image-saver-preview-review-instruction { color: var(--accent-color, #60A5FA); }
        .pdf-image-saver-preview-review-meta,
        .pdf-image-saver-preview-review-field-help { color: var(--fill-secondary, #94A3B8); }
        .pdf-image-saver-preview-review-evidence { background: #1E293B; }
      }
    `;
    (doc.head || doc.documentElement)?.appendChild(style);
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
      label: `横向 ${formatPercent(left)}–${formatPercent(right)}；纵向 ${formatPercent(top)}–${formatPercent(bottom)}；宽 ${formatPercent(width)} × 高 ${formatPercent(height)}`,
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
      : `第 ${normalizePageNumber(pageNumber, 1)} 页`;
    const map = `<div class="source-map" title="${escapeHTML(region.label || "框选位置")}"><span class="source-map-page-label" aria-hidden="true">原文页</span><span class="source-map-region" style="left:${formatCSSPercent(region.left)};top:${formatCSSPercent(region.top)};width:${formatCSSPercent(region.width)};height:${formatCSSPercent(region.height)}"></span></div>`;
    const uri = normalizeMetadataText(openURI, null, 500);
    if (!uri) {
      return map;
    }
    const caption = `原文位置 · ${pageToken || "页码未知"}`;
    return `<a class="source-map-link" href="${escapeHTML(uri)}" title="定位原文${escapeHTML(pageToken)}的框选位置" aria-label="${escapeHTML(caption)}；绿色虚线为保存区域；点击定位原文"><span class="source-map-caption">${escapeHTML(caption)}</span>${map}<span class="source-map-legend"><i aria-hidden="true"></i>绿色虚线：保存区域</span></a>`;
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
      return "高级原图提取不可用：未安装 PyMuPDF。";
    }
    if (status === "no_python") {
      return "高级原图提取不可用：未找到 Python。";
    }
    // Translate first: a known internal message must keep its Chinese explanation instead of
    // collapsing into the generic console hint. The trailing period is dropped because the
    // detail is rendered inside parentheses.
    const details = normalizeHelperWarningMessages(report?.warnings)
      .map((warning) => translateUserFacingErrorDetail(warning).replace(/。$/, ""))
      .filter((warning, index, list) => list.indexOf(warning) === index)
      .join("；");
    return `高级原图提取失败：${formatHelperStatusLabel(status)}${details ? `（${details}）` : ""}`;
  }

  function normalizeHelperStatusText(status) {
    return normalizeMetadataText(status, "unknown", 60);
  }

  const HELPER_STATUS_LABELS = {
    ok: "已完成",
    error: "助手运行失败",
    timeout: "运行超时",
    invalid_report: "结果格式无效",
    no_images: "未提取到原图",
    no_python: "未找到 Python",
    missing_pymupdf: "未安装 PyMuPDF",
    unknown: "原因未知",
  };

  function formatHelperStatusLabel(status) {
    return HELPER_STATUS_LABELS[normalizeHelperStatusText(status)] || "助手返回异常";
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
    return String(value || "PDF 图片").replace(/\s+/g, " ").trim().slice(0, 90);
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
    return IMAGE_CATEGORIES[key].label;
  }

  function getImageCategoryMark(categoryKey) {
    const labels = {
      auto: "自动", metric_curve: "曲线", heatmap: "热图", bar_chart: "柱图", distribution: "分布",
      qualitative: "对比", architecture: "结构", pipeline: "流程", table: "表格", equation: "公式",
      schematic: "示意", photo: "影像", chart: "图表", diagram: "流程", figure: "插图",
    };
    return labels[normalizeImageCategoryKey(categoryKey)] || "插图";
  }

  function getSavedImageCategoryLabel(categoryKey) {
    return normalizeImageCategoryKey(categoryKey) === "auto" ? "未分类" : getImageCategoryLabel(categoryKey);
  }

  function getSavedImageCategoryMark(categoryKey) {
    return normalizeImageCategoryKey(categoryKey) === "auto" ? "未分类" : getImageCategoryMark(categoryKey);
  }

  function formatStyleTagLabel(value) {
    const key = normalizeMetadataText(value, "", 80).toLowerCase();
    if (IMAGE_CATEGORIES[key]) return IMAGE_CATEGORIES[key].label;
    if (STYLE_TAG_LABELS[key]) return STYLE_TAG_LABELS[key];
    if (COLOR_FAMILY_LABELS[key]) return COLOR_FAMILY_LABELS[key];
    if (LAYOUT_HINT_LABELS[key]) return LAYOUT_HINT_LABELS[key];
    if (SLIDE_SLOT_LABELS[key]) return SLIDE_SLOT_LABELS[key];
    if (ROLE_HINT_LABELS[key]) return ROLE_HINT_LABELS[key];
    const prefixed = [
      [/^(?:ins|insert)-(large|medium|small)$/, (match) => `${INSERT_SIZE_LABELS[match[1]] || "未知"}尺寸`],
      [/^(?:cap|caption)-(result|method|compare|context)$/, (match) => `${CAPTION_TONE_LABELS[match[1]] || "未知"}型图注`],
      [/^(?:beat|story)-(hook|setup|method|result|compare|close)$/, (match) => `${STORY_BEAT_LABELS[match[1]] || "未知"}阶段`],
      [/^slide-(hero|side|footer|inset)$/, (match) => `${SLIDE_SLOT_LABELS[match[1]] || "未知"}版位`],
      [/^role-(result|method|evidence|compare|context)$/, (match) => ROLE_HINT_LABELS[match[1]] || "未知用途"],
    ];
    for (const [pattern, formatter] of prefixed) {
      const match = key.match(pattern);
      if (match) return formatter(match);
    }
    const label = normalizeMetadataText(value, "未知标签", 80);
    return /[\u3400-\u9fff]/.test(label) ? label : "其他标签";
  }

  function formatStyleTagsLabel(tags) {
    const values = normalizeStyleTags(tags);
    return values.length ? values.map(formatStyleTagLabel).join("、") : "无";
  }

  function formatPaletteLabel(palette) {
    const values = normalizePalette(palette);
    return values.length ? values.map((swatch) => swatch.hex).join(" ") : "无";
  }

  function formatCategorySummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeImageCategoryKey(entry?.imageCategory || entry?.image_category);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "类别：无";
    }
    return `类别：${[...counts.entries()].map(([key, count]) => `${getSavedImageCategoryMark(key)} ${count} 张`).join("、")}`;
  }

  function formatColorFamilySummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const family = normalizeColorFamily(entry?.colorFamily || entry?.color_family || deriveColorFamilyFromPalette(entry?.palette));
      counts.set(family, (counts.get(family) || 0) + 1);
    }
    if (!counts.size) {
      return "色调：无";
    }
    return `色调：${[...counts.entries()].map(([family, count]) => `${formatColorFamilyLabel(family)} ${count} 张`).join("、")}`;
  }

  function formatColorFamilyLabel(value) {
    const family = normalizeColorFamily(value);
    return COLOR_FAMILY_LABELS[family] || COLOR_FAMILY_LABELS.unknown;
  }

  function formatPptAssistSummary(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      return "无";
    }
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
    return [
      formatCategorySummary(list),
      formatLayoutHintSummary(list),
      formatSlideSlotSummary(list),
      formatRoleHintSummary(list),
      formatInsertHintSummary(list),
      formatCaptionHintSummary(list),
      formatStoryHintSummary(list),
      formatColorFamilySummary(list),
      `配色：${hexes.join(" ") || "无"}`,
    ].join("；");
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
    const chips = [buildFilterChipHTML("category", "all", `全部 ${list.length}`, list.length, "全部类别", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("category", key, `${getSavedImageCategoryMark(key)} ${count}`, count, `类别 ${getSavedImageCategoryLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="类别筛选"><span class="filter-label" aria-hidden="true">类别</span>${chips.join("")}</div>`;
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
    const chips = [buildFilterChipHTML("hue", "all", "全部", list.length, "全部色调", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("hue", key, `${formatColorFamilyLabel(key)} ${count}`, count, `色调 ${formatColorFamilyLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="色调筛选"><span class="filter-label" aria-hidden="true">色调</span>${chips.join("")}</div>`;
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
    const chips = [buildFilterChipHTML("layout", "all", "全部", list.length, "全部布局", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("layout", key, `${LAYOUT_HINT_LABELS[key] || "未知"} ${count}`, count, `布局 ${formatLayoutHintLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="布局筛选"><span class="filter-label" aria-hidden="true">布局</span>${chips.join("")}</div>`;
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
    const chips = [buildFilterChipHTML("slot", "all", "全部", list.length, "全部位置", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("slot", key, `${SLIDE_SLOT_LABELS[key] || "未知"} ${count}`, count, `位置 ${formatSlideSlotLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="位置筛选"><span class="filter-label" aria-hidden="true">位置</span>${chips.join("")}</div>`;
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
    const chips = [buildFilterChipHTML("role", "all", "全部", list.length, "全部用途", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("role", key, `${ROLE_HINT_LABELS[key] || "未知"} ${count}`, count, `用途 ${formatRoleHintLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="用途筛选"><span class="filter-label" aria-hidden="true">用途</span>${chips.join("")}</div>`;
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
    const chips = [buildFilterChipHTML("insert", "all", "全部", list.length, "全部尺寸", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("insert", key, `${INSERT_SIZE_LABELS[key] || "未知"} ${count}`, count, `插入尺寸 ${INSERT_SIZE_LABELS[key] || "未知"}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="插入尺寸筛选"><span class="filter-label" aria-hidden="true">尺寸</span>${chips.join("")}</div>`;
  }

  function buildInsertHintHTML(insertHint) {
    const hint = normalizeInsertHint(insertHint);
    if (!hint || hint.size === "unknown") {
      return "";
    }
    return `<div class="insert-hint" title="${escapeHTML(formatInsertHintLabel(hint))}"><span class="insert-chip">${escapeHTML(INSERT_SIZE_LABELS[hint.size] || "未知")}</span><span class="insert-chip">${escapeHTML(ANCHOR_LABELS[hint.anchor] || "居中")}</span><span class="insert-chip">宽度 ${escapeHTML(String(hint.width_pct))}%</span></div>`;
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
    const chips = [buildFilterChipHTML("caption", "all", "全部", list.length, "全部图注语气", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("caption", key, `${CAPTION_TONE_LABELS[key] || "未知"} ${count}`, count, `图注语气 ${CAPTION_TONE_LABELS[key] || "未知"}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="图注语气筛选"><span class="filter-label" aria-hidden="true">图注</span>${chips.join("")}</div>`;
  }

  function buildCaptionHintHTML(captionHint) {
    const hint = normalizeCaptionHint(captionHint);
    if (!hint || hint.tone === "unknown") {
      return "";
    }
    return `<div class="caption-hint" title="${escapeHTML(formatCaptionHintLabel(hint))}"><span class="caption-chip">${escapeHTML(CAPTION_TONE_LABELS[hint.tone] || "未知")}</span><div class="caption-title">${escapeHTML(hint.title)}</div><div class="caption-note">${escapeHTML(hint.note)}</div></div>`;
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
    const chips = [buildFilterChipHTML("beat", "all", "全部", list.length, "全部叙事阶段", true)];
    for (const [key, count] of counts.entries()) {
      chips.push(buildFilterChipHTML("beat", key, `${STORY_BEAT_LABELS[key] || "未知"} ${count}`, count, `叙事阶段 ${STORY_BEAT_LABELS[key] || "未知"}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="叙事阶段筛选"><span class="filter-label" aria-hidden="true">叙事</span>${chips.join("")}</div>`;
  }

  function buildStoryHintHTML(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || 1);
    const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || "unknown");
    if (beat === "unknown" && order <= 0) {
      return "";
    }
    return `<div class="story-hint" title="${escapeHTML(formatStoryHintLabel(safe))}"><span class="story-chip">第 ${escapeHTML(String(order))} 张</span><span class="story-chip">${escapeHTML(STORY_BEAT_LABELS[beat] || "未知")}</span></div>`;
  }

  function buildTagChipsHTML(styleTags) {
    const tags = normalizeStyleTags(styleTags);
    if (!tags.length) {
      return "";
    }
    return `<div class="tag-chips" title="绘图风格标签">${tags.slice(0, 8).map((tag) => `<span class="tag-chip">${escapeHTML(formatStyleTagLabel(tag))}</span>`).join("")}</div>`;
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
    const chips = [buildFilterChipHTML("tag", "all", "全部", list.length, "全部风格标签", true)];
    for (const [key, count] of top) {
      chips.push(buildFilterChipHTML("tag", key, `${formatStyleTagLabel(key)} ${count}`, count, `风格标签 ${formatStyleTagLabel(key)}`));
    }
    return `<div class="filter-bar" role="toolbar" aria-label="风格标签筛选"><span class="filter-label" aria-hidden="true">标签</span>${chips.join("")}</div>`;
  }

  async function getSharedDatabaseConnection() {
    const databasePath = resolveDefaultSharedDatabasePath();
    if (!sharedDatabaseConnection) {
      if (typeof Zotero?.DBConnection !== "function") {
        throw new Error("Storage failed: shared SQLite runtime unavailable.");
      }
      const directory = getParentPath(databasePath);
      await ensureSharedLibraryDirectory(directory);
      sharedDatabaseConnection = new Zotero.DBConnection(databasePath);
    }
    return sharedDatabaseConnection;
  }

  async function closeSharedDatabaseConnection() {
    const database = sharedDatabaseConnection;
    sharedDatabaseConnection = null;
    if (typeof database?.closeDatabase !== "function") {
      return false;
    }
    await database.closeDatabase(true);
    return true;
  }

  function removeReaderToast(doc, knownToast = null) {
    const toast = knownToast || doc?.getElementById?.("pdf-image-saver-toast");
    if (!toast) {
      return false;
    }
    if (toast.__pdfImageSaverToastTimer && doc?.defaultView?.clearTimeout) {
      doc.defaultView.clearTimeout(toast.__pdfImageSaverToastTimer);
    }
    toast.__pdfImageSaverToastTimer = null;
    if (toast.__pdfImageSaverEscHandler) {
      doc?.removeEventListener?.("keydown", toast.__pdfImageSaverEscHandler, true);
    }
    toast.__pdfImageSaverEscHandler = null;
    toast.remove?.();
    return true;
  }

  async function ensureSharedLibrarySchema() {
    const database = await getSharedDatabaseConnection();
    await database.executeTransaction(async () => {
      await database.queryAsync(`CREATE TABLE IF NOT EXISTS images (
        image_id TEXT PRIMARY KEY,
        image_blob BLOB NOT NULL,
        thumbnail_blob BLOB,
        title TEXT,
        year TEXT,
        doi TEXT,
        page_number INTEGER,
        created_at TEXT NOT NULL,
        source_region_key TEXT NOT NULL UNIQUE,
        preview_duplicate_key TEXT,
        parent_item_key TEXT,
        pdf_attachment_key TEXT,
        zotero_open_pdf_uri TEXT,
        zotero_select_item_uri TEXT,
        zotero_select_pdf_uri TEXT,
        library_id INTEGER,
        library_type TEXT,
        group_id INTEGER,
        bbox_json TEXT,
        palette_json TEXT,
        image_category TEXT,
        color_family TEXT,
        style_tags_json TEXT,
        quality TEXT,
        detector TEXT,
        rendered_width INTEGER,
        rendered_height INTEGER,
        dominant_hex TEXT,
        contrast_hex TEXT,
        content_sha256 TEXT,
        origin_type TEXT,
        source_match_status TEXT,
        imported_at TEXT,
        deleted INTEGER NOT NULL DEFAULT 0
      )`);
      await ensureSharedImageMetadataColumns(database);
      await database.queryAsync(`CREATE TABLE IF NOT EXISTS image_palette_swatches (
        image_id TEXT NOT NULL,
        hex TEXT NOT NULL,
        swatch_index INTEGER NOT NULL,
        role TEXT,
        PRIMARY KEY (image_id, swatch_index),
        FOREIGN KEY (image_id) REFERENCES images(image_id)
      )`);
      await database.queryAsync(`CREATE TABLE IF NOT EXISTS bridge_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )`);
    });
    return database;
  }

  async function ensureSharedImageMetadataColumns(database) {
    const definitions = {
      image_category: "TEXT",
      color_family: "TEXT",
      style_tags_json: "TEXT",
      quality: "TEXT",
      detector: "TEXT",
      rendered_width: "INTEGER",
      rendered_height: "INTEGER",
      dominant_hex: "TEXT",
      contrast_hex: "TEXT",
      content_sha256: "TEXT",
      origin_type: "TEXT",
      source_match_status: "TEXT",
      imported_at: "TEXT",
    };
    const rows = await database.queryAsync("PRAGMA table_info(images)");
    const existing = new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.name || row?.NAME || "").toLowerCase()));
    for (const [name, type] of Object.entries(definitions)) {
      if (!existing.has(name)) {
        await database.queryAsync(`ALTER TABLE images ADD COLUMN ${name} ${type}`);
      }
    }
  }

  function dataURLToBytes(dataURL) {
    const match = String(dataURL || "").match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match || typeof atob !== "function") {
      throw new Error("Storage failed: preview image bytes unavailable.");
    }
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function buildZoteroSelectURI(item) {
    const key = normalizeMetadataText(item?.key, "", 80);
    if (!key) return "";
    const libraryID = normalizePositiveInteger(item?.libraryID, null);
    const library = libraryID ? Zotero.Libraries?.get?.(libraryID) : null;
    if (library?.libraryType === "group" && library.groupID) {
      return `zotero://select/groups/${library.groupID}/items/${key}`;
    }
    return `zotero://select/library/items/${key}`;
  }

  async function publishPreviewEntriesToSharedLibrary({ attachment, parentItem, entries }) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return { written: 0 };
    const database = await ensureSharedLibrarySchema();
    const createdAt = new Date().toISOString();
    await database.executeTransaction(async () => {
      for (const entry of list) {
        const sourceRegionKey = getSourceRegionKey(attachment, entry);
        const imageID = sourceRegionKey;
        const pageNumber = normalizePageNumber(entry?.pageNumber, 1);
        const openPDFURI = buildOpenPDFURI(attachment, pageNumber, entry?.annotationKey);
        const parentURI = buildZoteroSelectURI(parentItem);
        const attachmentURI = buildZoteroSelectURI(attachment);
        const palette = normalizePalette(entry?.palette);
        const imageBytes = normalizeDatabaseImageBytes(entry?.imageBytes) || dataURLToBytes(entry?.dataURL);
        const contentSHA256 = await computeSHA256Hex(imageBytes);
        const imageCategory = normalizeImageCategoryKey(entry?.imageCategory || entry?.image_category || "figure");
        const colorFamily = normalizeColorFamily(entry?.colorFamily || entry?.color_family || deriveColorFamilyFromPalette(palette));
        const styleTags = normalizeStyleTags(entry?.styleTags || entry?.style_tags || deriveStyleTagsFromPalette(palette));
        const quality = normalizeQualityKey(entry?.quality);
        const detector = normalizeMetadataText(entry?.detector, "unknown", 80);
        const renderedWidth = normalizePositiveInteger(entry?.renderedWidth || entry?.rendered_width, null);
        const renderedHeight = normalizePositiveInteger(entry?.renderedHeight || entry?.rendered_height, null);
        const dominantHex = normalizeHexColor(entry?.dominantHex || entry?.dominant_hex) || palette[0]?.hex || null;
        const contrastHex = normalizeHexColor(entry?.contrastHex || entry?.contrast_hex) || deriveContrastHex(palette, dominantHex);
        const originType = normalizeMetadataText(entry?.originType || entry?.origin_type, "local", 40);
        const existing = await database.rowQueryAsync("SELECT image_id, preview_duplicate_key, origin_type FROM images WHERE source_region_key = ?", [sourceRegionKey]);
        if (existing && String(existing.image_id || "") !== imageID) {
          throw new Error("Storage failed: source region identity collision.");
        }
        if (existing && String(existing.origin_type || "") === "original" && originType !== "original") continue;
        await database.queryAsync(`INSERT INTO images (
          image_id, image_blob, thumbnail_blob, title, year, doi, page_number, created_at,
          source_region_key, preview_duplicate_key, parent_item_key, pdf_attachment_key,
          zotero_open_pdf_uri, zotero_select_item_uri, zotero_select_pdf_uri,
          library_id, library_type, group_id, bbox_json, palette_json,
          image_category, color_family, style_tags_json, quality, detector,
          rendered_width, rendered_height, dominant_hex, contrast_hex,
          content_sha256, origin_type, source_match_status, imported_at, deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(image_id) DO UPDATE SET
          thumbnail_blob=NULL, title=excluded.title, year=excluded.year,
          doi=excluded.doi, page_number=excluded.page_number, created_at=excluded.created_at,
          preview_duplicate_key=excluded.preview_duplicate_key, parent_item_key=excluded.parent_item_key,
          pdf_attachment_key=excluded.pdf_attachment_key, zotero_open_pdf_uri=excluded.zotero_open_pdf_uri,
          zotero_select_item_uri=excluded.zotero_select_item_uri, zotero_select_pdf_uri=excluded.zotero_select_pdf_uri,
          library_id=excluded.library_id, library_type=excluded.library_type, group_id=excluded.group_id,
          bbox_json=excluded.bbox_json, palette_json=excluded.palette_json,
          image_category=excluded.image_category, color_family=excluded.color_family,
          style_tags_json=excluded.style_tags_json, quality=excluded.quality, detector=excluded.detector,
          rendered_width=excluded.rendered_width, rendered_height=excluded.rendered_height,
          dominant_hex=excluded.dominant_hex, contrast_hex=excluded.contrast_hex,
          content_sha256=excluded.content_sha256, origin_type='local', source_match_status='local', imported_at=NULL,
          deleted=0`, [
          imageID, imageBytes, null,
          getItemField(parentItem, "title"), getItemField(parentItem, "date"), getItemField(parentItem, "DOI"), pageNumber,
          createdAt, sourceRegionKey, getPreviewDuplicateKey(attachment, entry),
          normalizeMetadataText(parentItem?.key, "", 80), normalizeMetadataText(attachment?.key, "", 80),
          openPDFURI, parentURI, attachmentURI, attachment?.libraryID || null,
          Zotero.Libraries?.get?.(attachment?.libraryID)?.libraryType || "user",
          Zotero.Libraries?.get?.(attachment?.libraryID)?.groupID || null,
          JSON.stringify(normalizeBBoxNormalized(entry?.bboxNormalized)), JSON.stringify(palette),
          imageCategory, colorFamily, JSON.stringify(styleTags), quality, detector,
          renderedWidth, renderedHeight, dominantHex, contrastHex,
          contentSHA256 || null, originType, "local", null,
        ]);
        await database.queryAsync("DELETE FROM image_palette_swatches WHERE image_id = ?", [imageID]);
        for (const [index, swatch] of palette.entries()) {
          await database.queryAsync("INSERT INTO image_palette_swatches (image_id, hex, swatch_index, role) VALUES (?, ?, ?, ?)", [imageID, swatch.hex, index, swatch.role]);
        }
      }
    });
    await safeWriteSharedDatabaseLocator(resolveDefaultSharedDatabasePath());
    return { written: list.length };
  }

  function normalizeBridgeImageIDs(value) {
    let source = value;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch (_error) {
        source = [];
      }
    }
    if (!Array.isArray(source)) return [];
    const seen = new Set();
    const result = [];
    for (const item of source) {
      const imageID = normalizeMetadataText(item, "", 1000);
      if (!imageID || seen.has(imageID)) continue;
      seen.add(imageID);
      result.push(imageID);
      if (result.length >= SHARED_LIBRARY_PACKAGE_MAX_IMAGES) break;
    }
    return result;
  }

  function buildSharedLibraryPackageImage(row, imageBytes, contentSHA256) {
    const bytes = normalizeDatabaseImageBytes(imageBytes);
    const fileType = getDatabaseImageFileType(bytes);
    const sha256 = normalizeSHA256(contentSHA256);
    if (!bytes?.length || !fileType || !sha256) return null;
    return {
      shared_id: `sha256:${sha256}`,
      content_sha256: sha256,
      mime_type: fileType.mimeType,
      image_base64: bytesToBase64(bytes),
      title: normalizeMetadataText(row?.title, "未命名论文图像", 300),
      year: normalizeMetadataText(row?.year, "", 40),
      doi: normalizeMetadataText(row?.doi, "", 240),
      page_number: normalizePageNumber(row?.page_number, 1),
      source_created_at: normalizeMetadataText(row?.created_at, "", 80),
      bbox: normalizeBBoxNormalized(parseSharedJSON(row?.bbox_json, [0, 0, 1, 1])),
      palette: normalizePalette(parseSharedJSON(row?.palette_json, [])),
      image_category: normalizeImageCategoryKey(row?.image_category || "figure"),
      color_family: normalizeColorFamily(row?.color_family || deriveColorFamilyFromPalette(parseSharedJSON(row?.palette_json, []))),
      style_tags: normalizeStyleTags(parseSharedJSON(row?.style_tags_json, [])),
      quality: normalizeQualityKey(row?.quality),
      detector: normalizeMetadataText(row?.detector, "shared", 80),
      rendered_width: normalizePositiveInteger(row?.rendered_width, null),
      rendered_height: normalizePositiveInteger(row?.rendered_height, null),
      dominant_hex: normalizeHexColor(row?.dominant_hex) || null,
      contrast_hex: normalizeHexColor(row?.contrast_hex) || null,
    };
  }

  function buildSharedLibraryPackagePayload(images, exportedAt = null) {
    const list = (Array.isArray(images) ? images : []).filter(Boolean);
    return {
      format: SHARED_LIBRARY_PACKAGE_FORMAT,
      schema_version: 1,
      producer: "zotero-pdf-image-saver",
      producer_version: normalizeMetadataText(config?.version, "unknown", 40),
      exported_at: exportedAt || new Date().toISOString(),
      includes_pdf: false,
      image_count: list.length,
      images: list,
    };
  }

  async function readBoundedByteStream(stream, maxBytes) {
    const reader = stream?.getReader?.();
    if (!reader) throw new Error("Storage failed: package stream unavailable.");
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        const chunk = normalizeDatabaseImageBytes(result.value);
        if (!chunk) throw new Error("Storage failed: package stream invalid.");
        total += chunk.length;
        if (total > maxBytes) throw new Error("Storage failed: expanded image package exceeds file cap.");
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock?.(); } catch (_error) {}
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }

  async function encodeSharedLibraryPackage(payload) {
    const TextEncoderClass = getRuntimeGlobalValue("TextEncoder");
    if (typeof TextEncoderClass !== "function") {
      throw new Error("Storage failed: package text encoder unavailable.");
    }
    const rawBytes = new TextEncoderClass().encode(JSON.stringify(payload));
    const CompressionStreamClass = getRuntimeGlobalValue("CompressionStream");
    const BlobClass = getRuntimeGlobalValue("Blob");
    const ResponseClass = getRuntimeGlobalValue("Response");
    if (typeof CompressionStreamClass !== "function" || typeof BlobClass !== "function" || typeof ResponseClass !== "function") {
      return rawBytes;
    }
    const compressed = new BlobClass([rawBytes]).stream().pipeThrough(new CompressionStreamClass("gzip"));
    return new Uint8Array(await new ResponseClass(compressed).arrayBuffer());
  }

  async function decodeSharedLibraryPackage(value) {
    let bytes = normalizeDatabaseImageBytes(value);
    if (!bytes?.length) throw new Error("Storage failed: image package is empty.");
    if (bytes.length > SHARED_LIBRARY_PACKAGE_MAX_FILE_BYTES) throw new Error("Storage failed: image package exceeds file cap.");
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      const DecompressionStreamClass = getRuntimeGlobalValue("DecompressionStream");
      const BlobClass = getRuntimeGlobalValue("Blob");
      if (typeof DecompressionStreamClass !== "function" || typeof BlobClass !== "function") {
        throw new Error("Storage failed: gzip package runtime unavailable.");
      }
      const decompressed = new BlobClass([bytes]).stream().pipeThrough(new DecompressionStreamClass("gzip"));
      bytes = await readBoundedByteStream(decompressed, SHARED_LIBRARY_PACKAGE_MAX_FILE_BYTES);
    }
    const TextDecoderClass = getRuntimeGlobalValue("TextDecoder");
    if (typeof TextDecoderClass !== "function") {
      throw new Error("Storage failed: package text decoder unavailable.");
    }
    let payload = null;
    try {
      payload = JSON.parse(new TextDecoderClass("utf-8", { fatal: true }).decode(bytes));
    } catch (_error) {
      throw new Error("Storage failed: image package JSON invalid.");
    }
    if (
      !payload
      || payload.format !== SHARED_LIBRARY_PACKAGE_FORMAT
      || payload.schema_version !== 1
      || payload.includes_pdf !== false
      || !Array.isArray(payload.images)
      || payload.images.length > SHARED_LIBRARY_PACKAGE_MAX_IMAGES
    ) {
      throw new Error("Storage failed: image package format invalid.");
    }
    return payload;
  }

  async function chooseSharedLibraryPackagePath(mode) {
    let chromeUtils = null;
    try { if (typeof ChromeUtils !== "undefined") chromeUtils = ChromeUtils; } catch (_error) {}
    if (!chromeUtils) {
      try { chromeUtils = Components.utils?.getGlobalForObject?.(Zotero)?.ChromeUtils || null; } catch (_error) {}
    }
    if (typeof chromeUtils?.importESModule !== "function") {
      throw new Error("Storage failed: native file picker unavailable.");
    }
    const FilePicker = chromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs")?.FilePicker;
    if (typeof FilePicker !== "function") {
      throw new Error("Storage failed: native file picker unavailable.");
    }
    const picker = new FilePicker();
    const save = mode === "save";
    picker.init(
      Zotero.getMainWindow?.() || null,
      save ? "分享论文图片" : "导入论文图片包",
      save ? picker.modeSave : picker.modeOpen,
    );
    picker.appendFilter("论文图片包 (*.pislib)", "*.pislib");
    picker.appendFilters(picker.filterAll);
    if (save) {
      const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
      picker.defaultExtension = SHARED_LIBRARY_PACKAGE_EXTENSION.slice(1);
      picker.defaultString = `paper-image-library-${stamp}${SHARED_LIBRARY_PACKAGE_EXTENSION}`;
    }
    const result = await picker.show();
    if (result !== picker.returnOK && result !== picker.returnReplace) return "";
    let filePath = normalizeMetadataText(picker.file, "", 4000);
    if (save && filePath && !filePath.toLowerCase().endsWith(SHARED_LIBRARY_PACKAGE_EXTENSION)) {
      filePath += SHARED_LIBRARY_PACKAGE_EXTENSION;
    }
    return filePath;
  }

  async function exportSharedLibraryPackage(imageIDs, targetPath = null) {
    const ids = normalizeBridgeImageIDs(imageIDs);
    if (!ids.length) throw new Error("Storage failed: no images selected.");
    const filePath = targetPath == null ? await chooseSharedLibraryPackagePath("save") : normalizeMetadataText(targetPath, "", 4000);
    if (!filePath) return { cancelled: true, exported: 0, bytes: 0, filePath: "" };
    const database = await ensureSharedLibrarySchema();
    const images = [];
    let totalImageBytes = 0;
    for (const imageID of ids) {
      const row = await database.rowQueryAsync(`SELECT
        image_id, image_blob, title, year, doi, page_number, created_at, bbox_json, palette_json,
        image_category, color_family, style_tags_json, quality, detector, rendered_width,
        rendered_height, dominant_hex, contrast_hex, content_sha256
        FROM images WHERE image_id = ? AND deleted = 0 LIMIT 1`, [imageID]);
      const imageBytes = normalizeDatabaseImageBytes(row?.image_blob);
      if (!imageBytes?.length || imageBytes.length > GLOBAL_LIBRARY_MAX_IMAGE_BYTES) continue;
      totalImageBytes += imageBytes.length;
      if (totalImageBytes > SHARED_LIBRARY_PACKAGE_MAX_BYTES) {
        throw new Error("Storage failed: selected images exceed package byte cap.");
      }
      const contentSHA256 = normalizeSHA256(row?.content_sha256) || await computeSHA256Hex(imageBytes);
      const image = buildSharedLibraryPackageImage(row, imageBytes, contentSHA256);
      if (!image?.image_base64) continue;
      images.push(image);
      if (contentSHA256 && !normalizeSHA256(row?.content_sha256)) {
        await database.queryAsync("UPDATE images SET content_sha256 = ? WHERE image_id = ?", [contentSHA256, imageID]);
      }
    }
    if (!images.length) throw new Error("Storage failed: selected images are unavailable.");
    const packageBytes = await encodeSharedLibraryPackage(buildSharedLibraryPackagePayload(images));
    if (packageBytes.length > SHARED_LIBRARY_PACKAGE_MAX_FILE_BYTES) {
      throw new Error("Storage failed: compressed image package exceeds file cap.");
    }
    if (typeof IOUtils === "undefined" || typeof IOUtils.write !== "function") {
      throw new Error("Storage failed: package writer unavailable.");
    }
    await IOUtils.write(filePath, packageBytes);
    return { cancelled: false, exported: images.length, bytes: packageBytes.length, filePath };
  }

  function normalizeCitationDOI(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^doi:\s*/i, "")
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/[\s.]+$/g, "");
  }

  function normalizeCitationTitle(value) {
    let text = String(value || "").trim().toLowerCase();
    try { text = text.normalize("NFKC"); } catch (_error) {}
    return text.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }

  function normalizeCitationYear(value) {
    return String(value || "").match(/(?:18|19|20|21)\d{2}/)?.[0] || "";
  }

  function isImportCitationItem(item) {
    if (!item || item.deleted) return false;
    try {
      if (typeof item.isRegularItem === "function") return !!item.isRegularItem();
      if (item.isAttachment?.() || item.isNote?.() || item.isAnnotation?.()) return false;
    } catch (_error) {
      return false;
    }
    return !!getItemField(item, "title");
  }

  function buildLocalCitationIndex(items) {
    const byDOI = new Map();
    const byTitleYear = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      if (!isImportCitationItem(item)) continue;
      const doi = normalizeCitationDOI(getItemField(item, "DOI"));
      const title = normalizeCitationTitle(getItemField(item, "title"));
      const year = normalizeCitationYear(getItemField(item, "date") || getItemField(item, "year"));
      if (doi) {
        if (!byDOI.has(doi)) byDOI.set(doi, []);
        byDOI.get(doi).push(item);
      }
      if (title && year) {
        const key = `${title}\n${year}`;
        if (!byTitleYear.has(key)) byTitleYear.set(key, []);
        byTitleYear.get(key).push(item);
      }
    }
    return { byDOI, byTitleYear };
  }

  function getLocalCitationItems() {
    if (typeof Zotero.Items?.getAll !== "function") return [];
    const libraryIDs = new Set([normalizePositiveInteger(Zotero.Libraries?.userLibraryID, 1)]);
    try {
      for (const library of Zotero.Libraries?.getAll?.() || []) {
        const libraryID = normalizePositiveInteger(library?.libraryID ?? library?.id, null);
        if (libraryID) libraryIDs.add(libraryID);
      }
    } catch (error) {
      safeLogError(error);
    }
    const items = [];
    const seen = new Set();
    for (const libraryID of libraryIDs) {
      try {
        for (const item of Zotero.Items.getAll(libraryID) || []) {
          const identity = normalizeMetadataText(item?.id ?? `${libraryID}:${item?.key}`, "", 120);
          if (!identity || seen.has(identity)) continue;
          seen.add(identity);
          items.push(item);
        }
      } catch (error) {
        safeLogError(error);
      }
    }
    return items;
  }

  function getCitationPDFAttachment(item) {
    if (!item || typeof item.getAttachments !== "function") return null;
    let attachmentIDs = [];
    try { attachmentIDs = item.getAttachments() || []; } catch (error) { safeLogError(error); }
    for (const attachmentID of Array.isArray(attachmentIDs) ? attachmentIDs : []) {
      const attachment = Zotero.Items?.get?.(attachmentID);
      if (!attachment) continue;
      try {
        if (attachment.isPDFAttachment?.() || normalizeImageContentType(attachment.attachmentContentType) === "application/pdf") {
          return attachment;
        }
      } catch (_error) {}
    }
    return null;
  }

  function matchSharedCitation(record, citationIndex) {
    const doi = normalizeCitationDOI(record?.doi);
    if (doi) {
      const candidates = citationIndex.byDOI.get(doi) || [];
      if (candidates.length) return { item: candidates.find((item) => getCitationPDFAttachment(item)) || candidates[0], status: "doi" };
    }
    const title = normalizeCitationTitle(record?.title);
    const year = normalizeCitationYear(record?.year);
    const candidates = title && year ? (citationIndex.byTitleYear.get(`${title}\n${year}`) || []) : [];
    if (candidates.length === 1) return { item: candidates[0], status: "title-year" };
    return { item: null, status: "unmatched" };
  }

  function buildImportedSource(record, citationIndex) {
    const match = matchSharedCitation(record, citationIndex);
    const parentItem = match.item;
    const attachment = getCitationPDFAttachment(parentItem);
    return {
      matchStatus: match.status,
      parentItemKey: normalizeMetadataText(parentItem?.key, "", 80),
      pdfAttachmentKey: normalizeMetadataText(attachment?.key, "", 80),
      openPDFURI: attachment ? buildOpenPDFURI(attachment, normalizePageNumber(record?.page_number, 1)) : "",
      selectItemURI: buildZoteroSelectURI(parentItem),
      selectPDFURI: buildZoteroSelectURI(attachment),
      libraryID: attachment?.libraryID || parentItem?.libraryID || null,
      libraryType: attachment || parentItem ? (Zotero.Libraries?.get?.(attachment?.libraryID || parentItem?.libraryID)?.libraryType || "user") : null,
      groupID: attachment || parentItem ? (Zotero.Libraries?.get?.(attachment?.libraryID || parentItem?.libraryID)?.groupID || null) : null,
    };
  }

  async function importSharedLibraryPackage(sourcePath = null) {
    const filePath = sourcePath == null ? await chooseSharedLibraryPackagePath("open") : normalizeMetadataText(sourcePath, "", 4000);
    if (!filePath) return { cancelled: true, imported: 0, matched: 0, unmatched: 0, skipped: 0, filePath: "" };
    if (typeof IOUtils === "undefined" || typeof IOUtils.read !== "function") {
      throw new Error("Storage failed: package reader unavailable.");
    }
    const stat = await IOUtils.stat(filePath);
    if (!stat || stat.size <= 0 || stat.size > SHARED_LIBRARY_PACKAGE_MAX_FILE_BYTES) {
      throw new Error("Storage failed: image package file size invalid.");
    }
    const payload = await decodeSharedLibraryPackage(await IOUtils.read(filePath));
    const database = await ensureSharedLibrarySchema();
    const citationIndex = buildLocalCitationIndex(getLocalCitationItems());
    const prepared = [];
    const packageHashes = new Set();
    let totalImageBytes = 0;
    let skipped = 0;
    for (const record of payload.images) {
      const imageBytes = base64ToBytes(record?.image_base64);
      const fileType = getDatabaseImageFileType(imageBytes);
      const declaredSHA256 = normalizeSHA256(record?.content_sha256);
      const declaredMimeType = normalizeMetadataText(record?.mime_type, "", 80).toLowerCase();
      if (!imageBytes?.length || imageBytes.length > GLOBAL_LIBRARY_MAX_IMAGE_BYTES || !fileType || !declaredSHA256 || declaredMimeType !== fileType.mimeType) {
        skipped += 1;
        continue;
      }
      totalImageBytes += imageBytes.length;
      if (totalImageBytes > SHARED_LIBRARY_PACKAGE_MAX_BYTES) {
        throw new Error("Storage failed: image package exceeds byte cap.");
      }
      const actualSHA256 = await computeSHA256Hex(imageBytes);
      if (!actualSHA256 || actualSHA256 !== declaredSHA256 || packageHashes.has(actualSHA256)) {
        skipped += 1;
        continue;
      }
      packageHashes.add(actualSHA256);
      const imageID = `shared-image:v1:${actualSHA256}`;
      const existing = await database.rowQueryAsync(
        "SELECT image_id FROM images WHERE image_id = ? OR content_sha256 = ? LIMIT 1",
        [imageID, actualSHA256],
      );
      if (existing) {
        skipped += 1;
        continue;
      }
      const source = buildImportedSource(record, citationIndex);
      const palette = normalizePalette(record?.palette);
      prepared.push({
        imageID,
        imageBytes,
        title: normalizeMetadataText(record?.title, "未命名论文图像", 300),
        year: normalizeMetadataText(record?.year, "", 40),
        doi: normalizeMetadataText(record?.doi, "", 240),
        pageNumber: normalizePageNumber(record?.page_number, 1),
        createdAt: normalizeMetadataText(record?.source_created_at, new Date().toISOString(), 80),
        bbox: normalizeBBoxNormalized(record?.bbox),
        palette,
        category: normalizeImageCategoryKey(record?.image_category || "figure"),
        colorFamily: normalizeColorFamily(record?.color_family || deriveColorFamilyFromPalette(palette)),
        styleTags: normalizeStyleTags(record?.style_tags),
        quality: normalizeQualityKey(record?.quality),
        detector: normalizeMetadataText(record?.detector, "shared", 80),
        renderedWidth: normalizePositiveInteger(record?.rendered_width, null),
        renderedHeight: normalizePositiveInteger(record?.rendered_height, null),
        dominantHex: normalizeHexColor(record?.dominant_hex) || palette[0]?.hex || null,
        contrastHex: normalizeHexColor(record?.contrast_hex) || null,
        contentSHA256: actualSHA256,
        source,
      });
    }
    const importedAt = new Date().toISOString();
    await database.executeTransaction(async () => {
      for (const record of prepared) {
        await database.queryAsync(`INSERT INTO images (
          image_id, image_blob, thumbnail_blob, title, year, doi, page_number, created_at,
          source_region_key, preview_duplicate_key, parent_item_key, pdf_attachment_key,
          zotero_open_pdf_uri, zotero_select_item_uri, zotero_select_pdf_uri,
          library_id, library_type, group_id, bbox_json, palette_json,
          image_category, color_family, style_tags_json, quality, detector,
          rendered_width, rendered_height, dominant_hex, contrast_hex,
          content_sha256, origin_type, source_match_status, imported_at, deleted
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shared', ?, ?, 0)`, [
          record.imageID, record.imageBytes, record.title, record.year, record.doi, record.pageNumber,
          record.createdAt, record.imageID, `shared-content:v1:${record.contentSHA256}`,
          record.source.parentItemKey || null, record.source.pdfAttachmentKey || null,
          record.source.openPDFURI || null, record.source.selectItemURI || null, record.source.selectPDFURI || null,
          record.source.libraryID, record.source.libraryType, record.source.groupID,
          JSON.stringify(record.bbox), JSON.stringify(record.palette), record.category, record.colorFamily,
          JSON.stringify(record.styleTags), record.quality, record.detector, record.renderedWidth,
          record.renderedHeight, record.dominantHex, record.contrastHex, record.contentSHA256,
          record.source.matchStatus, importedAt,
        ]);
        for (const [index, swatch] of record.palette.entries()) {
          await database.queryAsync(
            "INSERT INTO image_palette_swatches (image_id, hex, swatch_index, role) VALUES (?, ?, ?, ?)",
            [record.imageID, swatch.hex, index, swatch.role],
          );
        }
      }
    });
    await safeWriteSharedDatabaseLocator(resolveDefaultSharedDatabasePath());
    const matched = prepared.filter((record) => record.source.matchStatus !== "unmatched").length;
    return {
      cancelled: false,
      imported: prepared.length,
      matched,
      unmatched: prepared.length - matched,
      skipped,
      filePath,
    };
  }

  async function deleteSharedLibraryImages(imageIDs) {
    const ids = normalizeBridgeImageIDs(imageIDs);
    if (!ids.length) throw new Error("Storage failed: no images selected.");
    const database = await ensureSharedLibrarySchema();
    let deleted = 0;
    await database.executeTransaction(async () => {
      for (const imageID of ids) {
        const row = await database.rowQueryAsync(
          "SELECT image_id FROM images WHERE image_id = ? AND deleted = 0 LIMIT 1",
          [imageID],
        );
        if (!row) continue;
        await database.queryAsync("UPDATE images SET deleted = 1 WHERE image_id = ? AND deleted = 0", [imageID]);
        deleted += 1;
      }
    });
    return { deleted };
  }

  function createBridgeToken() {
    return `${Date.now().toString(36)}${Zotero.Utilities?.randomString?.(24) || Math.random().toString(36).slice(2)}`;
  }

  async function safeWriteBridgeState(key, value, options = {}) {
    try {
      const allowOpen = options.allowOpen !== false;
      const database = sharedDatabaseConnection || (allowOpen ? await ensureSharedLibrarySchema() : null);
      if (!database) {
        return false;
      }
      await database.queryAsync("INSERT INTO bridge_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, String(value ?? "")]);
      return true;
    } catch (error) {
      safeLogError(error);
      return false;
    }
  }

  function isBridgeEndpointRegistered() {
    return !!(bridgeEndpointHandler && Zotero.Server?.Endpoints?.[BRIDGE_ENDPOINT] === bridgeEndpointHandler);
  }

  async function enableSharedLibraryBridge() {
    if (!Zotero.Server?.Endpoints) {
      // bridge_state endpoint must publish the frozen localhost URL.
      await safeWriteBridgeState("token", "");
      await safeWriteBridgeState("endpoint", BRIDGE_URL);
      await safeWriteBridgeState("status", "unregistered");
      return false;
    }
    if (!bridgeEndpointHandler) {
      bridgeEndpointHandler = class PdfImageSaverBridgeEndpoint {
        constructor() {
          this.supportedMethods = ["POST"];
          this.supportedDataTypes = ["application/x-www-form-urlencoded", "application/json"];
          this.allowRequestsFromUnsafeWebContent = true;
        }

        async init(request) {
          return handleBridgeRequest(request);
        }
      };
    }
    Zotero.Server.Endpoints[BRIDGE_ENDPOINT] = bridgeEndpointHandler;
    bridgeToken = createBridgeToken();
    await safeWriteBridgeState("token", bridgeToken);
    await safeWriteBridgeState("endpoint", BRIDGE_URL);
    await safeWriteBridgeState("status", isBridgeEndpointRegistered() ? "ready" : "unregistered");
    return isBridgeEndpointRegistered();
  }

  async function disableSharedLibraryBridge() {
    if (isBridgeEndpointRegistered()) {
      delete Zotero.Server.Endpoints[BRIDGE_ENDPOINT];
    }
    bridgeToken = "";
    // Shutdown must never reopen SQLite after the runtime has released it.
    await safeWriteBridgeState("token", "", { allowOpen: false });
    await safeWriteBridgeState("endpoint", BRIDGE_URL, { allowOpen: false });
    await safeWriteBridgeState("status", "shutdown", { allowOpen: false });
  }

  function parseBridgeRequest(request) {
    const source = request && typeof request === "object" ? request : {};
    const fields = source.data && typeof source.data === "object" ? source.data : source;
    const headers = source.headers && typeof source.headers === "object" ? source.headers : {};
    const token = normalizeMetadataText(fields.token, "", 160) || normalizeMetadataText(headers["X-Rough-Ppt-Token"] || headers["x-rough-ppt-token"], "", 160);
    return {
      token,
      command: normalizeMetadataText(fields.command, "", 80),
      imageID: normalizeMetadataText(fields.image_id, "", 1000),
      imageIDs: normalizeBridgeImageIDs(fields.image_ids),
      pdfAttachmentKey: normalizeItemKey(fields.pdf_attachment_key, ""),
    };
  }

  async function getSharedImageTrace(imageID) {
    const database = await ensureSharedLibrarySchema();
    return database.rowQueryAsync(`SELECT image_id, preview_duplicate_key, parent_item_key, pdf_attachment_key,
      page_number, source_region_key, zotero_open_pdf_uri, zotero_select_item_uri, zotero_select_pdf_uri
      FROM images WHERE image_id = ? AND deleted = 0`, [imageID]);
  }

  function isAllowedBridgeZoteroURI(uri) {
    const value = String(uri || "");
    return /^zotero:\/\/open-pdf\/(?:library|groups\/\d+)\/items\/[A-Z0-9]{8}(?:\?page=\d+)?$/i.test(value)
      || /^zotero:\/\/select\/(?:library|groups\/\d+)\/items\/[A-Z0-9]{8}$/i.test(value);
  }

  function buildBridgeJSONResponse(status, payload) {
    return [status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    }, JSON.stringify(payload)];
  }

  async function handleBridgeRequest(request) {
    if (!isBridgeEndpointRegistered()) {
      // status: 503 when the frozen endpoint is unavailable.
      return buildBridgeJSONResponse(503, { ok: false, registered: false, error: "Bridge endpoint not registered" });
    }
    const parsed = parseBridgeRequest(request);
    const command = parsed.command === "getStatus" ? "status" : parsed.command;
    if (!BRIDGE_STATUS_COMMANDS.includes(parsed.command) && !BRIDGE_PROVENANCE_COMMANDS.includes(command) && !BRIDGE_LIBRARY_COMMANDS.includes(command)) {
      return buildBridgeJSONResponse(400, { ok: false, registered: true, error: "Bridge command invalid" });
    }
    if (!bridgeToken || parsed.token !== bridgeToken) {
      return buildBridgeJSONResponse(403, { ok: false, registered: true, error: "Bridge token invalid" });
    }
    if (command === "status") {
      return buildBridgeJSONResponse(200, { ok: true, registered: isBridgeEndpointRegistered(), endpoint: BRIDGE_URL, path: BRIDGE_ENDPOINT, url: BRIDGE_URL });
    }
    if (BRIDGE_LIBRARY_COMMANDS.includes(command)) {
      try {
        if (command === "refreshLibrary") {
          const result = await prepareGlobalImageLibraryView({ pdfAttachmentKey: parsed.pdfAttachmentKey });
          return buildBridgeJSONResponse(200, {
            ok: true,
            registered: true,
            imageCount: result.imageCount,
            skippedCount: result.skippedCount,
            totalBytes: result.totalBytes,
          });
        }
        if (command === "deleteImages") {
          const result = await deleteSharedLibraryImages(parsed.imageIDs);
          if (result.deleted) await prepareGlobalImageLibraryView();
          return buildBridgeJSONResponse(200, { ok: true, registered: true, deleted: result.deleted });
        }
        if (command === "exportImages") {
          const result = await exportSharedLibraryPackage(parsed.imageIDs);
          return buildBridgeJSONResponse(200, { ok: true, registered: true, cancelled: result.cancelled, exported: result.exported, bytes: result.bytes });
        }
        const result = await importSharedLibraryPackage();
        if (result.imported) await prepareGlobalImageLibraryView();
        return buildBridgeJSONResponse(200, {
          ok: true,
          registered: true,
          cancelled: result.cancelled,
          imported: result.imported,
          matched: result.matched,
          unmatched: result.unmatched,
          skipped: result.skipped,
        });
      } catch (error) {
        safeLogError(error);
        return buildBridgeJSONResponse(500, { ok: false, registered: true, error: formatUserFacingError(error) });
      }
    }
    const trace = await getSharedImageTrace(parsed.imageID);
    if (!trace) {
      return buildBridgeJSONResponse(404, { ok: false, registered: true, error: "Image not found" });
    }
    const uri = command === "openPdfByImageId"
      ? trace.zotero_open_pdf_uri
      : command === "selectParentItemByImageId"
        ? trace.zotero_select_item_uri
        : trace.zotero_select_pdf_uri;
    const normalized = { preview_duplicate_key: trace.preview_duplicate_key };
    if (!isAllowedBridgeZoteroURI(uri)) {
      return buildBridgeJSONResponse(400, { ok: false, registered: true, error: "Requested Zotero URI invalid", preview_duplicate_key: normalized.preview_duplicate_key });
    }
    try {
      Zotero.launchURL(uri);
      return buildBridgeJSONResponse(200, { ok: true, registered: true, preview_duplicate_key: normalized.preview_duplicate_key });
    } catch (error) {
      return buildBridgeJSONResponse(500, { ok: false, registered: true, error: getErrorMessage(error), preview_duplicate_key: trace.preview_duplicate_key });
    }
  }

  function buildFilterChipHTML(filter, value, textValue, count, description, pressed = false) {
    const imageCount = normalizeNonNegativeInteger(count, 0);
    const countLabel = `${imageCount} 张图片`;
    const actionLabel = value === "all" ? `显示${description}` : `筛选${description}`;
    return `<button type="button" class="filter-chip" data-filter="${escapeHTML(filter)}" data-value="${escapeHTML(value)}" aria-pressed="${pressed ? "true" : "false"}" aria-label="${escapeHTML(`${actionLabel}；${countLabel}`)}" title="${escapeHTML(`${actionLabel}；${countLabel}`)}">${escapeHTML(textValue)}</button>`;
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
    return `<div class="palette-chips" title="${escapeHTML(formatPaletteLabel(swatches))}">${swatches.map((swatch) => `<button type="button" class="palette-chip" style="background:${escapeHTML(swatch.hex)}" title="${escapeHTML(swatch.hex)}" data-copy="${escapeHTML(swatch.hex)}" aria-label="复制 ${escapeHTML(swatch.hex)}"></button>`).join("")}</div>`;
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
    if (category === "metric_curve") {
      drawingHints.push("plot", "axes", "metrics", "curve");
    } else if (category === "heatmap") {
      drawingHints.push("matrix", "color-scale", "heatmap");
    } else if (category === "bar_chart") {
      drawingHints.push("plot", "axes", "bars");
    } else if (category === "distribution") {
      drawingHints.push("plot", "distribution", "points");
    } else if (category === "qualitative") {
      drawingHints.push("result-panels", "visual-comparison");
    } else if (category === "architecture") {
      drawingHints.push("network", "blocks", "connections");
    } else if (category === "pipeline") {
      drawingHints.push("flow", "steps", "boxes");
    } else if (category === "chart") {
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
    return INSERT_SIZE_LABELS[key] || "未知";
  }

  function formatInsertHintLabel(value) {
    const hint = normalizeInsertHint(value);
    if (hint.size === "unknown") {
      return "未知";
    }
    return `${INSERT_SIZE_LABELS[hint.size]}；${ANCHOR_LABELS[hint.anchor] || "居中"}；宽 ${hint.width_pct}% × 高 ${hint.height_pct}%`;
  }

  function formatInsertHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const hint = normalizeInsertHint(entry?.insertHint || entry?.insert_hint || deriveInsertHint(entry?.slideSlot, entry?.layoutHint, entry?.aspectRatio, entry?.roleHint));
      counts.set(hint.size, (counts.get(hint.size) || 0) + 1);
    }
    if (!counts.size) {
      return "插入尺寸：无";
    }
    return `插入尺寸：${[...counts.entries()].map(([key, count]) => `${INSERT_SIZE_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
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
    if (role === "result" || RESULT_IMAGE_CATEGORIES.has(category)) {
      tone = "result";
    } else if (role === "method" || METHOD_IMAGE_CATEGORIES.has(category)) {
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
      result: `${catLabel}关键结果`,
      method: `${catLabel}方法流程`,
      compare: `${catLabel}对比`,
      context: `${catLabel}背景说明`,
      unknown: `${catLabel}图片`,
    };
    const noteBits = [
      `第 ${page} 页`,
      role !== "unknown" ? ROLE_HINT_LABELS[role] : null,
      slot !== "unknown" ? SLIDE_SLOT_LABELS[slot] : null,
      layout !== "unknown" ? LAYOUT_HINT_LABELS[layout] : null,
      insert.size !== "unknown" ? `${INSERT_SIZE_LABELS[insert.size]}尺寸` : null,
      family !== "unknown" ? COLOR_FAMILY_LABELS[family] : null,
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
    const title = String(source.title || "").trim().replace(/\s+/g, " ").slice(0, 80) || (tone === "unknown" ? "图片说明" : `${CAPTION_TONE_LABELS[tone]}图片说明`);
    const note = String(source.note || "").trim().replace(/\s+/g, " ").slice(0, 120);
    return { tone, title, note };
  }

  function getCaptionToneMark(value) {
    const tone = typeof value === "string" ? value : value?.tone;
    const key = String(tone || "").trim().toLowerCase();
    return CAPTION_TONE_LABELS[key] || "未知";
  }

  function formatCaptionHintLabel(value) {
    const hint = normalizeCaptionHint(value);
    if (hint.tone === "unknown") {
      return "未知";
    }
    return `${CAPTION_TONE_LABELS[hint.tone]}；${hint.title}`;
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
      return "图注语气：无";
    }
    return `图注语气：${[...counts.entries()].map(([key, count]) => `${CAPTION_TONE_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
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
    return STORY_BEAT_LABELS[key] || "未知";
  }

  function formatStoryHintLabel(entry) {
    const safe = entry && typeof entry === "object" ? entry : {};
    const order = normalizeStoryOrder(safe.storyOrder || safe.story_order || 1);
    const beat = normalizeStoryBeat(safe.storyBeat || safe.story_beat || "unknown");
    return `第 ${order} 张；${STORY_BEAT_LABELS[beat] || "未知"}`;
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
      return "叙事阶段：无";
    }
    return `叙事阶段：${[...counts.entries()].map(([key, count]) => `${STORY_BEAT_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
  }

  function getColorFamilyMark(value) {
    const family = normalizeColorFamily(value);
    return COLOR_FAMILY_LABELS[family] || "未知";
  }

  function deriveRoleHint(imageCategory, slideSlot, layoutHint) {
    const category = normalizeImageCategoryKey(imageCategory);
    const slot = normalizeSlideSlot(slideSlot);
    const layout = normalizeLayoutHint(layoutHint);
    if (RESULT_IMAGE_CATEGORIES.has(category)) {
      return slot === "side" ? "compare" : "result";
    }
    if (METHOD_IMAGE_CATEGORIES.has(category)) {
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
    return ROLE_HINT_LABELS[key] || "未知";
  }

  function formatRoleHintLabel(value) {
    const key = normalizeRoleHint(value);
    return ROLE_HINT_LABELS[key] || "未知";
  }

  function formatRoleHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeRoleHint(entry?.roleHint || entry?.role_hint || deriveRoleHint(entry?.imageCategory, entry?.slideSlot, entry?.layoutHint));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "用途：无";
    }
    return `用途：${[...counts.entries()].map(([key, count]) => `${ROLE_HINT_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
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
    const dominant = normalizeHexColor(dominantHex) || "无";
    const contrast = normalizeHexColor(contrastHex) || "无";
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
    return SLIDE_SLOT_LABELS[key] || "未知";
  }

  function formatSlideSlotLabel(value) {
    const key = normalizeSlideSlot(value);
    return SLIDE_SLOT_LABELS[key] || "未知";
  }

  function formatSlideSlotSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeSlideSlot(entry?.slideSlot || entry?.slide_slot || deriveSlideSlot(entry?.layoutHint, entry?.imageCategory, entry?.aspectRatio));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "位置：无";
    }
    return `位置：${[...counts.entries()].map(([key, count]) => `${SLIDE_SLOT_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
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
    return ratio === null ? "未知" : ratio.toFixed(2);
  }

  function deriveLayoutHint(aspectRatio, imageCategory) {
    const ratio = normalizeAspectRatio(aspectRatio);
    if (ratio === null) {
      const category = normalizeImageCategoryKey(imageCategory);
      if (category === "table") return "wide";
      if (category === "equation" || category === "heatmap") return "square";
      if (RESULT_IMAGE_CATEGORIES.has(category) || METHOD_IMAGE_CATEGORIES.has(category)) return "wide";
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
    return LAYOUT_HINT_LABELS[key] || "未知";
  }

  function formatLayoutHintLabel(value, aspectRatio = null) {
    const key = normalizeLayoutHint(value);
    const ar = formatAspectRatioLabel(aspectRatio);
    if (key === "unknown") {
      return "未知";
    }
    return `${LAYOUT_HINT_LABELS[key]}；宽高比 ${ar}`;
  }

  function formatLayoutHintSummary(entries) {
    const counts = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = normalizeLayoutHint(entry?.layoutHint || entry?.layout_hint || deriveLayoutHint(entry?.aspectRatio, entry?.imageCategory));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!counts.size) {
      return "布局：无";
    }
    return `布局：${[...counts.entries()].map(([key, count]) => `${LAYOUT_HINT_LABELS[key] || "未知"} ${count} 张`).join("、")}`;
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

  async function confirmPreviewBeforeSave(reader, preview, pageElement, options = {}) {
    const safeOptions = normalizeOptionsObject(options);
    const evidence = getAutoCategoryTextEvidence(pageElement, preview);
    const suggested = inferImageCategory({
      width: preview?.renderedWidth,
      height: preview?.renderedHeight,
      styleTags: preview?.styleTags,
      palette: preview?.palette,
      detector: preview?.detector,
      detectionArea: preview?.detectionArea,
      captionText: evidence.caption,
      referenceText: evidence.reference,
    });
    const requestedCategory = normalizeImageCategoryKey(safeOptions.requestedCategory || "auto");
    const initialCategory = requestedCategory === "auto" ? suggested : requestedCategory;
    const doc = getPreviewReviewDocument(reader);
    if (!doc) {
      const scope = normalizeScope(safeOptions.scope);
      const sourceLabel = scope === "page" ? "整页预览" : "框选图片";
      let ownerWindow = null;
      try {
        ownerWindow = Zotero.getMainWindow?.() || null;
      } catch (_error) {
        // A missing window is valid during reader teardown.
      }
      showFallbackAlert(
        ownerWindow,
        `无法显示${sourceLabel}预览，本次图片未保存。请重新打开 PDF 阅读器后重试。`,
      );
      invokeReaderWorkflowCallback(safeOptions.onReviewUnavailable);
      return null;
    }
    return showPreviewReviewDialog(doc, preview, {
      ...safeOptions,
      evidence,
      suggested,
      initialCategory,
    });
  }

  function getPreviewReviewDocument(reader) {
    const documents = [];
    const addDocument = (doc) => {
      try {
        if (
          doc
          && typeof doc.createElement === "function"
          && (doc.body || doc.documentElement)
          && !documents.includes(doc)
        ) {
          documents.push(doc);
        }
      } catch (_error) {
        // Inaccessible reader frames are skipped in favor of another reader view.
      }
    };
    const addWindowDocument = (win) => {
      try {
        addDocument(win?.document);
      } catch (_error) {
        // Cross-frame window access is optional.
      }
    };
    try {
      addDocument(getPDFViewerContextCandidate(reader)?.doc);
    } catch (_error) {
      // A restored reader may not expose PDFViewerApplication on its outer frame.
    }
    try {
      addWindowDocument(reader?._iframeWindow);
      addWindowDocument(reader?._iframe?.contentWindow);
    } catch (_error) {
      // Continue through restored reader views.
    }
    for (const view of [
      reader?._lastView,
      reader?._primaryView,
      reader?._internalReader?._lastView,
      reader?._internalReader?._primaryView,
    ]) {
      try {
        addWindowDocument(view?._iframeWindow);
        addWindowDocument(view?._iframe?.contentWindow);
      } catch (_error) {
        // Continue to the remaining views and main-window fallback.
      }
    }
    try {
      addDocument(Zotero.getMainWindow?.()?.document);
    } catch (_error) {
      // Missing main-window access is handled by the explicit no-preview failure.
    }
    return documents[0] || null;
  }

  function showPreviewReviewDialog(doc, preview, options = {}) {
    if (shuttingDown) {
      return Promise.resolve(null);
    }
    const safeOptions = normalizeOptionsObject(options);
    const existing = doc.getElementById?.("pdf-image-saver-preview-review-dialog");
    existing?.__pdfImageSaverReviewResolve?.();
    existing?.remove?.();
    ensureReaderStyles(doc);

    const scope = normalizeScope(safeOptions.scope);
    const isPage = scope === "page";
    const initialCategory = normalizeConfirmedImageCategory(
      safeOptions.initialCategory || preview?.imageCategory,
      safeOptions.suggested || preview?.imageCategory || "figure",
    );
    const initialRole = getPreviewReviewAutoRole(preview, initialCategory);
    const backdrop = doc.createElement("div");
    backdrop.id = "pdf-image-saver-preview-review-dialog";
    backdrop.className = "pdf-image-saver-preview-review-backdrop";
    backdrop.setAttribute?.("role", "dialog");
    backdrop.setAttribute?.("aria-modal", "true");
    backdrop.tabIndex = -1;
    const panel = doc.createElement("section");
    panel.className = "pdf-image-saver-preview-review-panel";
    const heading = doc.createElement("h2");
    heading.className = "pdf-image-saver-preview-review-title";
    heading.id = "pdf-image-saver-preview-review-title";
    heading.textContent = isPage ? "确认整页图片" : "确认框选图片";
    const instruction = doc.createElement("p");
    instruction.className = "pdf-image-saver-preview-review-instruction";
    instruction.id = "pdf-image-saver-preview-review-instruction";
    instruction.textContent = isPage
      ? "检查整页图像、分类和画质；确认后才会写入数据库。"
      : "检查图片范围、分类和画质；确认后才会写入数据库。";
    let currentPreview = preview;
    const image = doc.createElement("img");
    image.className = "pdf-image-saver-preview-review-image";
    image.src = String(currentPreview?.dataURL || "");
    image.alt = `${isPage ? "整页" : "框选图片"}，第 ${normalizePageNumber(currentPreview?.pageNumber, 1)} 页`;
    const metadata = doc.createElement("p");
    metadata.className = "pdf-image-saver-preview-review-meta";
    metadata.id = "pdf-image-saver-preview-review-meta";
    metadata.textContent = [
      `第 ${normalizePageNumber(currentPreview?.pageNumber, 1)} 页`,
      formatPreviewDetectorLabel(currentPreview?.detector),
      `${normalizePositiveInteger(currentPreview?.renderedWidth, 0)} × ${normalizePositiveInteger(currentPreview?.renderedHeight, 0)} 像素`,
      `保存画质：${getQualityLabelWithEstimate(currentPreview?.quality)}`,
      formatBytes(currentPreview?.byteCount),
    ].join(" · ");
    const evidence = normalizeOptionsObject(safeOptions.evidence);
    const suggestion = doc.createElement("p");
    suggestion.className = "pdf-image-saver-preview-review-suggestion";
    suggestion.id = "pdf-image-saver-preview-review-suggestion";
    suggestion.textContent = formatPreviewReviewCategorySuggestion({
      requestedCategory: safeOptions.requestedCategory,
      initialCategory,
      suggestedCategory: safeOptions.suggested,
    });
    const evidenceText = evidence.caption || evidence.reference;
    const evidenceNode = doc.createElement("p");
    evidenceNode.className = "pdf-image-saver-preview-review-evidence";
    evidenceNode.hidden = !evidenceText;
    evidenceNode.textContent = evidence.caption
      ? `图注依据：${truncateTextForPrompt(evidence.caption, 220)}`
      : `引用段落依据：${truncateTextForPrompt(evidence.reference, 220)}`;
    const fields = doc.createElement("div");
    fields.className = "pdf-image-saver-preview-review-fields";
    const categoryField = createPreviewReviewSelect(
      doc,
      "pdf-image-saver-review-category",
      "保存类别（必选）",
      Object.keys(IMAGE_CATEGORIES)
        .filter((key) => key !== "auto")
        .map((key) => ({
          value: key,
          label: getChineseImageCategoryLabel(key),
        })),
      initialCategory,
    );
    const qualityField = createPreviewReviewSelect(
      doc,
      "pdf-image-saver-review-quality",
      "保存画质（实际写入数据库）",
      Object.keys(QUALITY).map((key) => ({ value: key, label: getQualityLabelWithEstimate(key) })),
      normalizeQualityKey(currentPreview?.quality),
    );
    const roleOptions = getPreviewReviewRoleOptions(initialRole);
    const roleField = createPreviewReviewSelect(doc, "pdf-image-saver-review-role", "在 PPT 中的用途", roleOptions, "auto");
    fields.append(qualityField.element, categoryField.element, roleField.element);
    const fieldHelp = doc.createElement("p");
    fieldHelp.id = "pdf-image-saver-preview-review-field-help";
    fieldHelp.className = "pdf-image-saver-preview-review-field-help";
    fieldHelp.textContent = "类别用于图库筛选；PPT 用途用于插入与叙事建议，不会改变原图。";
    const buttons = doc.createElement("div");
    buttons.className = "pdf-image-saver-preview-review-actions";
    buttons.setAttribute?.("aria-label", "保存操作");
    const cancelButton = doc.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "pdf-image-saver-preview-review-cancel";
    cancelButton.textContent = "取消";
    cancelButton.title = isPage ? "不保存当前整页图片" : "不保存当前框选图片";
    const confirmButton = doc.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "pdf-image-saver-preview-review-confirm";
    confirmButton.textContent = "确认并保存";
    confirmButton.title = isPage
      ? "使用当前类别、画质和 PPT 用途保存整页图片"
      : "使用当前类别、画质和 PPT 用途保存图片";
    buttons.append(cancelButton, confirmButton);
    panel.append(heading, instruction, image, metadata, suggestion, evidenceNode, fields, fieldHelp, buttons);
    backdrop.appendChild(panel);
    backdrop.setAttribute?.("aria-labelledby", heading.id);
    backdrop.setAttribute?.("aria-describedby", `${instruction.id} ${metadata.id} ${suggestion.id} ${fieldHelp.id}`);

    return new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        doc.removeEventListener?.("keydown", onKeyDown, true);
        backdrop.remove?.();
        backdrop.__pdfImageSaverReviewResolve = null;
      };
      const settle = (action) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (action !== "confirm") {
          resolve(null);
          return;
        }
        resolve(applyPreviewReview(currentPreview, {
          category: categoryField.select.value,
          role: roleField.select.value,
          suggested: safeOptions.suggested,
          evidence,
        }));
      };
      const updatePreviewImage = (nextPreview) => {
        if (!nextPreview) return;
        currentPreview = nextPreview;
        image.src = String(currentPreview.dataURL || "");
        metadata.textContent = [
          `第 ${normalizePageNumber(currentPreview.pageNumber, 1)} 页`,
          formatPreviewDetectorLabel(currentPreview.detector),
          `${normalizePositiveInteger(currentPreview.renderedWidth, 0)} × ${normalizePositiveInteger(currentPreview.renderedHeight, 0)} 像素`,
          `保存画质：${getQualityLabelWithEstimate(currentPreview.quality)}`,
          formatBytes(currentPreview.byteCount),
        ].join(" · ");
      };
      const onKeyDown = (event) => {
        if (event?.key === "Tab") {
          const focusable = [qualityField.select, categoryField.select, roleField.select, cancelButton, confirmButton]
            .filter((control) => control && !control.disabled && !control.hidden);
          if (!focusable.length) {
            event.preventDefault?.();
            backdrop.focus?.();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const current = event.target || doc.activeElement;
          const outsidePanel = !panel.contains?.(current);
          if (outsidePanel || (!event.shiftKey && current === last)) {
            event.preventDefault?.();
            first.focus?.();
          } else if (event.shiftKey && current === first) {
            event.preventDefault?.();
            last.focus?.();
          }
          return;
        }
        if (event?.key !== "Escape") {
          return;
        }
        event.preventDefault?.();
        event.stopPropagation?.();
        settle("cancel");
      };
      qualityField.select.addEventListener?.("change", () => {
        const nextPreview = safeOptions.onQualityChange?.(qualityField.select.value, currentPreview);
        if (nextPreview) updatePreviewImage(nextPreview);
      });
      categoryField.select.addEventListener?.("change", () => {
        const autoRole = getPreviewReviewAutoRole(currentPreview, categoryField.select.value);
        const autoOption = roleField.options.find((option) => option.value === "auto");
        if (autoOption) {
          autoOption.label = `自动判断（${getChinesePreviewRoleLabel(autoRole)}）`;
          autoOption.element.textContent = autoOption.label;
        }
      });
      cancelButton.addEventListener?.("click", (event) => {
        event.preventDefault?.();
        settle("cancel");
      });
      confirmButton.addEventListener?.("click", (event) => {
        event.preventDefault?.();
        settle("confirm");
      });
      backdrop.addEventListener?.("pointerdown", (event) => {
        if (event?.target === backdrop) {
          event.preventDefault?.();
          confirmButton.focus?.();
        }
      });
      backdrop.__pdfImageSaverReviewResolve = () => settle("cancel");
      doc.addEventListener?.("keydown", onKeyDown, true);
      (doc.body || doc.documentElement).appendChild(backdrop);
      qualityField.select.focus?.();
    });
  }

  function createPreviewReviewSelect(doc, id, labelText, options, selectedValue) {
    const element = doc.createElement("label");
    element.className = "pdf-image-saver-preview-review-field";
    const label = doc.createElement("span");
    label.textContent = labelText;
    const select = doc.createElement("select");
    select.id = id;
    select.setAttribute?.("aria-label", labelText);
    const normalizedOptions = [];
    for (const option of Array.isArray(options) ? options : []) {
      const value = String(option?.value || "");
      if (!value) {
        continue;
      }
      const item = doc.createElement("option");
      item.value = value;
      item.textContent = String(option?.label || value);
      item.selected = value === selectedValue;
      select.appendChild(item);
      normalizedOptions.push({ value, label: item.textContent, element: item });
    }
    select.value = selectedValue;
    element.append(label, select);
    return { element, select, options: normalizedOptions };
  }

  function formatPreviewReviewCategorySuggestion({ requestedCategory, initialCategory, suggestedCategory } = {}) {
    const requestedKey = normalizeImageCategoryKey(requestedCategory || "auto");
    const initialKey = normalizeConfirmedImageCategory(initialCategory, suggestedCategory || "figure");
    const suggestedKey = normalizeConfirmedImageCategory(suggestedCategory, initialKey);
    if (requestedKey !== "auto" && initialKey !== suggestedKey) {
      return `设置预填：${getChineseImageCategoryLabel(initialKey)}；识别建议：${getChineseImageCategoryLabel(suggestedKey)}。`;
    }
    return `识别建议：${getChineseImageCategoryLabel(suggestedKey)}。`;
  }

  function getPreviewReviewRoleOptions(autoRole) {
    return [
      { value: "auto", label: `自动判断（${getChinesePreviewRoleLabel(autoRole)}）` },
      { value: "result", label: "结果展示" },
      { value: "method", label: "方法或流程" },
      { value: "evidence", label: "证据说明" },
      { value: "compare", label: "对比展示" },
      { value: "context", label: "背景或上下文" },
    ];
  }

  function getChinesePreviewRoleLabel(value) {
    const labels = {
      result: "结果展示",
      method: "方法或流程",
      evidence: "证据说明",
      compare: "对比展示",
      context: "背景或上下文",
      unknown: "通用图片",
    };
    return labels[normalizeRoleHint(value)] || labels.unknown;
  }

  function getPreviewReviewAutoRole(preview, category) {
    const aspectRatio = deriveAspectRatio(preview?.renderedWidth, preview?.renderedHeight);
    const layoutHint = deriveLayoutHint(aspectRatio, category);
    const slideSlot = deriveSlideSlot(layoutHint, category, aspectRatio);
    return deriveRoleHint(category, slideSlot, layoutHint);
  }

  function applyPreviewReview(preview, { category, role, suggested, evidence } = {}) {
    const imageCategory = normalizeConfirmedImageCategory(
      category || preview?.imageCategory,
      suggested || preview?.imageCategory || "figure",
    );
    const aspectRatio = deriveAspectRatio(preview?.renderedWidth, preview?.renderedHeight);
    const layoutHint = deriveLayoutHint(aspectRatio, imageCategory);
    const slideSlot = deriveSlideSlot(layoutHint, imageCategory, aspectRatio);
    const selectedRole = role === "auto"
      ? deriveRoleHint(imageCategory, slideSlot, layoutHint)
      : normalizeRoleHint(role);
    preview.imageCategory = imageCategory;
    preview.aspectRatio = aspectRatio;
    preview.layoutHint = layoutHint;
    preview.slideSlot = slideSlot;
    preview.roleHint = selectedRole === "unknown"
      ? deriveRoleHint(imageCategory, slideSlot, layoutHint)
      : selectedRole;
    preview.categorySource = imageCategory === normalizeImageCategoryKey(suggested || imageCategory)
      ? evidence?.caption
        ? "caption_confirmed"
        : evidence?.reference
          ? "reference_confirmed"
          : "visual_confirmed"
      : "user_confirmed";
    preview.categoryEvidence = evidence?.caption || evidence?.reference || "";
    return preview;
  }

  function normalizeConfirmedImageCategory(value, fallback = "figure") {
    const category = normalizeImageCategoryKey(value);
    if (category !== "auto") {
      return category;
    }
    const fallbackCategory = normalizeImageCategoryKey(fallback);
    return fallbackCategory === "auto" ? "figure" : fallbackCategory;
  }

  function getAutoCategoryTextEvidence(pageElement, preview) {
    const pageRect = pageElement?.getBoundingClientRect?.();
    if (!pageRect?.width || !pageRect?.height || !preview?.bboxNormalized) {
      return { caption: "", reference: "" };
    }
    const textNodes = Array.from(pageElement.querySelectorAll?.(".textLayer span, .textLayer div") || []);
    const spanNodes = textNodes.filter((node) => String(node?.tagName || "").toUpperCase() === "SPAN");
    const spans = (spanNodes.length ? spanNodes : textNodes)
      .map((node) => ({
        text: normalizeMetadataText(node?.textContent, "", 500),
        rect: rectWithEdges(node?.getBoundingClientRect?.()),
      }))
      .filter((entry) => entry.text && entry.rect?.width && entry.rect?.height);
    if (!spans.length) {
      return { caption: "", reference: "" };
    }
    const bbox = normalizeBBoxNormalized(preview.bboxNormalized);
    const top = pageRect.top + bbox[1] * pageRect.height;
    const bottom = pageRect.top + bbox[3] * pageRect.height;
    const left = pageRect.left + bbox[0] * pageRect.width;
    const right = pageRect.left + bbox[2] * pageRect.width;
    const horizontalMargin = pageRect.width * 0.1;
    const verticalRange = pageRect.height * 0.22;
    const horizontallyRelevant = spans.filter(({ rect }) => (
      rect.right >= left - horizontalMargin && rect.left <= right + horizontalMargin
    ));
    const above = horizontallyRelevant.filter(({ rect }) => (
      rect.bottom <= top + 8 && rect.bottom >= top - verticalRange
    ));
    const below = horizontallyRelevant.filter(({ rect }) => (
      rect.top >= bottom - 8 && rect.top <= bottom + verticalRange
    ));
    const nearbyLines = [
      ...groupCategoryEvidenceLines(above, "above", top, bottom),
      ...groupCategoryEvidenceLines(below, "below", top, bottom),
    ];
    const caption = selectNearestCategoryCaption(nearbyLines, pageRect.height);
    const figureToken = caption.match(/(?:figure|fig\.?|table|tab\.?|图|表)\s*([A-Za-z0-9.\-]+)/i)?.[0] || "";
    const pageText = normalizeMetadataText(spans.map(({ text }) => text).join(" "), "", 6000);
    const reference = findFigureReferenceParagraph(pageText, figureToken, caption);
    return { caption, reference };
  }

  function groupCategoryEvidenceLines(entries, side, selectionTop, selectionBottom) {
    const sorted = [...entries].sort((left, right) => (
      left.rect.top - right.rect.top || left.rect.left - right.rect.left
    ));
    const lines = [];
    for (const entry of sorted.slice(0, 40)) {
      const center = entry.rect.top + entry.rect.height / 2;
      const previous = lines[lines.length - 1];
      const tolerance = previous
        ? Math.max(3, Math.min(12, Math.max(previous.height, entry.rect.height) * 0.6))
        : 0;
      if (previous && Math.abs(center - previous.center) <= tolerance) {
        previous.entries.push(entry);
        previous.top = Math.min(previous.top, entry.rect.top);
        previous.bottom = Math.max(previous.bottom, entry.rect.bottom);
        previous.height = previous.bottom - previous.top;
        previous.center = (previous.top + previous.bottom) / 2;
      } else {
        lines.push({
          side,
          entries: [entry],
          top: entry.rect.top,
          bottom: entry.rect.bottom,
          height: entry.rect.height,
          center,
        });
      }
    }
    return lines.map((line) => ({
      ...line,
      text: normalizeMetadataText(
        line.entries.sort((left, right) => left.rect.left - right.rect.left).map(({ text }) => text).join(" "),
        "",
        600,
      ),
      distance: Math.max(0, side === "above" ? selectionTop - line.bottom : line.top - selectionBottom),
    }));
  }

  function selectNearestCategoryCaption(lines, pageHeight) {
    const list = Array.isArray(lines) ? lines : [];
    const marker = /^(?:figure|fig\.?|table|tab\.?|图|表)\s*[A-Za-z0-9.\-]+(?:\s|[.:：、\-]|$)/i;
    const candidates = [];
    for (let index = 0; index < list.length; index += 1) {
      const line = list[index];
      if (!marker.test(line.text)) {
        continue;
      }
      const parts = [line.text];
      for (let offset = 1; offset <= 2; offset += 1) {
        const continuation = list[index + offset];
        if (
          !continuation
          || continuation.side !== line.side
          || marker.test(continuation.text)
          || continuation.top - list[index + offset - 1].bottom > Math.max(24, continuation.height * 1.5)
        ) {
          break;
        }
        parts.push(continuation.text);
      }
      candidates.push({
        text: normalizeMetadataText(parts.join(" "), "", 400),
        distance: line.distance,
      });
    }
    if (candidates.length) {
      return candidates.sort((left, right) => left.distance - right.distance)[0].text;
    }
    const nearest = [...list].sort((left, right) => left.distance - right.distance)[0];
    return nearest && nearest.distance <= pageHeight * 0.04
      ? normalizeMetadataText(nearest.text, "", 400)
      : "";
  }

  function findFigureReferenceParagraph(pageText, figureToken, caption) {
    const text = normalizeMetadataText(pageText, "", 6000);
    if (!text) return "";
    const sentences = text.split(/(?<=[.!?。；;])\s+/).map((part) => part.trim()).filter(Boolean);
    const token = normalizeMetadataText(figureToken, "", 80).toLowerCase();
    const captionText = normalizeMetadataText(caption, "", 300).toLowerCase();
    const captionTerms = captionText
      .split(/[^a-z0-9\u4e00-\u9fff]+/)
      .filter((term) => term.length >= 4)
      .slice(0, 6);
    return normalizeMetadataText(
      sentences.find((sentence) => {
        const lower = sentence.toLowerCase();
        const unpunctuated = lower.replace(/[.:：。]+$/g, "").trim();
        if (
          (token && unpunctuated === token)
          || (captionText && (captionText.includes(lower) || lower.includes(captionText)))
        ) {
          return false;
        }
        return (token && lower.includes(token)) || captionTerms.some((term) => lower.includes(term));
      }) || "",
      "",
      400,
    );
  }

  function getChineseImageCategoryLabel(key) {
    return IMAGE_CATEGORIES[normalizeImageCategoryKey(key)]?.label || IMAGE_CATEGORIES.figure.label;
  }

  function truncateTextForPrompt(value, maxLength) {
    const text = normalizeMetadataText(value, "", maxLength + 1);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function inferImageCategory({ width, height, styleTags, palette, detector, detectionArea, captionText, referenceText }) {
    const tags = normalizeStyleTags(styleTags);
    const swatches = normalizePalette(palette);
    const w = normalizePositiveInteger(width, 1);
    const h = normalizePositiveInteger(height, 1);
    const ratio = w / Math.max(1, h);
    const area = normalizeUnitNumber(detectionArea, 0) || 0;
    const detectorText = normalizeMetadataText(detector, "", 80).toLowerCase();
    const captionCategory = inferImageCategoryFromText(captionText);
    if (captionCategory) {
      return captionCategory;
    }
    const referenceCategory = inferImageCategoryFromText(referenceText);
    if (referenceCategory) {
      return referenceCategory;
    }
    if (ratio > 2.4 || ratio < 0.42) {
      return "table";
    }
    if (area > 0 && area < 0.05 && ratio > 0.7 && ratio < 1.4) {
      return "equation";
    }
    if (tags.includes("muted") && ratio > 1.15) {
      return "metric_curve";
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
      return "metric_curve";
    }
    return "figure";
  }

  function inferImageCategoryFromText(value) {
    const text = normalizeMetadataText(value, "", 1200).toLowerCase();
    if (!text) return "";
    if (/\btable\b|\btabular\b|\btab\.?\s*\d|科研表格|表格|表\s*[0-9一二三四五六七八九十]/.test(text)) return "table";
    if (/\bequation\b|\bformula\b|\beqn\b|公式|方程/.test(text)) return "equation";
    if (/\bheat\s*map\b|\bconfusion\s+matri(?:x|ces)\b|\battention\s+map\b|\bactivation\s+map\b|\bsaliency\s+map\b|\bcorrelation\s+matri(?:x|ces)\b|\bgrad[\s-]?cam\b|热图|混淆矩阵|注意力图|激活图|显著图|相关矩阵/.test(text)) return "heatmap";
    if (/\bbar\s+(?:chart|plot|graph)\b|\bgrouped\s+bars?\b|柱状图|条形图|柱形图/.test(text)) return "bar_chart";
    if (/\bscatter(?:\s+plot)?\b|\bbox\s*plot\b|\bviolin\s*plot\b|\bhistogram\b|\bdistribution\b|\bt[\s-]?sne\b|\bumap\b|散点图?|箱线图?|小提琴图?|直方图?|分布图?|降维图?/.test(text)) return "distribution";
    if (/\bqualitative\b|\bvisual(?:ization|isation)?\s+(?:result|comparison)\b|\bsegmentation\s+(?:result|example|visualization)\b|\bdetection\s+(?:result|example|visualization)\b|定性结果?|分割结果?|检测结果?|可视化对比|视觉对比/.test(text)) return "qualitative";
    if (/\bnetwork\s+architecture\b|\bmodel\s+architecture\b|\bneural\s+network\b|\barchitecture\s+(?:diagram|of)\b|\bblock\s+diagram\b|网络结构图?|模型架构|网络架构|结构框图/.test(text)) return "architecture";
    if (/\bpipeline\b|\bworkflow\b|\bframework\s+(?:overview|diagram|of)\b|\bmethod\s+overview\b|\bprocessing\s+flow\b|流程图?|工作流|方法框架|方法概览|处理流程/.test(text)) return "pipeline";
    if (/\bmiou\b|\biou\b|\bdice\b|\baccuracy\b|\bloss\b|\bprecision\b|\brecall\b|\bf1(?:[\s-]?score)?\b|\broc\b|\bpr\s+curve\b|\bprecision[\s-]+recall\b|\bconvergence\b|\blearning\s+curve\b|\btraining\s+curve\b|\bperformance\s+curve\b|\bmetric\s+curve\b|指标曲线|训练曲线|学习曲线|收敛曲线|性能曲线|准确率|损失曲线|召回率|精确率|交并比/.test(text)) return "metric_curve";
    if (/\bchart\b|\bplot\b|\bgraph\b|\bcurve\b|曲线|折线图?|性能图/.test(text)) return "chart";
    if (/\boverview\b|\bmodule\b|\bdiagram\b|框架|结构|模块|示意/.test(text)) return "diagram";
    if (/\bmicroscopy\b|\bmicroscope\b|\bphotograph\b|\bphoto\b|\bmri\b|\bct\b|\bimage of\b|显微|照片|影像|病理/.test(text)) return "photo";
    if (/\bschematic\b|\bapparatus\b|\bcircuit\b|\bdevice\b|装置|电路|原理图/.test(text)) return "schematic";
    return "";
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
    return `${quality.label}（${formatQualityEstimateShort(normalizedQualityKey)}）`;
  }

  function formatQualityEstimateShort(qualityKey) {
    const estimate = QUALITY[normalizeQualityKey(qualityKey)].estimate;
    return String(estimate || "").replace(/\/image$/i, "");
  }

  function getQualityMark(qualityKey) {
    const key = normalizeQualityKey(qualityKey);
    return QUALITY[key].label;
  }

  function formatPreviewDetectorLabel(detector) {
    const text = normalizeMetadataText(detector, "unknown", 80);
    if (!text || text === "unknown") {
      return "未知";
    }
    if (text === "manual_selection" || text === "manual") {
      return "手动框选";
    }
    if (text === "pdfjs_record_images" || text === "pdfjs" || text === "auto") {
      return "历史候选采集";
    }
    if (text === "whole_page_preview" || text === "page") {
      return "整页图片";
    }
    return "其他采集方式";
  }

  function formatPreviewScopeLabel(scope) {
    const text = normalizeScope(scope);
    if (text === "auto-page") {
      return "历史候选采集";
    }
    if (text === "document") {
      return "全文";
    }
    if (text === "clip") {
      return "框选";
    }
    if (text === "page") {
      return "整页图片";
    }
    return "未知范围";
  }

  function formatPageToastToken(pageIndex) {
    return `第 ${normalizePageIndex(pageIndex, 0) + 1} 页`;
  }

  function formatOriginalScopeToken(scope, pageIndex = null) {
    if (normalizeOriginalScope(scope) === "document") {
      return "全文";
    }
    if (pageIndex === null || pageIndex === undefined) {
      return "当前页";
    }
    return formatPageToastToken(pageIndex);
  }

  function buildToolbarActionTooltip(action, qualityKey) {
    const actionText = normalizeMetadataText(action, "保存图片预览", 90);
    return `${actionText}；清晰度：${getQualityLabelWithEstimate(qualityKey)}`;
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
    return title.includes("图片索引") || title.includes("image index") || title.includes("img index");
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
      return "尺寸未知";
    }
    return `${width} × ${height} 像素`;
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
    Zotero.debug(`PDF 图片保存：${message}${data ? ` ${JSON.stringify(data)}` : ""}`);
  }

  function logError(error) {
    Zotero.logError(error);
    log(formatUserFacingError(error));
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
      return `大小限制：${translateUserFacingErrorDetail(message)}`;
    }
    if (category === "helper") {
      return `高级原图提取：${translateUserFacingErrorDetail(message)}`;
    }
    if (category === "storage") {
      return `保存失败：${translateUserFacingErrorDetail(message)}`;
    }
    if (category === "duplicate") {
      return `重复图片：${translateUserFacingErrorDetail(message)}`;
    }
    if (category === "capture") {
      return `采集失败：${translateUserFacingErrorDetail(message)}`;
    }
    return message === "Unknown err." ? "操作失败：未知错误。" : `操作失败：${translateUserFacingErrorDetail(message)}`;
  }

  function translateUserFacingErrorDetail(message) {
    const text = normalizeErrorMessageText(message);
    const known = {
      "Capture failed: canvas missing.": "无法获取当前 PDF 页面的画布。",
      "Capture failed: not a PDF.": "当前标签页不是 PDF。",
      "Capture failed: geometry n/a.": "无法获取页面位置。",
      "Capture failed: selection outside.": "框选区域不在页面内。",
      "Storage failed: index import failed.": "无法写入 Zotero 图片预览附件。",
      "Storage failed: preview attachment missing.": "找不到图片预览附件。",
      "Storage failed: preview open unavailable.": "当前 Zotero 无法打开图片预览。",
      "Storage failed: library browser unavailable.": "当前 Zotero 无法打开系统浏览器。",
      "Storage failed: image export runtime unavailable.": "当前环境无法读取图库原图。",
      "Storage failed: library HTML writer unavailable.": "当前环境无法生成图库页面。",
      "Storage failed: package stream unavailable.": "当前环境无法读取图片包数据流。",
      "Storage failed: package stream invalid.": "图片包数据流无效。",
      "Storage failed: expanded image package exceeds file cap.": "图片包解压后超过大小上限。",
      "Storage failed: package text encoder unavailable.": "当前环境无法编码图片包。",
      "Storage failed: image package is empty.": "所选图片包为空。",
      "Storage failed: image package exceeds file cap.": "图片包超过文件大小上限。",
      "Storage failed: gzip package runtime unavailable.": "当前环境无法解压该图片包。",
      "Storage failed: package text decoder unavailable.": "当前环境无法解码图片包。",
      "Storage failed: image package JSON invalid.": "图片包内容损坏或不是有效格式。",
      "Storage failed: image package format invalid.": "图片包版本或格式不受支持。",
      "Storage failed: native file picker unavailable.": "系统文件选择器不可用。",
      "Storage failed: no images selected.": "尚未选择图片。",
      "Storage failed: selected images exceed package byte cap.": "所选图片总大小超过单个分享包上限。",
      "Storage failed: selected images are unavailable.": "所选图片无法读取。",
      "Storage failed: compressed image package exceeds file cap.": "生成的图片包超过文件大小上限。",
      "Storage failed: package writer unavailable.": "当前环境无法写入图片包。",
      "Storage failed: package reader unavailable.": "当前环境无法读取图片包。",
      "Storage failed: image package file size invalid.": "图片包文件大小无效。",
      "Storage failed: image package exceeds byte cap.": "图片包中的原图总大小超过上限。",
      "Storage failed: directory unavailable.": "图片库目录路径无效，无法创建。",
      "Storage failed: directory runtime unavailable.": "当前环境无法创建图片库目录。",
      "Storage failed: shared SQLite runtime unavailable.": "当前 Zotero 无法打开外部图片库数据库。",
      "Storage failed: preview image bytes unavailable.": "无法读取本次预览的图片数据。",
      "Storage failed: source region identity collision.": "同一原文区域已属于另一条图片记录，未覆盖已有记录。",
      "Helper: Python n/a.": "未找到 Python。",
      "Helper: PyMuPDF n/a.": "未安装 PyMuPDF。",
      "Helper failed: script missing.": "插件内置的原图提取脚本缺失或版本不匹配。",
      "Helper failed: PDF path n/a.": "找不到该文献的 PDF 文件。",
      "Helper failed: no report.": "高级原图提取没有返回结果。",
      "Unknown err.": "未知错误。",
    };
    if (known[text]) {
      return known[text];
    }
    // Some throws append an inner cause after a known message. Match the known message as an
    // exact leading segment so the user still gets its explanation instead of the generic fallback.
    const knownPrefix = Object.keys(known).find((candidate) => text.startsWith(`${candidate} `));
    if (knownPrefix) {
      return known[knownPrefix];
    }
    const detail = text
      .replace(/^Capture failed:\s*/i, "")
      .replace(/^Storage failed:\s*/i, "")
      .replace(/^Helper failed:\s*/i, "")
      .replace(/^Helper:\s*/i, "")
      .replace(/^Byte cap:\s*/i, "")
      .replace(/^Duplicate:\s*/i, "");
    if (/^canvas missing\.?$/i.test(detail)) {
      return "无法获取当前 PDF 页面的画布。";
    }
    if (/^index import failed\.?$/i.test(detail)) {
      return "无法写入 Zotero 图片索引。";
    }
    // Messages that carry a runtime value. Each pattern is anchored and specific so an unknown
    // message still falls through to the console hint instead of being guessed at.
    const dynamic = [
      [/^index large\s*\((.+?)\)\.?(?:\s*Lower Q\.?)?$/i, (match) => `图片索引过大（${match[1]}），请降低清晰度后重试。`],
      [/^all\s+(\d+)\s+orig imports failed\.?$/i, (match) => `${match[1]} 张原图全部导入失败。`],
      [/^bad schema\s+(.+?)\.?$/i, (match) => `原图提取脚本版本不匹配（${match[1]}）。`],
      [/^exit\s+(-?\d+),\s*no report\.?$/i, (match) => `高级原图提取进程异常退出（代码 ${match[1]}），没有返回结果。`],
      [/^Optional helper timed out after\s+(\d+)\s+seconds?\.?$/i, (match) => `高级原图提取超过 ${match[1]} 秒未完成，已停止。`],
      [/^Preview data URL bad\.?$/i, () => "预览图片数据无效。"],
      [/^Preview index bad\.?$/i, () => "图片索引数据无效。"],
      [/^Preview index empty\.?$/i, () => "图片索引没有任何图片。"],
      [/^invalid-shared-db-path:\s*(.+)$/i, (match) => `外部图片库路径无效（${match[1]}）。`],
    ];
    for (const [pattern, formatter] of dynamic) {
      const match = detail.match(pattern);
      if (match) {
        return formatter(match);
      }
    }
    return /[\u3400-\u9fff]/.test(detail) ? detail : "详细原因请查看错误控制台。";
  }

  return {
    init,
    startup,
    shutdown,
    addToWindow,
    removeFromWindow,
    __test__: {
      buildIndexHTML,
      buildGlobalImageLibraryHTML,
      normalizeGlobalImageLibraryRecord,
      buildGlobalImageDownloadName,
      normalizeDatabaseImageBytes,
      normalizeDatabaseRowKeys,
      getDatabaseRowValue,
      getDatabaseImageFileType,
      normalizeSHA256,
      computeSHA256Hex,
      bytesToBase64,
      base64ToBytes,
      prepareGlobalImageLibraryView,
      synchronizeLegacyPreviewIndexesToSharedLibrary,
      openGlobalImageLibrary,
      openPreviewIndexAttachment,
      upgradePreviewIndexInteractivityHTML,
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
      confirmPreviewBeforeSave,
      showPreviewReviewDialog,
      formatPreviewReviewCategorySuggestion,
      confirmAndSaveOriginalImagesFromReader,
      filterExistingOriginalImagesForImport,
      formatDiagnosticDups,
      formatDiagnosticInitialCategory,
      formatDiagnosticArea,
      formatDiagnosticsReport,
      probeOptionalHelperAvailability,
      formatHelperPythonMode,
      formatOptionalHelperStatus,
      formatPreviewDuplicateSkipReason,
      classifyPreviewDuplicateSkipReason,
      buildOriginalImportSkippedText,
      formatHelperFailure,
      formatHelperStatusLabel,
      getToastDuration,
      getErrorMessage,
      classifyErrorCategory,
      formatUserFacingError,
      translateUserFacingErrorDetail,
      formatDiagnosticWarning,
      formatPageWithLabel,
      normalizeToastLevel,
      getActiveReader,
      getContextPageIndex,
      getPDFViewerContextCandidate,
      buildContextMenuActions,
      buildToolbarActionTooltip,
      formatPreviewDetectorLabel,
      formatPreviewScopeLabel,
      formatSavedPreviewLabel,
      formatQualityEstimateShort,
      getQualityMark,
      formatPageToastToken,
      formatOriginalScopeToken,
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
      addToWindow,
      removeFromWindow,
      handleMainWindowUnload,
      disposeReaderUI,
      registerApplicationShutdownObserver,
      unregisterApplicationShutdownObserver,
      migrateLegacyPreferenceBranch,
      refreshExistingReaderToolbars,
      rememberPreviewIndexSave,
      normalizeHelperSchemaText,
      normalizeHelperStatusText,
      normalizeHelperWarningMessages,
      getCondaZlkPythonCandidatePaths,
      isZlkCondaEnvironmentPath,
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
      getSavedImageCategoryLabel,
      getSavedImageCategoryMark,
      inferImageCategory,
      getAutoCategoryTextEvidence,
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
      saveClipPreviewIndex,
      saveOriginalImagesFromReader,
      savePagePreviewIndex,
      showReaderToast,
      isPDFReader,
      normalizeAnnotationKey,
      buildSharedDatabaseLocatorRecord,
      ensureSharedLibraryDirectory,
      safeWriteSharedDatabaseLocator,
      safeRefreshSharedStateFromPreferences,
      normalizeSharedDatabasePath,
      isZoteroInternalDatabasePath,
      isSafeAbsoluteSharedDatabasePath,
      resolveSharedLocatorPath,
      resolveDefaultSharedDatabasePath,
      INVALID_SHARED_DB_PATH_TOKEN,
      parseBridgeRequest,
      normalizeBridgeImageIDs,
      isAllowedBridgeZoteroURI,
      isBridgeEndpointRegistered,
      enableSharedLibraryBridge,
      disableSharedLibraryBridge,
      closeSharedDatabaseConnection,
      safeWriteBridgeState,
      ensureSharedLibrarySchema,
      publishPreviewEntriesToSharedLibrary,
      buildSharedLibraryPackageImage,
      buildSharedLibraryPackagePayload,
      encodeSharedLibraryPackage,
      decodeSharedLibraryPackage,
      exportSharedLibraryPackage,
      importSharedLibraryPackage,
      deleteSharedLibraryImages,
      normalizeCitationDOI,
      normalizeCitationTitle,
      normalizeCitationYear,
      buildLocalCitationIndex,
      matchSharedCitation,
      buildImportedSource,
      handleBridgeRequest,
      SHARED_LIBRARY_PACKAGE_FORMAT,
    },
    get started() {
      return started;
    },
  };
})();
