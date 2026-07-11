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
  buildIndexTitle,
  buildOriginalImageIndexHTML,
  buildOriginalImageTitle,
  buildOpenPDFURI,
  buildSourceRegion,
  buildContextMenuActions,
  calculateCanvasCrop,
  cleanupSelectionOverlay,
  confirmAndSaveOriginalImagesFromReader,
  filterExistingOriginalImagesForImport,
  formatAutoDuplicateSkipReason,
  formatPreviewDuplicateSkipReason,
  classifyPreviewDuplicateSkipReason,
  formatDiagnosticsReport,
  formatHelperFailure,
  getToastDuration,
  normalizeToastLevel,
  getErrorMessage,
  getActiveReader,
  applyAutoRasterButtonState,
  buildToolbarActionTooltip,
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
  imageCoordinatesToCandidates,
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
  saveAutoDetectedPageImagePreviews,
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
  function createElement(tagName) {
    return {
      tagName,
      id: "",
      className: "",
      textContent: "",
      removed: false,
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
    appendChild(element) {
      children.push(element);
      return element;
    },
    append(...elements) {
      children.push(...elements);
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
assert.strictEqual(readerToastDoc.bodyChildren[0].textContent, "Reader document toast", "reader toast must preserve message text");

showReaderToast(
  { type: "pdf", _iframeWindow: { PDFViewerApplication: {}, document: readerToastDoc } },
  { bad: true },
  { level: "bad" },
);
assert.strictEqual(readerToastDoc.bodyChildren[1].textContent, "PDF Image Saver notification.", "malformed toast messages must normalize to compact fallback text");
assert.strictEqual(readerToastDoc.bodyChildren[1].className, "pdf-image-saver-toast pdf-image-saver-info", "malformed toast levels must normalize to info");

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
assert.ok(region.label.includes("x 10.0%-40.0%"));

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
assert.strictEqual(mediumPreview.qualityEstimate, "60-220 KB/image", "medium preview must carry medium estimate");
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
assert.strictEqual(malformedQualityPreview.qualityEstimate, "60-220 KB/image", "renderer malformed quality must use medium estimate");
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
assert.strictEqual(metadata.entries[0].quality_estimate, "60-220 KB/image");
assert.strictEqual(metadata.entries[0].source_region.coordinate_system, "normalized_page_rect");
assert.strictEqual(metadata.entries[0].source_region_key, htmlEntry.sourceRegionKey);
assert.strictEqual(metadata.entries[0].preview_duplicate_key, getPreviewDuplicateKey(htmlAttachment, htmlEntry));
assert.strictEqual(metadata.entries[0].annotation_key, null);
assert.ok(html.includes("<details>"), "full JSON metadata must be in a details block");
assert.ok(!/<details[^>]*open/i.test(html), "full JSON metadata must be collapsed by default");
assert.ok(html.includes(`Index ${getPreviewIndexFingerprint(metadata.preview_index_key)}`), "header must show compact index identity");
assert.ok(html.includes(">Open source PDF</a>"), "HTML entry must expose an explicit source PDF action");
assert.ok(html.includes(`title="${htmlEntry.sourceRegionKey}"`), "compact region identity must keep full source key in a title");
assert.ok(html.includes(getSourceRegionFingerprint(htmlEntry.sourceRegionKey)), "normal view must show a compact region identity");
assert.ok(html.includes('<details class="entry-details">'), "technical entry metadata must be in a per-entry details block");
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
  "PDF - image index unknown",
  "index title must normalize malformed title, scope, and page target",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 2 }),
  "Auto skipped: all already in this session.",
  "session duplicate feedback must remain session-specific",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSavedDuplicates: 2 }),
  "Auto skipped: all already in saved HTML indexes.",
  "persisted duplicate feedback must not claim current-session-only saves",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 1, skippedSavedDuplicates: 1 }),
  "Auto skipped: all already in saved indexes or this session.",
  "mixed duplicate feedback must mention both persisted and session sources",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSavedDuplicates: 1, skippedByteLimit: 1 }),
  "Auto skipped: saved-index dups; also hit total byte cap.",
  "mixed persisted duplicate and byte-cap feedback must mention both causes",
);
assert.strictEqual(
  formatAutoDuplicateSkipReason({ skippedSessionDuplicates: 1, skippedOversized: 1 }),
  "Auto skipped: session dups; also hit per-item byte cap.",
  "mixed session duplicate and oversized feedback must mention both causes",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("clip", "session"),
  "Clip skipped: already in this session.",
  "clip duplicate feedback must distinguish session memory",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("page", "saved"),
  "Page skipped: already in a synced HTML index.",
  "page duplicate feedback must distinguish synced indexes",
);
assert.strictEqual(
  formatPreviewDuplicateSkipReason("auto-page", "saved"),
  "Auto index skipped: already in a synced HTML index.",
  "auto-page duplicate feedback must distinguish synced indexes",
);

