var PdfImageSaver;

function log(message) {
  Zotero.debug("PDF Image Saver: " + message);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI }) {
  log("Starting " + version);
  await registerPreferencePane(id, rootURI);
  Services.scriptloader.loadSubScript(rootURI + "content/pdf-image-saver.js");
  PdfImageSaver.init({ id, version, rootURI });
  await PdfImageSaver.startup();
}

async function registerPreferencePane(id, rootURI) {
  try {
    await Zotero.PreferencePanes.register({
      pluginID: id,
      src: rootURI + "preferences.xhtml",
      scripts: [rootURI + "content/preferences.js"],
    });
  } catch (error) {
    Zotero.logError(error);
    log("Preference pane registration failed: " + (error?.message || error));
  }
}

async function onMainWindowLoad({ window }) {
  await PdfImageSaver?.addToWindow(window);
}

async function onMainWindowUnload({ window }) {
  await PdfImageSaver?.removeFromWindow(window);
}

async function shutdown(data, reason) {
  log("Shutting down");
  await PdfImageSaver?.shutdown();
  PdfImageSaver = undefined;
}

function uninstall() {
  log("Uninstalled");
}
