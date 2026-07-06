const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content", "pdf-image-saver.js"), "utf8");

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
    Prefs: {
      values: Object.create(null),
      get(key) {
        return this.values[key];
      },
    },
    debug() {},
    logError(error) {
      throw error;
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
  buildOpenPDFURI,
  buildSourceRegion,
  calculateCanvasCrop,
  getActiveReader,
  getPDFViewerContextCandidate,
  limitOriginalImagesForImport,
  normalizeBBoxNormalized,
  isPDFReader,
  normalizeAnnotationKey,
} = context.PdfImageSaver.__test__;
const userAttachment = { libraryID: 1, key: "ABCDEF12" };
const groupAttachment = { libraryID: 2, key: "GROUP123" };

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
  buildOpenPDFURI(groupAttachment, 3, "A1B2C3"),
  "zotero://open-pdf/groups/12345/items/GROUP123?page=3&annotation=A1B2C3",
  "group library URI must preserve group prefix and annotation",
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

function stubItem(fields, extra = {}) {
  return {
    ...extra,
    getField(name) {
      return fields[name] || "";
    },
  };
}

const htmlAttachment = stubItem(
  { title: "Attachment <PDF>" },
  { libraryID: 1, key: "HTMLPDF1", attachmentContentType: "application/pdf" },
);
const htmlParent = stubItem(
  { title: "Paper <script>alert(1)</script>", date: "2026", DOI: "10.0000/test" },
  { key: "PARENT1" },
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
assert.ok(htmlEntry.openPDFURI.endsWith("?page=5"), "entry must receive page-only open PDF URI");
assert.strictEqual(htmlEntry.annotationKey, null, "invalid annotation key must be normalized to null");
assert.ok(htmlEntry.sourceRegion, "entry must receive source region metadata");

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
assert.strictEqual(metadata.entries[0].open_pdf_uri, "zotero://open-pdf/library/items/HTMLPDF1?page=5");
assert.strictEqual(metadata.entries[0].quality_estimate, "60-220 KB/image");
assert.strictEqual(metadata.entries[0].source_region.coordinate_system, "normalized_page_rect");
assert.strictEqual(metadata.entries[0].annotation_key, null);

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

const helperImages = Array.from({ length: 5 }, (_, index) => ({ file_path: `image-${index}.jpg` }));
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 2;
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"] = 3;
const pageLimitedImages = limitOriginalImagesForImport({ images: helperImages }, "page");
assert.strictEqual(pageLimitedImages.images.length, 2, "page import must truncate over-cap helper reports");
assert.strictEqual(pageLimitedImages.omittedCount, 3, "page import must report skipped images");
assert.strictEqual(pageLimitedImages.maxImages, 2);
const documentLimitedImages = limitOriginalImagesForImport({ images: helperImages }, "document");
assert.strictEqual(documentLimitedImages.images.length, 3, "document import must truncate over-cap helper reports");
assert.strictEqual(documentLimitedImages.omittedCount, 2, "document import must report skipped images");
assert.strictEqual(documentLimitedImages.maxImages, 3);
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxPageImages"] = 9999;
const hardLimitedPageImages = limitOriginalImagesForImport({ images: helperImages }, "page");
assert.strictEqual(hardLimitedPageImages.images.length, 5, "page import must not drop in-range reports");
assert.strictEqual(hardLimitedPageImages.maxImages, 500, "page import must hard-clamp edited prefs");
const hugeHelperImages = Array.from({ length: 501 }, (_, index) => ({ file_path: `huge-${index}.jpg` }));
const hugeLimitedPageImages = limitOriginalImagesForImport({ images: hugeHelperImages }, "page");
assert.strictEqual(hugeLimitedPageImages.images.length, 500, "page import must truncate at the hard cap");
assert.strictEqual(hugeLimitedPageImages.omittedCount, 1, "page import must report hard-cap skips");
context.Zotero.Prefs.values["extensions.pdfImageSaver.maxDocumentImages"] = 9999;
const hugeDocumentImages = Array.from({ length: 2001 }, (_, index) => ({ file_path: `doc-${index}.jpg` }));
const hugeLimitedDocumentImages = limitOriginalImagesForImport({ images: hugeDocumentImages }, "document");
assert.strictEqual(hugeLimitedDocumentImages.images.length, 2000, "document import must truncate at the hard cap");
assert.strictEqual(hugeLimitedDocumentImages.omittedCount, 1, "document import must report hard-cap skips");
assert.strictEqual(hugeLimitedDocumentImages.maxImages, 2000, "document import must hard-clamp edited prefs");

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

console.log("open-pdf uri tests ok");