const singleIndexKey = getPreviewIndexKey(htmlAttachment, [htmlEntry], "clip", "medium");
const singleIndexTitle = buildIndexTitle(htmlParent, htmlAttachment, "clip", 4, [htmlEntry], "medium", singleIndexKey);
assert.ok(singleIndexTitle.includes("p5"), "single preview title must include target page");
assert.ok(singleIndexTitle.includes("medium"), "single preview title must include quality");
assert.ok(singleIndexTitle.includes("1img"), "single preview title must include image count");
assert.ok(singleIndexTitle.includes(getPreviewIndexFingerprint(singleIndexKey)), "single preview title must include short identity");
assert.ok(singleIndexTitle.length <= 140, "single preview title must stay compact");

const multiIndexKey = getPreviewIndexKey(htmlAttachment, [samePageLeft, samePageRight], "auto-page", "high");
const multiIndexTitle = buildIndexTitle(htmlParent, htmlAttachment, "auto-page", 4, [samePageLeft, samePageRight], "high", multiIndexKey);
assert.ok(multiIndexTitle.includes("2img"), "multi preview title must include image count");
assert.ok(multiIndexTitle.includes("high"), "multi preview title must include quality");
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
assert.ok(malformedScalarHTML.includes("3 B, unknown size"), "malformed scalar HTML must show concise actual size");
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
assert.ok(paddedByteHTML.includes("1 B, 120 x 80px"), "base64 padding must be subtracted from visible byte count");
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
assert.ok(invalidQualityHTML.includes("Medium (60-220 KB/image)"), "invalid entry quality must fall back to Medium");
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
  /Preview image data URL is invalid/,
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
  /Preview image data URL is invalid/,
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
assert.ok(canonicalBase64HTML.includes("1 B, 120 x 80px"), "canonical padded preview data URLs must still pass");
assert.throws(
  () => buildIndexHTML({
    attachment: htmlAttachment,
    parentItem: htmlParent,
    entries: null,
    scope: "clip",
    qualityKey: "medium",
  }),
  /Preview index entries must be an array/,
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
  /Preview index must include at least one entry/,
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
  /Preview image data URL is invalid/,
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
  /Preview image data URL is invalid/,
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
  /^PDF - original p1 image 1 [a-z0-9]+$/,
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
assert.strictEqual(normalizeToastLevel("progress"), "progress", "progress toast level must be accepted");
assert.strictEqual(normalizeToastLevel("constructor"), "info", "malformed toast level must fall back to info");
assert.strictEqual(getToastDuration("progress"), 120000, "progress toast must stay visible long enough for long-running work");
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
assert.ok(noisyDiagnostics.includes("Plugin unknown"), "diagnostics plugin must normalize malformed text");
assert.ok(noisyDiagnostics.includes("Started unknown"), "diagnostics booleans must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Quality medium"), "diagnostics quality must normalize malformed values");
assert.ok(noisyDiagnostics.includes("PDF UNKNOWN"), "diagnostics PDF key must normalize malformed values");
assert.ok(noisyDiagnostics.includes("parent none"), "diagnostics parent item must normalize malformed values");
assert.ok(noisyDiagnostics.includes("Page 1"), "diagnostics page target must normalize malformed values");
assert.ok(noisyDiagnostics.includes("- ok"), "diagnostics warnings must keep valid compact warning text");

