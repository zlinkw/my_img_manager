const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
if (process.platform === "win32") {
  execFileSync(path.join(root, "content", "runtime", "python", "python.exe"),
    ["-X", "utf8", path.join(__dirname, "region-raster-capture.py")], { cwd: root, stdio: "inherit" });
}
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
  // Web globals the Zotero runtime provides; the sharing package codec looks them up at runtime.
  TextEncoder,
  TextDecoder,
  Blob,
  DecompressionStream,
  Uint8Array,
};
vm.createContext(context);
context.globalThis = context;
vm.runInContext(source, context, { filename: "pdf-image-saver.js" });
context.PdfImageSaver.init({ id: "pdf-image-saver@zlk.local", version: "0.1.134-test", rootURI: "resource://pdf-image-saver/" });

const api = context.PdfImageSaver.__test__;
assert.ok(api, "release exports test helpers");
assert.equal(api.normalizeImageCategoryKey("HEATMAP"), "heatmap");
assert.equal(api.normalizeImageCategoryKey("unknown"), "auto");

const region = api.buildSourceRegion([0.1, 0.2, 0.4, 0.6]);
assert.equal(region.coordinate_system, "normalized_page_rect");
assert.equal(region.label, "横向 10.0%–40.0%；纵向 20.0%–60.0%；宽 30.0% × 高 40.0%");

// Browser-audit fixtures must decode in a real engine, so every image is a self-contained SVG
// data URL with the exact intrinsic size the viewer asserts at 1:1 zoom.
function svgDataURL(width, height, caption, background, accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="${background}"/>`
    + `<rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.88)}" height="${Math.round(height * 0.74)}" fill="none" stroke="${accent}" stroke-width="6"/>`
    + `<path d="M${Math.round(width * 0.1)} ${Math.round(height * 0.78)} L${Math.round(width * 0.38)} ${Math.round(height * 0.52)} L${Math.round(width * 0.62)} ${Math.round(height * 0.6)} L${Math.round(width * 0.9)} ${Math.round(height * 0.22)}" fill="none" stroke="${accent}" stroke-width="10"/>`
    + `<text x="${Math.round(width * 0.1)}" y="${Math.round(height * 0.26)}" font-family="Arial" font-size="${Math.max(12, Math.round(height * 0.07))}" fill="${accent}">${caption}</text>`
    + "</svg>";
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

// Index previews are contractually raster-only, so the audited clip fixtures need a real PNG.
const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

