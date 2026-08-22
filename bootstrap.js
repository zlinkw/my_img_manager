var PdfImageSaver;
var PathUtils;
var IOUtils;

function loadRuntimeModules() {
  const zoteroGlobal = Components.utils.getGlobalForObject(Zotero);
  PathUtils = zoteroGlobal.PathUtils;
  IOUtils = zoteroGlobal.IOUtils;
  if (!PathUtils || !IOUtils) {
    throw new Error("Zotero runtime file APIs unavailable");
  }
}

function log(message) {
  Zotero.debug("PDF 图片保存：" + message);
}

function install() {
  log("已安装");
}

async function startup({ id, version, rootURI }) {
  try {
    log("正在启动版本 " + version);
    await registerPreferencePane(id, rootURI);
  loadRuntimeModules();
  Services.scriptloader.loadSubScript(rootURI + "content/pdf-image-saver.js");
  Services.scriptloader.loadSubScript(rootURI + "content/update-check.js");
  PdfImageSaverUpdateCheck.init({ id, version });
  PdfImageSaver.init({ id, version, rootURI });
    await PdfImageSaver.startup();
  } catch (error) {
    Zotero.logError(error);
    const detail = `${error?.message || String(error)}\n\n${error?.stack || ""}`.trim();
    log("启动失败：" + detail);
    Services.prompt.alert(
      Zotero.getMainWindow?.() || null,
      "PDF 图片保存",
      "插件启动失败。请打开 Zotero 错误控制台，并复制其中以“PDF 图片保存”开头的错误信息。",
    );
  }
}

async function registerPreferencePane(id, rootURI) {
  try {
    await Zotero.PreferencePanes.register({
      pluginID: id,
      src: rootURI + "preferences.xhtml",
      scripts: [rootURI + "content/update-check.js", rootURI + "content/preferences.js"],
    });
  } catch (error) {
    Zotero.logError(error);
    log("设置页面注册失败：" + (error?.message || error));
  }
}

async function onMainWindowLoad({ window }) {
  await PdfImageSaver?.addToWindow(window);
}

async function onMainWindowUnload({ window }) {
  await PdfImageSaver?.handleMainWindowUnload(window);
}

async function shutdown(data, reason) {
  log("正在停止");
  const instance = PdfImageSaver;
  const cleanup = instance?.shutdown?.();
  const isApplicationShutdown = reason === "APP_SHUTDOWN"
    || (typeof APP_SHUTDOWN !== "undefined" && reason === APP_SHUTDOWN);
  if (isApplicationShutdown) {
    // Zotero is already tearing down its native window. External SQLite
    // cleanup remains in flight, but must not leave a chrome-only strip.
    void Promise.resolve(cleanup).catch((error) => Zotero.logError(error));
    PdfImageSaver = undefined;
    return;
  }
  await cleanup;
  PdfImageSaver = undefined;
}

function uninstall() {
  log("已卸载");
}