assert.strictEqual(getErrorMessage(new Error("Readable failure")), "Readable failure", "Error.message text must be preserved");
assert.strictEqual(getErrorMessage("plain failure"), "plain failure", "plain thrown strings must be preserved");
assert.strictEqual(getErrorMessage(404), "404", "numeric thrown values must be preserved");
for (const noisyErrorValue of [{ bad: true }, ["bad"], null, undefined, new Error(""), "[object Object]", "undefined", "null"]) {
  assert.strictEqual(
    getErrorMessage(noisyErrorValue),
    "Unknown error.",
    "malformed error messages must use a compact fallback",
  );
}
assert.strictEqual(getErrorMessage("x".repeat(400)).length, 320, "oversized error messages must be capped");
assert.strictEqual(
  buildToolbarActionTooltip("Clip a figure preview", "high"),
  "Clip a figure preview; High, 180-750 KB/image",
  "toolbar tooltip must show selected high quality estimate",
);
assert.strictEqual(
  buildToolbarActionTooltip("Clip a figure preview", "constructor"),
  "Clip a figure preview; Medium, 60-220 KB/image",
  "toolbar tooltip must normalize malformed quality to medium",
);
const autoRasterStateButton = { disabled: false, title: "" };
applyAutoRasterButtonState(autoRasterStateButton, false, "high");
assert.strictEqual(autoRasterStateButton.disabled, true, "unavailable auto-raster state must disable the button");
assert.ok(
  autoRasterStateButton.title.includes("unavailable"),
  "unavailable auto-raster state must explain fallback to Clip",
);
applyAutoRasterButtonState(autoRasterStateButton, true, "high");
assert.strictEqual(autoRasterStateButton.disabled, false, "available auto-raster state must re-enable the button");
assert.strictEqual(
  autoRasterStateButton.title,
  "Auto-detect current-page raster previews; High, 180-750 KB/image",
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
  const [toolbarSelect, , toolbarAutoButton] = toolbarChildren[0].children;
  assert.strictEqual(toolbarAutoButton.disabled, true, "unsupported auto-raster toolbar button must be disabled");
  assert.ok(
    toolbarAutoButton.title.includes("unavailable"),
    "unsupported auto-raster toolbar button must explain unavailable state",
  );
  toolbarSelect.value = "high";
  toolbarSelect.dispatch("change");
  await flushAsyncToolbarState();
  assert.strictEqual(toolbarAutoButton.disabled, true, "quality change must preserve disabled auto-raster state");
  assert.ok(
    toolbarAutoButton.title.includes("unavailable"),
    "quality change must preserve unavailable auto-raster explanation",
  );
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
  contextMenuItems.some((item) => item.label === "Auto raster; High (180-750 KB/image)"),
  "context menu auto-raster label must show the default quality estimate",
);
assert.ok(
  contextMenuItems.some((item) => item.label === "Save whole page; High (180-750 KB/image)"),
  "context menu page-preview label must show the default quality estimate",
);
assert.ok(
  !contextMenuItems.some((item) => item.label === "Save current page preview index (Medium)"),
  "context menu page-preview label must not hardcode Medium",
);
assert.ok(
  contextMenuItems.some((item) => item.label === "Original embeds; this page (max 12)"),
  "context menu page-original label must show the page max image count",
);
assert.ok(
  contextMenuItems.some((item) => item.label === "Original embeds; whole PDF (max 34)"),
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
commandActions.find((item) => item.label.startsWith("Auto raster;"))?.onCommand();
commandActions.find((item) => item.label.startsWith("Save whole page;"))?.onCommand();
commandActions.find((item) => item.label.startsWith("Original embeds; this page"))?.onCommand();
commandActions.find((item) => item.label.startsWith("Original embeds; whole PDF"))?.onCommand();
commandActions.find((item) => item.label === "Diagnostics")?.onCommand();
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
    context.Services.prompt.confirms[0].message.includes("current page"),
    "malformed original confirmation options must fall back to current-page scope",
  );
  assert.ok(
    context.Services.prompt.confirms[0].message.includes("25 MB/image")
      && context.Services.prompt.confirms[0].message.includes("150 MB/run"),
    "original confirmation must state per-image and total byte risk",
  );
  assert.strictEqual(
    context.Services.prompt.alerts[0].message,
    "Original cancelled.",
    "cancelled original confirmation must show compact reader feedback",
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
    { title: "Existing original image index" },
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
    /All 2 Zotero original image imports failed/,
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
    "Rendered PDF page canvas was not found",
  );
  await assertSaveEntryHandlesMalformedOptions(
    savePagePreviewIndex,
    "page-preview",
    "Rendered PDF page canvas was not found",
  );
  await assertSaveEntryHandlesMalformedOptions(
    saveClipPreviewIndex,
    "clip-preview",
    "Active reader item is not a PDF attachment",
  );
  await assertSaveEntryHandlesMalformedOptions(
    saveOriginalImagesFromReader,
    "original-image",
    "Active reader item is not a PDF attachment",
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
    "pdf-image-saver-auto-max-images",
    "pdf-image-saver-auto-max-preview-mb",
    "pdf-image-saver-max-index-mb",
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

function assertPreferenceStatusRendering() {
  const preferencesSource = fs.readFileSync(path.join(root, "content", "preferences.js"), "utf8");
  const prefDoc = createPreferenceDocument();
  prefDoc.getElementById("pdf-image-saver-default-quality").value = "high";
  prefDoc.getElementById("pdf-image-saver-duplicate-guard").checked = true;
  prefDoc.getElementById("pdf-image-saver-auto-max-images").value = "6";
  prefDoc.getElementById("pdf-image-saver-auto-max-preview-mb").value = "3";
  prefDoc.getElementById("pdf-image-saver-max-index-mb").value = "5";
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
  assert.ok(status.textContent.includes("Storage: compact HTML indexes"), "preference status must render storage mode");
  assert.ok(status.textContent.includes("Quality: High; 180-750 KB/image"), "preference status must render selected quality estimate");
  assert.ok(status.textContent.includes("Duplicates: on; session + saved indexes"), "preference status must render duplicate guard state");
  assert.ok(status.textContent.includes("Auto: 6 candidates; 3 MB cap"), "preference status must render auto caps");
  assert.ok(status.textContent.includes("Index: 5 MB max"), "preference status must render HTML index cap");
  assert.ok(status.textContent.includes("Helper: optional; Python/PyMuPDF for originals only"), "preference status must render helper note");
  prefDoc.getElementById("pdf-image-saver-default-quality").value = "low";
  prefDoc.getElementById("pdf-image-saver-default-quality").dispatch("change");
  assert.ok(status.textContent.includes("Quality: Low; 20-80 KB/image"), "preference status must refresh after quality change");
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
