const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content", "pdf-image-saver.js"), "utf8");
const context = {
  console,
  Zotero: {
    version: "9.0.6-test",
    Libraries: { userLibraryID: 1, get() { return null; } },
    Prefs: { get() { return undefined; }, set() {} },
    Promise: { delay: async () => {} },
    debug() {},
    logError() {},
    Utilities: { randomString() { return "TEST0001"; } },
  },
  Services: { appinfo: { OS: "WINNT" }, prompt: { alert() {}, confirm() { return false; } } },
  IOUtils: { exists: async () => false, stat: async () => ({ size: 0 }), remove: async () => {} },
  PathUtils: { tempDir: "C:\\Temp", join: (...parts) => parts.filter(Boolean).join("\\") },
};
vm.createContext(context);
context.globalThis = context;
vm.runInContext(source, context, { filename: "pdf-image-saver.js" });
context.PdfImageSaver.init({ id: "pdf-image-saver@zlk.local", version: "0.1.128-test", rootURI: "resource://pdf-image-saver/" });

const api = context.PdfImageSaver.__test__;
assert.ok(api, "release exports test helpers");
assert.equal(api.normalizeImageCategoryKey("HEATMAP"), "heatmap");
assert.equal(api.normalizeImageCategoryKey("unknown"), "auto");

const region = api.buildSourceRegion([0.1, 0.2, 0.4, 0.6]);
assert.equal(region.coordinate_system, "normalized_page_rect");
assert.equal(region.label, "横向 10.0%–40.0%；纵向 20.0%–60.0%；宽 30.0% × 高 40.0%");

const fixture = api.buildGlobalImageLibraryHTML({
  records: [{
    imageID: "fixture-1",
    title: "科研热图",
    year: "2026",
    pageNumber: 3,
    imageURL: "images/image-00001.png",
    imageBytes: 4,
    mimeType: "image/png",
    imageCategory: "heatmap",
    colorFamily: "blue",
    createdAt: "2026-07-19T00:00:00.000Z",
  }],
  bridgeURL: "http://127.0.0.1:23119/pdf-image-saver/bridge",
  bridgeToken: "token",
});
for (const text of [
  'data-paper-image-library-version="37"',
  "刷新图库",
  "导入分享包",
  "分享所选",
  "删除所选",
  'id="library-viewer"',
  "科研热图",
]) assert.ok(fixture.includes(text), `gallery must contain ${text}`);

for (const [name, value] of [
  ["PDF_IMAGE_SAVER_BROWSER_SINGLE_FIXTURE", api.buildIndexHTML({
    attachment: { libraryID: 1, key: "PDF00001", attachmentContentType: "application/pdf" },
    parentItem: { key: "ITEM0001", getField(field) { return field === "title" ? "科研论文" : ""; } },
    scope: "clip",
    qualityKey: "medium",
    indexKey: "preview-index:v1:clip:medium:n1:test",
    entries: [{ id: "entry-1", pageIndex: 0, pageNumber: 1, bboxNormalized: [0.1, 0.1, 0.5, 0.5], dataURL: "data:image/png;base64,iVBORw0KGgo=", byteCount: 8, renderedWidth: 400, renderedHeight: 300, quality: "medium", detector: "manual_selection", imageCategory: "auto" }],
  })],
  ["PDF_IMAGE_SAVER_BROWSER_MULTI_FIXTURE", api.buildIndexHTML({
    attachment: { libraryID: 1, key: "PDF00001", attachmentContentType: "application/pdf" },
    parentItem: { key: "ITEM0001", getField(field) { return field === "title" ? "科研论文" : ""; } },
    scope: "clip",
    qualityKey: "high",
    indexKey: "preview-index:v1:clip:high:n2:test",
    entries: [1, 2].map((pageNumber) => ({ id: `entry-${pageNumber}`, pageIndex: pageNumber - 1, pageNumber, bboxNormalized: [0.1, 0.1, 0.5, 0.5], dataURL: "data:image/png;base64,iVBORw0KGgo=", byteCount: 8, renderedWidth: 400, renderedHeight: 300, quality: "high", detector: "manual_selection", imageCategory: "heatmap" })),
  })],
  ["PDF_IMAGE_SAVER_BROWSER_LIBRARY_FIXTURE", fixture],
  ["PDF_IMAGE_SAVER_BROWSER_OFFLINE_LIBRARY_FIXTURE", api.buildGlobalImageLibraryHTML({ records: [] })],
]) {
  const target = process.env[name];
  if (target) fs.writeFileSync(target, value, "utf8");
}

assert.ok(!source.includes("pdf-image-saver-auto-button"), "automatic-capture toolbar is removed");
assert.ok(!source.includes("saveAutoDetectedPageImagePreviews"), "automatic-capture workflow is removed");
assert.ok(!source.includes("imageCoordinatesToCandidates"), "PDF.js automatic-candidate extraction is removed");
assert.ok(source.includes("saveClipPreviewIndex"), "manual clip workflow remains");
assert.ok(source.includes("publishPreviewEntriesToSharedLibrary"), "capture persists to shared SQLite");
assert.ok(source.includes("paper-image-library-view"), "gallery path contract remains");

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJSON.version, manifest.version, "package and XPI versions agree");
assert.equal(manifest.applications.zotero.strict_max_version, "9.*", "release supports Zotero 9.x");
assert.equal(manifest.version, "0.1.128", "recovery candidate increments the installed release");

console.log("current release tests ok");