function pngDataURL(width, height, [red, green, blue]) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (stride + 1);
    raw[rowStart] = 0;
    for (let column = 0; column < width; column += 1) {
      const pixel = rowStart + 1 + column * 3;
      const shade = (row + column) % 40 < 4 ? 0.55 : 1;
      raw[pixel] = Math.round(red * shade);
      raw[pixel + 1] = Math.round(green * shade);
      raw[pixel + 2] = Math.round(blue * shade);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

const palette = (...hexes) => hexes.map((hex, index) => ({
  hex,
  role: index === 0 ? "dominant" : `accent-${index}`,
  hue: 0.5,
  saturation: 0.4,
  lightness: 0.5,
  population: 1 / (index + 1),
}));

// Eight records: one unmatched import (source filter), exactly one heatmap (category filter),
// one uniquely searchable title, distinct sizes for size sorting, and distinct categories so a
// filter can hide an already-selected image.
const libraryRecords = [
  {
    imageID: "fixture-metric-curve",
    title: "Segmentation <script> benchmark",
    year: "2026",
    doi: "10.1000/pis.2026.0001",
    pageNumber: 2,
    imageURL: svgDataURL(1200, 800, "Mean IoU over training epochs", "#ffffff", "#176b3a"),
    imageBytes: 120013,
    category: "metric_curve",
    colorFamily: "green",
    styleTags: ["plot", "curve", "metrics"],
    palette: palette("#176b3a", "#25313a", "#f4f7f8"),
    quality: "high",
    renderedWidth: 1200,
    renderedHeight: 800,
    createdAt: "2026-07-19T01:20:00.000Z",
    pdfAttachmentKey: "PDF00001",
    openPDFURI: "zotero://open-pdf/library/items/PDF00001?page=2",
    selectItemURI: "zotero://select/library/items/ITEM0001",
    // The gallery note audit reads this record: the first visible card is also the first table
    // row, so one fixture note covers the card block, the table column and the viewer meta.
    userNote: "复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。",
  },
  {
    imageID: "fixture-heatmap",
    title: "论文图像示例 2",
    year: "2025",
    doi: "10.1000/pis.2025.0002",
    pageNumber: 3,
    imageURL: svgDataURL(960, 720, "Confusion matrix", "#ffffff", "#1d4ed8"),
    imageBytes: 98304,
    category: "heatmap",
    colorFamily: "blue",
    styleTags: ["heatmap", "matrix", "color-scale"],
    palette: palette("#1d4ed8", "#93c5fd"),
    quality: "medium",
    renderedWidth: 960,
    renderedHeight: 720,
    createdAt: "2026-07-19T01:10:00.000Z",
    pdfAttachmentKey: "PDF00002",
    openPDFURI: "zotero://open-pdf/library/items/PDF00002?page=3",
  },
  {
    imageID: "fixture-architecture",
    title: "多尺度特征网络结构",
    year: "2024",
    pageNumber: 5,
    imageURL: svgDataURL(1024, 640, "Multi-scale backbone", "#ffffff", "#7c3aed"),
    imageBytes: 250880,
    category: "architecture",
    colorFamily: "purple",
    styleTags: ["network", "blocks", "connections"],
    palette: palette("#7c3aed", "#c4b5fd"),
    quality: "high",
    renderedWidth: 1024,
    renderedHeight: 640,
    createdAt: "2026-07-19T01:00:00.000Z",
    pdfAttachmentKey: "PDF00003",
    openPDFURI: "zotero://open-pdf/library/items/PDF00003?page=5",
  },
  {
    imageID: "fixture-table",
    title: "消融实验科研表格",
    year: "2023",
    pageNumber: 7,
    imageURL: svgDataURL(880, 560, "Ablation study", "#ffffff", "#b45309"),
    imageBytes: 65536,
    category: "table",
    colorFamily: "orange",
    styleTags: ["table", "grid", "cells"],
    palette: palette("#b45309", "#fed7aa"),
    quality: "medium",
    renderedWidth: 880,
    renderedHeight: 560,
    createdAt: "2026-07-19T00:50:00.000Z",
    parentItemKey: "ITEM0004",
    selectItemURI: "zotero://select/library/items/ITEM0004",
  },
  {
    imageID: "fixture-qualitative",
    title: "分割定性结果对比",
    year: "2026",
    pageNumber: 9,
    imageURL: svgDataURL(1120, 700, "Qualitative comparison", "#ffffff", "#0f766e"),
    imageBytes: 184320,
    category: "qualitative",
    colorFamily: "cyan",
    styleTags: ["result-panels", "visual-comparison", "compare"],
    palette: palette("#0f766e", "#99f6e4"),
    quality: "high",
    renderedWidth: 1120,
    renderedHeight: 700,
    createdAt: "2026-07-19T00:40:00.000Z",
    pdfAttachmentKey: "PDF00005",
    openPDFURI: "zotero://open-pdf/library/items/PDF00005?page=9",
  },
  {
    imageID: "fixture-distribution",
    title: "训练损失分布图",
    year: "2025",
    pageNumber: 11,
    imageURL: svgDataURL(900, 600, "Loss distribution", "#ffffff", "#be123c"),
    imageBytes: 135168,
    category: "distribution",
    colorFamily: "red",
    styleTags: ["distribution", "points", "axes"],
    palette: palette("#be123c", "#fecdd3"),
    quality: "medium",
    renderedWidth: 900,
    renderedHeight: 600,
    createdAt: "2026-07-19T00:30:00.000Z",
    pdfAttachmentKey: "PDF00006",
    openPDFURI: "zotero://open-pdf/library/items/PDF00006?page=11",
  },
  {
    imageID: "fixture-pipeline",
    title: "方法流程示意",
    year: "2024",
    pageNumber: 13,
    imageURL: svgDataURL(1040, 520, "Method pipeline", "#ffffff", "#475569"),
    imageBytes: 90112,
    category: "pipeline",
    colorFamily: "gray",
    styleTags: ["flow", "steps", "boxes"],
    palette: palette("#475569", "#cbd5e1"),
    quality: "low",
    renderedWidth: 1040,
    renderedHeight: 520,
    createdAt: "2026-07-19T00:20:00.000Z",
    pdfAttachmentKey: "PDF00007",
    openPDFURI: "zotero://open-pdf/library/items/PDF00007?page=13",
  },
  {
    imageID: "fixture-imported",
    title: "外部导入医学影像",
    year: "2022",
    pageNumber: 15,
    imageURL: svgDataURL(840, 840, "Imported scan", "#ffffff", "#334155"),
    imageBytes: 307200,
    category: "photo",
    colorFamily: "gray",
    styleTags: ["photo-ref", "square"],
    palette: palette("#334155", "#e2e8f0"),
    quality: "high",
    renderedWidth: 840,
    renderedHeight: 840,
    createdAt: "2026-07-19T00:10:00.000Z",
    originType: "shared",
    sourceMatchStatus: "unmatched",
  },
];

const fixture = api.buildGlobalImageLibraryHTML({
  records: libraryRecords,
  generatedAt: "2026-07-19T02:00:00.000Z",
  bridgeURL: "http://127.0.0.1:23119/pdf-image-saver/bridge",
  bridgeToken: "token",
});
const inlinedViewerHTML = api.buildGlobalImageLibraryHTML({
  records: libraryRecords,
  generatedAt: "2026-07-19T02:00:00.000Z",
  vendorScripts: ["function OpenSeadragon(){}", "var fabric={};"],
});
assert.ok(inlinedViewerHTML.includes("<script>function OpenSeadragon(){}</script>"), "gallery HTML must inline OpenSeadragon instead of depending on a missing vendor file");
assert.ok(inlinedViewerHTML.includes("<script>var fabric={};</script>"), "gallery HTML must inline Fabric instead of depending on a missing vendor file");
assert.ok(!inlinedViewerHTML.includes('src="vendor/openseadragon.min.js"'), "inlined gallery HTML must not fall back to an external OpenSeadragon src");
assert.ok(fixture.includes('src="vendor/openseadragon.min.js"'), "the unaudited fallback page still references classic vendor scripts");


for (const text of [
  'data-paper-image-library-version="45"',
  "刷新图库",
  "导入分享包",
  "分享所选",
  "删除所选",
  'id="library-viewer"',
  "热图／矩阵图",
  // A file:// gallery silently discards the download attribute and would navigate the list away,
  // so the page has to intercept those clicks and pull the bytes back through the plugin.
  'location.protocol !== "file:"',
  "readImageBytes",
  "已下载原图；图库保持打开",
]) assert.ok(fixture.includes(text), `gallery must contain ${text}`);

// The browser audit reads these fixture properties directly. Assert them here so the fixture
// cannot silently drift out of the audit's reach again.
const cardMatches = fixture.match(/<article class="library-card"/g) || [];
assert.equal(cardMatches.length, libraryRecords.length, "gallery fixture must render one card per record");
assert.equal(libraryRecords.length, 8, "browser audit expects an eight-record gallery fixture");
// Rendered attributes, not the raw record fields: a misnamed record key would otherwise
// normalize every card to the same fallback category and silently disarm the filter audits.
const renderedCategories = [...fixture.matchAll(/<article class="library-card"[^>]*data-category="([^"]*)"/g)].map((match) => match[1]);
assert.equal(renderedCategories.length, libraryRecords.length, "every card must expose its filter category");
assert.equal(new Set(renderedCategories).size, libraryRecords.length, "gallery fixture must render distinct filter categories");
assert.equal(
  renderedCategories.filter((value) => value === "heatmap").length,
  1,
  "category filtering audit needs exactly one heatmap record",
);
const renderedSources = [...fixture.matchAll(/<article class="library-card"[^>]*data-source="([^"]*)"/g)].map((match) => match[1]);
assert.equal(
  renderedSources.filter((value) => value === "unmatched").length,
  1,
  "source filtering audit needs exactly one card rendered as unmatched",
);
assert.equal(
  libraryRecords.filter((record) => record.sourceMatchStatus === "unmatched").length,
  1,
  "source filtering and unmatched-viewer audits need exactly one unmatched record",
);
assert.ok(
  libraryRecords.slice(1).every((record) => !record.title.includes("论文图像示例 2") || record.imageID === "fixture-heatmap"),
  "search audit needs a uniquely searchable title",
);
assert.equal(
  new Set(libraryRecords.map((record) => record.imageBytes)).size,
  libraryRecords.length,
  "size sorting audit needs distinct byte counts",
);
assert.equal(
  libraryRecords.reduce((largest, record) => Math.max(largest, record.imageBytes), 0),
  libraryRecords[libraryRecords.length - 1].imageBytes,
  "size sorting audit needs an unambiguous largest original",
);
assert.ok(
  libraryRecords.every((record) => record.imageURL.startsWith("data:image/svg+xml;base64,")),
  "every audited gallery image must be self-contained so it decodes in a real browser",
);
assert.equal(libraryRecords[0].renderedWidth, 1200, "1:1 viewer zoom audit needs a 1200px original");
// The gallery defaults to newest-first, and the audit reads the first card and first table row.
// Keep record order equal to display order so those two never disagree.
const savedTimes = libraryRecords.map((record) => Date.parse(record.createdAt));
assert.ok(
  savedTimes.every((value, index) => index === 0 || savedTimes[index - 1] > value),
  "fixture order must match the default newest-first gallery order",
);
assert.ok(
  fixture.includes("Segmentation_script_benchmark_2026_第2页_图001.svg"),
  "download filenames must keep readable provenance and a safe extension",
);
assert.ok(fixture.includes("117.2 KB"), "gallery must format the audited original size");
assert.ok(fixture.includes("1200 × 800 像素"), "gallery must state the audited original dimensions");

// Note rendering: the browser audit drives the note editor, so both states must exist in the
// fixture — one record with a description and the rest without.
assert.equal(
  libraryRecords.filter((record) => (record.userNote || "").trim()).length,
  1,
  "note audit needs exactly one described record so the empty state stays covered too",
);
assert.ok(fixture.includes('class="note-text" data-note-text="fixture-metric-curve"'), "gallery must render the described card note block");
assert.ok(fixture.includes("复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。"), "gallery must render the stored description text");
assert.ok(fixture.includes(">编辑描述</button>"), "a described record must offer 编辑描述");
assert.ok(fixture.includes(">添加描述</button>"), "an undescribed record must offer 添加描述");
assert.equal(
  (fixture.match(/data-note-cell="/g) || []).length,
  libraryRecords.length,
  "every table row must expose its description cell",
);
assert.ok(
  fixture.includes('data-note-cell="fixture-metric-curve" title="复现实验第 2 轮，阈值 0.5；定稿前需替换为最终版曲线。"'),
  "the described row must carry the full description as its hover title",
);
assert.ok(fixture.includes(">无描述</td>"), "rows without a description must state 无描述 instead of an empty cell");

const indexAttachment = { libraryID: 1, key: "PDF00001", attachmentContentType: "application/pdf" };
const indexParentItem = { key: "ITEM0001", getField(field) { return field === "title" ? "科研论文" : ""; } };

// The 高清 tier used to be limited by whatever resolution the reader happened to have on screen,
// which is why saved figures came out soft. The capture now asks pdf.js to re-render just the
// selected region at a chosen resolution, and these fakes pin the scale-and-offset maths and the
// byte budget without needing a real canvas or a live reader.
function fakeCaptureDocument({ encodedBytes = 4096 } = {}) {
  const created = [];
  const makeCanvas = (width, height) => {
    const canvas = {
      width,
      height,
      ownerDocument: null,
      getContext: () => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        fillRect() {},
        drawImage() {},
      }),
      toDataURL: (type) => {
        const kind = String(type || "image/png").replace("image/", "");
        const body = "A".repeat(Math.max(4, Math.round((encodedBytes / 3) * 4)));
        return `data:image/${kind};base64,${body}`;
      },
    };
    canvas.ownerDocument = { createElement: (tag) => makeCanvas(1, 1) };
    created.push(canvas);
    return canvas;
  };
  return { created, createElement: (tag) => makeCanvas(1, 1) };
}

function fakePDFPage({ width = 612, height = 792 } = {}) {
  const viewports = [];
  return {
    viewports,
    getViewport(options = {}) {
      const scale = Number(options.scale) || 1;
      viewports.push({ scale, offsetX: options.offsetX || 0, offsetY: options.offsetY || 0 });
      return { width: width * scale, height: height * scale, scale };
    },
    render(renderContext) {
      renderContext.canvasContext?.fillRect?.(0, 0, 1, 1);
      return { promise: Promise.resolve() };
    },
  };
}

void (async () => {
  const page = fakePDFPage();
  const document = fakeCaptureDocument();
  const rendered = await api.renderPDFRegionCanvas({
    pdfPage: page,
    bboxNormalized: [0, 0, 0.5, 0.5],
    dpi: 600,
    ownerDocument: document,
  });
  assert.ok(rendered, "a region re-render must succeed with a usable pdf.js page");
  assert.equal(rendered.scale.toFixed(3), (600 / 72).toFixed(3), "600 DPI must map to an 8.33x render scale");
  assert.equal(rendered.width, Math.round(306 * (600 / 72)), "region width must be the page-space width times the scale");
  assert.equal(rendered.height, Math.round(396 * (600 / 72)), "region height must be the page-space height times the scale");
  const render = page.viewports.at(-1);
  assert.equal(render.offsetX, 0, "a top-left region needs no viewport offset");
  assert.equal(render.offsetY, 0, "a top-left region needs no vertical offset");

  const insetPage = fakePDFPage();
  const inset = await api.renderPDFRegionCanvas({
    pdfPage: insetPage,
    bboxNormalized: [0.25, 0.25, 0.75, 0.75],
    dpi: 600,
    ownerDocument: fakeCaptureDocument(),
  });
  const scale = 600 / 72;
  const insetRender = insetPage.viewports.at(-1);
  assert.equal(insetRender.offsetX, -0.25 * 612 * scale, "the viewport must shift left by the region origin");
  assert.equal(insetRender.offsetY, -0.25 * 792 * scale, "the viewport must shift up by the region origin");
  assert.equal(inset.width, Math.round(306 * scale), "an inset region must keep its own size");

  // A whole-page selection at 600 DPI would want 33 megapixels, so the Zotero-matching 16 MP
  // ceiling has to bite rather than blowing up the canvas.
  const fullPage = await api.renderPDFRegionCanvas({
    pdfPage: fakePDFPage(),
    bboxNormalized: [0, 0, 1, 1],
    dpi: 600,
    ownerDocument: fakeCaptureDocument(),
  });
  assert.ok(fullPage.width * fullPage.height <= 16 * 1024 * 1024, "a capture must never exceed the pixel budget");
  assert.ok(fullPage.scale < 600 / 72, "the pixel ceiling must clamp a whole-page 600 DPI request");

  // A reader zoomed in further than the requested DPI must never end up with fewer pixels.
  const zoomed = await api.renderPDFRegionCanvas({
    pdfPage: fakePDFPage(),
    bboxNormalized: [0, 0, 0.5, 0.5],
    dpi: 96,
    minScale: 5,
    ownerDocument: fakeCaptureDocument(),
  });
  assert.ok(zoomed.scale >= 5, "the re-render must never go below the resolution already on screen");

  const smallDocument = fakeCaptureDocument({ encodedBytes: 4096 });
  const encoded = api.encodeCaptureCanvas(smallDocument.createElement("canvas"), {
    format: "png",
    maxBytes: 1024 * 1024,
  });
  assert.equal(encoded.format, "png", "a small PNG must stay PNG");
  assert.ok(encoded.bytes <= 1024 * 1024, "an in-budget capture must not be re-encoded");

  const hugeDocument = fakeCaptureDocument({ encodedBytes: 40 * 1024 * 1024 });
  const shrunk = api.encodeCaptureCanvas(hugeDocument.createElement("canvas"), {
    format: "png",
    maxBytes: 1024 * 1024,
  });
  assert.ok(shrunk.bytes <= 40 * 1024 * 1024, "an oversized capture must be brought down rather than stored as-is");
  assert.equal(shrunk.format, "jpeg", "an oversized PNG must fall back to JPEG before being stored");
})();

// A vector crop is stored as SVG, and the database identifies a stored image by sniffing its bytes
// rather than a stored extension column, so the sniffer must recognise SVG before anything that
// gets written can be served back out or handed to the sharing package.
{
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
  const svgBytes = Buffer.from(svgText, "utf8");
  const withProlog = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>${svgText}`, "utf8");
  assert.ok(api.isSVGImageBytes(svgBytes), "a bare svg document must be recognised as an image");
  assert.ok(api.isSVGImageBytes(withProlog), "an xml prolog must not hide the svg signature");
  assert.equal(api.getDatabaseImageFileType(svgBytes)?.extension, "svg", "svg must map to the svg extension");
  assert.equal(api.getDatabaseImageFileType(svgBytes)?.mimeType, "image/svg+xml", "svg must map to the svg mime type");
  assert.ok(!api.isSVGImageBytes(Buffer.from("not an image at all", "utf8")), "plain text must not be treated as svg");
  assert.ok(!api.isSVGImageBytes(null), "a missing blob must not be treated as svg");
  assert.equal(api.getDatabaseImageFileType(pngDataURLToBytes(pngDataURL(4, 4, [1, 2, 3])))?.extension, "png", "raster sniffing must keep working");
  assert.equal(api.shouldPreferVectorCapture({ format: "svg", hasVectorContent: true, hasRasterContent: false, byteCount: 2 * 1024 * 1024 }), true,
    "native PDF geometry without bitmaps must be saved as SVG");
  assert.equal(api.shouldPreferVectorCapture({ format: "svg", hasVectorContent: false, hasRasterContent: true, byteCount: 1000 }), false,
    "a bitmap-only PDF region cannot be saved as vector");
  assert.equal(api.shouldPreferVectorCapture({ format: "svg", hasVectorContent: true, hasRasterContent: true, byteCount: 1000 }), false,
    "mixed raster and vector SVG must not be described as pure vector");
  assert.equal(api.shouldPreferVectorCapture({ format: "svg", hasVectorContent: true, byteCount: 1000 }), false,
    "an older helper without a bitmap audit must not pass the pure vector gate");
  assert.equal(api.shouldPreferVectorCapture({ format: "png", hasVectorContent: true, hasRasterContent: false, byteCount: 1000 }), false,
    "a PNG cannot pass the SVG-only save gate");
  assert.equal(api.shouldPreferVectorCapture({ format: "svg", hasVectorContent: true, hasRasterContent: false, byteCount: 26 * 1024 * 1024 }), false,
    "oversized SVG must respect the vector byte cap");
}

assert.equal(
  api.addonResourceURL("content/vendor/openseadragon.min.js"),
  "resource://pdf-image-saver/content/vendor/openseadragon.min.js",
  "gallery vendor files must be read from the add-on root, not from a guessed disk path",
);
assert.equal(
  api.resolveBundledRuntimeSourcePath("python/python.exe"),
  "content/runtime/python/python.exe",
  "the runtime manifest lists files relative to content/runtime, so copies must prefix that path",
);
assert.equal(
  api.resolveBundledRuntimeSourcePath("content/runtime/python/python.exe"),
  "content/runtime/python/python.exe",
  "an already-prefixed runtime path must not be prefixed twice",
);
{
  const bytes = Uint8Array.from([60, 115, 118, 103, 62]);
  context.Cc = { "@mozilla.org/binaryinputstream;1": { createInstance() {
    let offset = 0;
    return { setInputStream() {}, available() { return bytes.length - offset; },
      readByteArray(count) { const chunk = Array.from(bytes.slice(offset, offset + count)); offset += count; return chunk; },
      close() {} };
  } } };
  context.Ci = { nsIBinaryInputStream: {} };
  const zipReader = { getEntry() { return { realSize: bytes.length }; }, getInputStream() { return {}; } };
  assert.equal(Buffer.from(api.readZipEntryBytes(zipReader, "content/runtime/runtime-manifest.json")).toString("utf8"), "<svg>",
    "the Zotero 10 binary stream API must read archive bytes without losing data");
  delete context.Cc;
  delete context.Ci;
}
assert.equal(api.LIBRARY_VIEW_VENDOR_FILES.length, 2, "the generated gallery must copy both classic-script viewer libraries");
assert.equal(api.LIBRARY_VIEW_VENDOR_FILES[0], "content/vendor/openseadragon.min.js", "OpenSeadragon must ship as a classic script");
assert.equal(api.LIBRARY_VIEW_VENDOR_FILES[1], "content/vendor/fabric.min.js", "Fabric must ship as a classic script");
assert.ok(source.includes('drawer: "canvas"'), "OpenSeadragon must use the canvas drawer on file:// galleries");
assert.ok(!source.includes('data-editor-tool="pan"'), "Ctrl+drag must pan without a separate pan tool");
assert.ok(!source.includes('data-editor-tool="line"') && !source.includes('data-editor-tool="rect"'), "only brush, eraser and text tools may remain");
assert.ok(source.includes('id="viewer-vector"'), "SVG originals must use a native image layer for vector display");
assert.ok(source.includes('Ctrl+拖动平移'), "viewer must explain modifier-assisted panning");
assert.ok(!source.includes("EraserBrush"), "Fabric 6 has no EraserBrush; eraser must click-delete objects");
assert.ok(source.includes("viewer-editor-help"), "the annotation toolbar must show usage text");
assert.ok(source.includes('b: "brush"'), "annotation tools must have keyboard shortcuts");
assert.ok(source.includes("forwardWheelToOSD"), "armed annotation tools must still forward wheel zoom to OpenSeadragon");



assert.equal(
  api.fileURLToLocalPath("jar:file:///C:/Users/ZLK/AppData/Roaming/Zotero/Zotero/Profiles/aalpald9.default/extensions/pdf-image-saver@zlk.local.xpi!/"),
  "C:\\Users\\ZLK\\AppData\\Roaming\\Zotero\\Zotero\\Profiles\\aalpald9.default\\extensions\\pdf-image-saver@zlk.local.xpi",
  "a jar:file XPI URI must resolve to the local xpi path",
);
assert.equal(
  api.fileURLToLocalPath("file:///C%3A/Users/ZLK/AppData/Roaming/Zotero/Zotero/Profiles/aalpald9.default/extensions/pdf-image-saver%40zlk.local.xpi!/"),
  "C:\\Users\\ZLK\\AppData\\Roaming\\Zotero\\Zotero\\Profiles\\aalpald9.default\\extensions\\pdf-image-saver@zlk.local.xpi",
  "a broken file:// xpi! URI must still resolve to the local xpi path",
);
assert.ok(source.includes("nsIZipReader"), "packaged vendor and runtime files must be copied from the XPI zip");
assert.ok(fs.readFileSync(path.join(root, "scripts", "register-profile-xpi.mjs"), "utf8").includes("jar:file:///"), "profile XPI registration must record a jar:file rootURI");


function pngDataURLToBytes(dataURL) {
  return Buffer.from(String(dataURL).slice(String(dataURL).indexOf(",") + 1), "base64");
}

for (const [name, value] of [
  ["PDF_IMAGE_SAVER_BROWSER_SINGLE_FIXTURE", api.buildIndexHTML({
    attachment: indexAttachment,
    parentItem: indexParentItem,
    scope: "clip",
    qualityKey: "medium",
    indexKey: "preview-index:v1:clip:medium:n1:test",
    entries: [{ id: "entry-1", pageIndex: 0, pageNumber: 1, bboxNormalized: [0.1, 0.1, 0.5, 0.5], dataURL: pngDataURL(400, 300, [37, 49, 58]), byteCount: 8, renderedWidth: 400, renderedHeight: 300, quality: "medium", detector: "manual_selection", imageCategory: "auto" }],
  })],
  // Both entries stay on page 5 with a roman front-matter page label so the audit covers the
  // "第 5 页（文献页码 v）" rendering and the legacy `auto` token shown as 未分类.
  ["PDF_IMAGE_SAVER_BROWSER_MULTI_FIXTURE", api.buildIndexHTML({
    attachment: indexAttachment,
    parentItem: indexParentItem,
    scope: "clip",
    qualityKey: "high",
    indexKey: "preview-index:v1:clip:high:n2:test",
    entries: [1, 2].map((ordinal) => ({ id: `entry-${ordinal}`, pageIndex: 4, pageNumber: 5, pageLabel: "v", bboxNormalized: [0.1, 0.1 + (ordinal - 1) * 0.3, 0.5, 0.4 + (ordinal - 1) * 0.3], dataURL: pngDataURL(400, 300, [23, 107, 58]), byteCount: 8, renderedWidth: 400, renderedHeight: 300, quality: "high", detector: "manual_selection", imageCategory: "auto" })),
  })],
  ["PDF_IMAGE_SAVER_BROWSER_LIBRARY_FIXTURE", fixture],
  // Same records, no bridge: the offline audit checks that browsing stays usable while every
  // management action degrades to a read-only Chinese explanation.
  ["PDF_IMAGE_SAVER_BROWSER_OFFLINE_LIBRARY_FIXTURE", api.buildGlobalImageLibraryHTML({
    records: libraryRecords,
    generatedAt: "2026-07-19T02:00:00.000Z",
  })],
]) {
  // Every generated page embeds its whole behaviour in one inline script that is itself produced
  // from an outer template literal. One stray backslash (`\n` inside a regex, say) is consumed by
  // that outer template and leaves the page syntactically dead while the markup still looks right,
  // so the generated script is parsed here instead of trusted.
  const scripts = [...value.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 1, `${name} must embed its page script`);
  scripts.forEach((match, index) => {
    assert.doesNotThrow(
      () => new vm.Script(match[1], { filename: `${name}-script-${index}.js` }),
      `${name} script ${index} must parse as valid JavaScript`,
    );
  });
  const target = process.env[name];
  if (target) fs.writeFileSync(target, value, "utf8");
}

// Internal error categories are English on purpose; what the user reads must not be.
for (const [internal, chinese] of [
  ["Capture failed: canvas missing.", "无法获取当前 PDF 页面的画布。"],
  ["Helper: Python n/a.", "未找到 Python。"],
  ["Helper failed: script missing.", "插件内置的原图提取脚本缺失或版本不匹配。"],
  ["Storage failed: shared SQLite runtime unavailable.", "当前 Zotero 无法打开外部图片库数据库。"],
  ["Storage failed: source region identity collision.", "同一原文区域已属于另一条图片记录，未覆盖已有记录。"],
]) assert.equal(api.translateUserFacingErrorDetail(internal), chinese, `${internal} must read as Chinese`);
assert.equal(
  api.translateUserFacingErrorDetail("Storage failed: brand new untranslated case."),
  "详细原因请查看错误控制台。",
  "an untranslated internal error must fall back instead of leaking English",
);
assert.equal(
  api.translateUserFacingErrorDetail("Storage failed: index import failed. NS_ERROR_FILE_ACCESS_DENIED"),
  "无法写入 Zotero 图片预览附件。",
  "a known message carrying an inner cause must keep its explanation",
);
assert.equal(
  api.formatUserFacingError(new Error("Storage failed: index import failed. NS_ERROR_FILE_ACCESS_DENIED")),
  "保存失败：无法写入 Zotero 图片预览附件。",
  "toast text must classify and explain a composed storage failure",
);
// Errors carrying a runtime value must keep that value in Chinese, not collapse to the hint.
for (const [internal, chinese] of [
  ["Byte cap: index large (12.5 MB > 8 MB). Lower Q.", "图片索引过大（12.5 MB > 8 MB），请降低清晰度后重试。"],
  ["Storage failed: all 7 orig imports failed.", "7 张原图全部导入失败。"],
  ["Helper failed: bad schema v9", "原图提取脚本版本不匹配（v9）。"],
  ["Helper failed: exit 3, no report.", "高级原图提取进程异常退出（代码 3），没有返回结果。"],
  ["Optional helper timed out after 60 seconds.", "高级原图提取超过 60 秒未完成，已停止。"],
  ["Preview data URL bad.", "预览图片数据无效。"],
  ["Preview index empty.", "图片索引没有任何图片。"],
]) assert.equal(api.translateUserFacingErrorDetail(internal), chinese, `${internal} must keep its runtime detail in Chinese`);
assert.equal(
  api.formatUserFacingError(new Error("Byte cap: index large (12.5 MB > 8 MB). Lower Q.")),
  "大小限制：图片索引过大（12.5 MB > 8 MB），请降低清晰度后重试。",
  "byte-cap toasts must state the measured and allowed size",
);

// Diagnostics compose a Chinese section prefix with the failure detail. A raw English detail
// would still pass a naive "contains Chinese" check thanks to the prefix, so assert the whole line.
for (const [raw, expected] of [
  ["No PDF.", "未打开 PDF 阅读器。"],
  ["Helper: PyMuPDF n/a.", "高级原图：未安装 PyMuPDF。"],
  ["外部图片库：当前 Zotero 无法打开外部图片库数据库。", "外部图片库：当前 Zotero 无法打开外部图片库数据库。"],
]) assert.equal(api.formatDiagnosticWarning(raw), expected, `diagnostic warning must read as Chinese: ${raw}`);

// docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md forbids local Zotero identifiers in a `.pislib`.
// The builder whitelists fields today; this locks that so a new column cannot leak by accident.
const shareRow = {
  image_id: "fixture-share",
  title: "分享测试图",
  year: "2026",
  doi: "10.1000/pis.2026.9999",
  page_number: 4,
  created_at: "2026-07-19T03:00:00.000Z",
  image_category: "heatmap",
  color_family: "blue",
  quality: "high",
  rendered_width: 640,
  rendered_height: 480,
  // Local-only columns that live on the same database row and must never be shared.
  parent_item_key: "ITEM0009",
  pdf_attachment_key: "PDF00009",
  library_id: "1",
  group_id: "7",
  zotero_open_pdf_uri: "zotero://open-pdf/library/items/PDF00009?page=4",
  zotero_select_item_uri: "zotero://select/library/items/ITEM0009",
};
const sharePngBytes = Buffer.from(pngDataURL(8, 8, [10, 20, 30]).split(",")[1], "base64");
const sharedImage = api.buildSharedLibraryPackageImage(shareRow, sharePngBytes, "a".repeat(64));
assert.ok(sharedImage, "share builder must accept a valid image row");
for (const field of ["content_sha256", "mime_type", "image_base64", "title", "year", "doi", "page_number", "source_created_at"]) {
  assert.ok(field in sharedImage, `shared image must carry ${field}`);
}
const sharedText = JSON.stringify(api.buildSharedLibraryPackagePayload([sharedImage], "2026-07-19T03:00:00.000Z"));
const shareRowText = JSON.stringify(shareRow);
for (const forbidden of ["parent_item_key", "pdf_attachment_key", "library_id", "group_id", "zotero://", "ITEM0009", "PDF00009"]) {
  // Guard against a vacuous test: the identifier must really be on the source row.
  assert.ok(shareRowText.includes(forbidden), `share fixture must actually carry ${forbidden}`);
  assert.ok(!sharedText.includes(forbidden), `share package must not carry local identifier ${forbidden}`);
}
assert.equal(JSON.parse(sharedText).includes_pdf, false, "share package must declare that it excludes PDFs");

// Import rejection cases; asserted in the async section because decoding is async.
const encodePackage = (value) => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
const validPackage = JSON.parse(sharedText);
const IMPORT_REJECTIONS = [
  ["not json at all", "图片包内容损坏或不是有效格式。"],
  [{ ...validPackage, format: "some-other-format/v1" }, "图片包版本或格式不受支持。"],
  [{ ...validPackage, schema_version: 2 }, "图片包版本或格式不受支持。"],
  [{ ...validPackage, includes_pdf: true }, "图片包版本或格式不受支持。"],
  [{ ...validPackage, images: "not-an-array" }, "图片包版本或格式不受支持。"],
];

// One page-wording helper backs the index summary, the saved-entry facts, and diagnostics, so a
// physical page always carries its unit and a document page label only appears when it differs.
for (const [pageNumber, pageLabel, expected] of [
  [5, "v", "第 5 页（文献页码 v）"],
  [8, "8", "第 8 页"],
  [8, "", "第 8 页"],
  [8, null, "第 8 页"],
]) assert.equal(api.formatPageWithLabel(pageNumber, pageLabel), expected, `page wording for ${pageNumber}/${pageLabel}`);
assert.ok(
  api.formatDiagnosticsReport({ pdf_attachment: { key: "PDF00001" }, page_number: 8, page_label: "viii" }).includes("页面：第 8 页（文献页码 viii）"),
  "diagnostics must state the page with its unit and document page label",
);

// Sweep every message the runtime can throw. Anything that can surface in the UI must translate
// to Chinese; the few internal-only throws are listed with the reason they never reach a user.
const INTERNAL_ONLY_THROWS = new Set([
  "Process ended with topic: 1", // shutdown bookkeeping, resolved by the caller, never displayed
  "Addon binary read failed: 1", // logged while copying packaged files; the caller falls back
]);
const thrownMessages = [...source.matchAll(/new Error\((?:`([^`]*)`|"([^"]*)")\)/g)]
  .map((match) => match[1] ?? match[2])
  .filter((text) => text && /^[A-Za-z]/.test(text))
  .map((text) => text.replace(/\$\{[^{}]*\}/g, "1"))
  .filter((text, index, list) => list.indexOf(text) === index);
assert.ok(thrownMessages.length >= 40, `error sweep must find the runtime throws: ${thrownMessages.length}`);
const untranslated = thrownMessages.filter((text) => !INTERNAL_ONLY_THROWS.has(text)
  && api.translateUserFacingErrorDetail(text) === "详细原因请查看错误控制台。");
assert.deepEqual(untranslated, [], `these errors would reach the user with no explanation: ${untranslated.join(" | ")}`);

// Helper failure text: a known internal cause keeps its explanation; an unknown one degrades to
// the console hint rather than showing raw English.
assert.equal(api.formatHelperStatusLabel("timeout"), "运行超时", "helper status labels must be Chinese");
assert.equal(api.formatHelperStatusLabel("brand_new_status"), "助手返回异常", "an unknown helper status must still read as Chinese");
assert.equal(
  api.formatHelperFailure({ status: "error", warnings: ["Helper: PyMuPDF n/a."] }),
  "高级原图提取失败：助手运行失败（未安装 PyMuPDF）",
  "helper failure detail must translate a known internal cause",
);
assert.equal(
  api.formatHelperFailure({ status: "timeout", warnings: ["ETIMEDOUT spawn python"] }),
  "高级原图提取失败：运行超时（详细原因请查看错误控制台）",
  "helper failure detail must not surface a raw English cause",
);

assert.ok(!source.includes("pdf-image-saver-auto-button"), "automatic-capture toolbar is removed");
assert.ok(!source.includes("saveAutoDetectedPageImagePreviews"), "automatic-capture workflow is removed");
assert.ok(!source.includes("imageCoordinatesToCandidates"), "PDF.js automatic-candidate extraction is removed");
assert.ok(source.includes("saveClipPreviewIndex"), "manual clip workflow remains");
assert.ok(source.includes("publishPreviewEntriesToSharedLibrary"), "capture persists to shared SQLite");
assert.ok(source.includes("paper-image-library-view"), "gallery path contract remains");
assert.ok(source.includes("openWithKeyboard"), "reader choice menus must support keyboard opening");
assert.ok(source.includes("原图加载失败，请刷新图库"), "gallery originals must explain load failure in Chinese");
assert.ok(source.includes("syncInitialImageFailures"), "gallery originals must detect failures that completed before listeners attached");
assert.ok(source.includes(".batch-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }"), "mobile batch actions must use bounded equal columns instead of clipping labels");
assert.ok(fs.existsSync(path.join(root, "scripts", "register-profile-xpi.mjs")), "profile XPI registration helper must exist");
const preferencesSource = fs.readFileSync(path.join(root, "content", "preferences.js"), "utf8");
assert.ok(preferencesSource.includes("无法打开系统文件选择器"), "preference file-picker failure must provide visible guidance");
assert.ok(!source.includes("PdfImageSaverUpdateCheck"), "online update runtime is removed");
assert.ok(!source.includes("UPDATE_REPOSITORY"), "online update repository contract is removed");

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJSON.version, manifest.version, "package and XPI versions agree");
assert.equal(manifest.applications.zotero.strict_max_version, "11.*", "release supports the Zotero 10 and 11 profile-install range");
assert.equal(manifest.version, "0.1.151", "release candidate increments the installed release");

const expectedUpdateUrl = "https://raw.githubusercontent.com/zlinkw/my_img_manager/master/updates.json";
assert.equal(manifest.applications.zotero.update_url, expectedUpdateUrl, "Zotero 10 requires update_url and it must point at the static empty feed");
const updateFeed = JSON.parse(fs.readFileSync(path.join(root, "updates.json"), "utf8"));
assert.deepEqual(Object.keys(updateFeed), ["addons"], "update feed exposes only an addons map");
assert.deepEqual(updateFeed.addons, {}, "update feed must stay empty so no update is ever offered");
assert.ok(!fs.existsSync(path.join(root, ".github", "workflows")), "GitHub Actions release workflow is removed");
assert.ok(!fs.existsSync(path.join(root, "content", "update-check.js")), "update checker source is removed");

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const required of ["Zotero 10", "手动安装 XPI", "Windows", "外部 SQLite 原图库"]) {
  assert.ok(readme.includes(required), `public README must document ${required}`);
}

