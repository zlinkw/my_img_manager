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
    debug() {},
    logError(error) {
      throw error;
    },
  },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "pdf-image-saver.js" });

const { buildOpenPDFURI, buildSourceRegion, normalizeAnnotationKey } = context.PdfImageSaver.__test__;
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

console.log("open-pdf uri tests ok");
