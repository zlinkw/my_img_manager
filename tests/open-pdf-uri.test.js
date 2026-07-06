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
    Attachments: {
      imported: [],
      async importFromFile(options) {
        this.imported.push(options);
      },
    },
  },
  Services: {
    appinfo: { OS: "WINNT" },
  },
  IOUtils: {
    exists: async () => false,
    remove: async () => {},
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
  buildOriginalImageTitle,
  buildOpenPDFURI,
  buildSourceRegion,
  calculateCanvasCrop,
  filterExistingOriginalImagesForImport,
  formatHelperFailure,
  getActiveReader,
  getContextPageIndex,
  getPDFViewerContextCandidate,
  importOriginalImages,
  limitOriginalImagesForImport,
  normalizeBBoxNormalized,
  normalizeHelperFilePath,
  normalizeImageContentType,
  normalizeHelperSchemaText,
  normalizeHelperStatusText,
  normalizeHelperWarningMessages,
  normalizeOriginalImageForImport,
  normalizePageIndex,
  normalizePageNumber,
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
assert.strictEqual(
  noisySourceMetadata.entries[0].open_pdf_uri,
  "zotero://open-pdf/library/items/UNKNOWN?page=5",
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
assert.strictEqual(
  malformedPageMetadata.entries[0].open_pdf_uri,
  "zotero://open-pdf/library/items/HTMLPDF1?page=7",
);

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
    occurrence: 5,
  },
  "helper image normalization must produce scalar import fields",
);
assert.strictEqual(
  buildOriginalImageTitle(noisyParent, noisyAttachment, { page_number: { bad: true }, occurrence: ["bad"] }),
  "PDF - original p1 image 1",
  "original attachment title must normalize malformed source, page, and occurrence fields",
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
assert.ok(noisyHelperFailure.includes("Optional original extraction failed: unknown"), "malformed helper status must fall back to unknown");
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
  "Optional original extraction failed: unknown",
  "missing helper reports must format to an unknown failure without throwing",
);

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

async function runAsyncAssertions() {
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
  assert.deepStrictEqual(
    context.Zotero.Attachments.imported.map((entry) => entry.file),
    [existingOriginalFile, laterExistingOriginalFile],
    "full import must pass only existing helper files to Zotero import",
  );

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
    context.Zotero.Attachments.imported.map((entry) => entry.file),
    [existingOriginalFile, laterExistingOriginalFile],
    "failed Zotero imports must be omitted while later valid imports continue",
  );

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
}

runAsyncAssertions()
  .then(() => {
    console.log("open-pdf uri tests ok");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