// Async checks run last and gate the success line, so a rejected assertion can never be reported
// as a pass.
async function verifyAsyncContracts() {
  const originalExists = context.IOUtils.exists;
  const originalReadUTF8 = context.IOUtils.readUTF8;
  const originalJoin = context.PathUtils.join;
  context.PathUtils.profileDir = "C:\\ZoteroProfile";
  context.PathUtils.join = (...parts) => {
    if (parts.slice(1).some((part) => /[\\/]/.test(part))) throw new Error("NS_ERROR_FILE_UNRECOGNIZED_PATH");
    return originalJoin(...parts);
  };
  context.IOUtils.exists = async (value) => /runtime-version\.txt$|python\.exe$|pdf_image_extract\.py$/.test(value);
  context.IOUtils.readUTF8 = async (value) => value.endsWith("runtime-version.txt")
    ? "python3.13.15-pymupdf1.28.2" : "zotero-pdf-image-saver/v1";
  context.Zotero.File = { async createDirectoryIfMissingAsync() {} };
  const runtime = await api.readBundledRuntimeState();
  assert.equal(runtime.ready, true, "an installer-staged runtime must be usable even when archive manifest reading fails");
  const commands = await api.getPythonCommands();
  assert.equal(commands.length, 1, "a staged Python must bypass unrelated interpreter discovery");
  assert.ok(commands[0].command.endsWith("python.exe"), "the staged interpreter must be selected");
  assert.ok((await api.ensureHelperScriptPath()).endsWith("pdf_image_extract.py"), "the staged helper script must work without archive reads");
  context.IOUtils.exists = originalExists;
  context.IOUtils.readUTF8 = originalReadUTF8;
  context.PathUtils.join = originalJoin;
  context.Zotero.File = {
    async getContentsFromURLAsync(url) {
      if (String(url).endsWith("openseadragon.min.js")) return "function OpenSeadragon(){}";
      if (String(url).endsWith("fabric.min.js")) return "var fabric={};";
      throw new Error("unexpected addon text url: " + url);
    },
    async getBinaryFromURLAsync(url) {
      if (String(url).endsWith("openseadragon.min.js")) return new TextEncoder().encode("function OpenSeadragon(){}");
      if (String(url).endsWith("fabric.min.js")) return new TextEncoder().encode("var fabric={};");
      throw new Error("unexpected addon binary url: " + url);
    },
  };
  const loaded = await api.loadLibraryViewVendorScripts();
  assert.equal(loaded.length, 2, "both viewer libraries must load as text from the add-on");
  assert.equal(loaded[0], "function OpenSeadragon(){}", "OpenSeadragon must load as gallery inline source");
  assert.equal(loaded[1], "var fabric={};", "Fabric must load as gallery inline source");

  const helperReport = { warnings: [] };
  await api.probeOptionalHelperAvailability(helperReport, async () => { throw new Error("Helper: Python n/a."); });
  assert.deepEqual(helperReport.warnings, ["高级原图：未找到 Python。"], "helper diagnostics must stay fully Chinese");
  assert.ok(
    helperReport.warnings.every((warning) => !/(?:Capture failed|Storage failed|Helper failed|Helper|Byte cap|Duplicate):/.test(warning)),
    "diagnostics must not leak an internal English category behind a Chinese prefix",
  );

  const availableReport = { warnings: [] };
  assert.equal(
    await api.probeOptionalHelperAvailability(availableReport, async () => [{ command: "python", args: [] }]),
    "python-available",
    "a discoverable interpreter must report as available",
  );
  assert.deepEqual(availableReport.warnings, [], "a successful helper probe must not warn");

  // A valid package still decodes, so the rejection cases below are not passing by accident.
  const decoded = await api.decodeSharedLibraryPackage(encodePackage(validPackage));
  assert.equal(decoded.format, api.SHARED_LIBRARY_PACKAGE_FORMAT, "a well-formed package must decode");
  assert.equal(decoded.images.length, 1, "a well-formed package must keep its images");

  // Packages are gzipped when the runtime supports it and recognized by the gzip magic bytes.
  const gzipped = new Uint8Array(zlib.gzipSync(Buffer.from(JSON.stringify(validPackage), "utf8")));
  assert.equal(gzipped[0], 0x1f, "gzip detection relies on the first magic byte");
  assert.equal(gzipped[1], 0x8b, "gzip detection relies on the second magic byte");
  const decodedGzip = await api.decodeSharedLibraryPackage(gzipped);
  assert.deepEqual(decodedGzip, decoded, "a gzipped package must decode to the same payload as plain JSON");

  for (const [payload, expected] of IMPORT_REJECTIONS) {
    await assert.rejects(
      () => api.decodeSharedLibraryPackage(encodePackage(payload)),
      (error) => {
        assert.equal(api.translateUserFacingErrorDetail(error.message), expected, `import rejection wording for ${JSON.stringify(payload).slice(0, 60)}`);
        return true;
      },
    );
  }
  await assert.rejects(
    () => api.decodeSharedLibraryPackage(new Uint8Array(0)),
    (error) => api.translateUserFacingErrorDetail(error.message) === "所选图片包为空。",
    "an empty package must be refused with a Chinese explanation",
  );
}

verifyAsyncContracts().then(() => {
  console.log("current release tests ok");
}, (error) => {
  console.error(error);
  process.exit(1);
});
