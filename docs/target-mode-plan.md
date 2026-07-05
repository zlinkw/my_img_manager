# Target Mode Plan

## Goal

Build a Zotero 9.0.5 compatible plugin for saving figure previews from the PDF currently open in the Zotero reader, with enough metadata to trace each saved preview back to its paper, attachment, page, and PDF region. Original embedded image extraction remains optional.

Priority order:

1. Correct image extraction, precise page targeting, reliable metadata.
2. Fast one click reader workflow.
3. Clear UI with low risk of accidental saves.
4. Low resource use after correctness is stable.

## Scope

- Zotero reader toolbar action for clipping a figure preview from the current page.
- Reader context menu actions for selectable preview quality and optional original extraction.
- Save preview index as a Zotero child attachment when a parent item exists.
- Default to a lightweight Zotero synced HTML index attachment with embedded previews and source PDF links.
- Save original extracted image files only when explicitly requested.
- Save minimal metadata with bibliographic, PDF, page, bbox, image size, preview quality, and Zotero link fields.
- Use local Python and PyMuPDF for original embedded image extraction.
- Must run independently without a machine specific Python or conda environment.
- Use Zotero reader rendered canvas for default preview index extraction.
- Use local Python and PyMuPDF only as an optional enhancement for original embedded image extraction.
- Detect missing optional helper and continue with reader rendered previews.

## Out Of Scope For Batch 1

- OCR or semantic figure caption detection.
- Cloud services.
- Vector drawing reconstruction.
- Automatic Zotero restart.
- VS Code restart.

## Reference

- Zotero plugin docs: https://www.zotero.org/support/dev/client_coding/plugin_development
- Zotero 7 developer API docs: https://www.zotero.org/support/dev/zotero_7_for_developers
- Official sample plugin: https://github.com/zotero/make-it-red
- Similar implementation reference: https://github.com/forgeters/zotero-fig

## Plugin Contract

- Plugin ID: `pdf-image-saver@zlk.local`
- Version: `0.1.0`
- Target Zotero range: `7.0` to `9.*`
- Primary runtime: Zotero 9.0.5
- Extraction helper schema: `zotero-pdf-image-saver/v1`
- Default scope: current PDF page
- Whole PDF action: explicit context menu only

## Metadata Schema

Saved metadata JSON records:

- `schema_version`
- `created_at`
- `plugin`
- `source`
- `parent_item`
- `pdf_attachment`
- `request`
- `entries` with minimal fields
- `helper`
- `warnings`

Each preview entry includes:

- `id`
- `source`
- `page_index`
- `page_number`
- `bbox_normalized`
- `byte_count`
- `rendered_width`
- `rendered_height`
- `preview_quality`
- `estimated_preview_size`
- `open_pdf_uri`
- optional `zotero_attachment` only when original save is enabled

## Storage Strategy

- Default mode: `reader_preview_index`.
- `reader_preview_index` creates one HTML child attachment per save action.
- HTML includes embedded previews rendered from Zotero reader canvas, compact metadata, and `zotero://open-pdf/...` links.
- No original image bytes are stored in default mode.
- Optional mode: `original_attachments`.
- Optional mode imports original images as child attachments.
- Whole PDF extraction has a hard max count to reduce disk risk.

## Preview Quality

Quality is selectable in the reader context menu:

- Low: max width 240 px, estimated 20 to 80 KB per image.
- Medium: max width 480 px, estimated 60 to 220 KB per image.
- High: max width 960 px, estimated 180 to 750 KB per image.

Default: Medium.

Actual size depends on source image detail and format.

## Batches

### B0/B1 Interface And Scaffold

Status: complete.

Plan:

- Initialize repository and Zotero plugin scaffold.
- Add target mode plan source file.
- Add reader toolbar and context menu entry points.
- Add reader canvas preview index extraction that works without external dependencies.
- Add Python PyMuPDF extraction helper as optional original image enhancer.
- Add lightweight HTML index import and optional original attachment import.
- Add build, package, and global profile install scripts.

Pre batch validation:

- Empty folder confirmed.
- Zotero profile path detected at `%APPDATA%/Zotero/Zotero/Profiles/aalpald9.default`.
- Similar plugin `zotero-fig` inspected for reader API and helper process pattern.
- Official Zotero 7+ plugin docs inspected.

End batch validation checklist:

- `manifest.json` parses: passed through `npm run check`.
- `bootstrap.js` and plugin JS pass `node --check`: passed.
- Python helper help prints when Python exists; helper remains optional: passed.
- XPI is created in `outputs/`: passed, `outputs/pdf-image-saver-0.1.0.xpi`.
- Extension proxy is written to all detected Zotero profiles: passed, `aalpald9.default`.
- Proxy file has no BOM: passed, first bytes `43-3A-5C`.
- Git commit records the batch: passed.

### B2 UI Hardening

Status: implementation complete; runtime smoke pending Zotero restart.

Plan:

- Run Zotero 9.0.5 smoke test after user restart or next Zotero launch.
- Improve toolbar icon styling and disabled or busy states.
- Add preferences for min image area, max whole PDF images, and Python path.
- Add localized strings.
- Add duplicate save guard per PDF page.
- Check Reader API assumptions against actual Zotero 9.0.5 runtime logs.

Pre batch validation:

- B1 static checks passed.
- B1 XPI built and extension proxy installed.
- Zotero/VS Code were not restarted by execution.

End batch validation checklist:

- Zotero loads plugin without startup errors after restart: pending.
- Reader toolbar button appears once per PDF reader: pending.
- Drag selection can be canceled and can save one HTML index attachment: pending.
- HTML index source link opens the PDF page: pending.
- Low, Medium, High menu entries produce different preview byte sizes: static support present.
- No temp directory remains after save or helper failure: static support present.
- Optional original extraction failure does not block preview index: static support present.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `4415997294789b0bf0fd65559c82081809129a45935c46a789f94785e312b1e3`.
- `npm run install:global`: passed.
- XPI includes `preferences.xhtml`, `content/preferences.js`, defaults, helper, and main script.
- XPI includes root `prefs.js`.
- Proxy file has no BOM: passed, first bytes `43-3A-5C`.

Implementation notes:

- Added preference pane registration and preference UI.
- Added toolbar quality selector with size estimates.
- Added configurable default quality, helper timeout, helper max image counts, optional Python path, and duplicate guard.
- Added session duplicate save guard.
- B2 review agent did not return before timeout; local static checks passed.

### B3 Precision

Status: implementation complete; runtime smoke pending Zotero restart.

Plan:

- Compare PyMuPDF bbox with Zotero reader current page coordinate behavior.
- Add pure PDF.js embedded image detection if feasible, avoiding external Python for original image paths.
- Add optional rendered preview capture for vector or fallback cases.
- Add page label capture when available.
- Validate `zotero://open-pdf` URI forms for user and group libraries.
- Defer in reader saved index side panel because B3 precision work should keep UI risk low.

Pre batch validation:

- B2 static checks passed.
- B2 XPI built and installed.
- Zotero runtime smoke remains pending because execution must not restart Zotero.
- Next useful code work: pure PDF.js current page image candidate detection using existing reader PDF.js context.
- Resume check on 2026-07-06: git worktree clean at B3 start commit `ddcdd5a`.
- PDF.js source confirms `PDFPageProxy.render({ recordImages: true })` can populate `imageCoordinates` with normalized rendered image coordinates, so B3 will attempt this path first and fall back to manual clip when unavailable.

End batch validation checklist:

- `npm run check` passes.
- `npm run build` passes.
- `npm run install:global` passes.
- Current page auto image save path exists without Python.
- Auto detection has safe fallback to manual clip when PDF.js image coordinate support is unavailable.
- Candidate count and preview bytes are capped.
- Target plan records new findings and commits.
- Local Zotero 9.0.5 app files were scanned for `recordImages`, `imageCoordinates`, and `CanvasImagesTracker`: no hits found, so auto raster detection is treated as optional and disabled/degraded at runtime.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `24e7ad798502a8ab168d9a8e9e8a1c603dd8ee50754b2fb93a6967b6df5901d7`.
- `npm run install:global`: passed.
- Proxy file has no BOM: passed, first bytes `43-3A-5C`.

### B4 Runtime Validation And Link Accuracy

Status: planned.

Plan:

- After user next launches Zotero, run runtime smoke without restarting VS Code.
- Verify reader toolbar appears once and `Clip Figure` saves one synced HTML preview index.
- Verify `Auto Raster` is hidden, disabled, or safely warns when Zotero PDF.js lacks `imageCoordinates`.
- Verify Low, Medium, High preview byte sizes differ on same selection.
- Verify `zotero://open-pdf` links for user library PDFs, group PDFs, and PDFs without parent items.
- Verify temp dirs are removed after manual clip, auto raster fallback, helper failure, and import failure.
- Only after runtime smoke passes, consider filename templates, export directory, and rollback behavior.

## Current Validation Results

- `git status`: not a git repository at start.
- `python --version`: Python 3.12.4.
- `python -c "import fitz"`: failed before implementation.
- `C:\Users\ZLK\.conda\envs\zlk\python.exe -c "import fitz"`: failed; conda `zlk` also lacks PyMuPDF.
- User reports conda environment `zlk`; helper discovery must prioritize `conda run -n zlk python`.
- User requires disk explosion prevention; default storage must be preview index rather than full originals.
- User requires previews with selectable quality and estimated size.
- User requires data to follow Zotero sync; index and optional originals must be Zotero child attachments.
- User clarified plugin must have independent runtime and must not depend on local special environments.
- `npm run check`: passed after independent reader canvas implementation.
- `npm run build`: passed, XPI SHA256 `4415997294789b0bf0fd65559c82081809129a45935c46a789f94785e312b1e3`.
- `npm run install:global`: passed.
- Proxy bytes: `43-3A-5C`, no BOM.
- B3 `npm run check`: passed.
- B3 `npm run build`: passed, XPI SHA256 `24e7ad798502a8ab168d9a8e9e8a1c603dd8ee50754b2fb93a6967b6df5901d7`.
- B3 `npm run install:global`: passed.
- Local Zotero 9.0.5 package scan found no `recordImages`, `imageCoordinates`, or `CanvasImagesTracker` matches, so B3 auto raster remains optional/degraded.
- B3 proxy bytes: `43-3A-5C`, no BOM.

## New Failures

### FAIL-20260706-001

- Batch: B0/B1
- Environment: Windows, Zotero profile `aalpald9.default`, Python 3.12.4
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: local Python does not provide `fitz`, so original embedded image extraction cannot run through PyMuPDF.
- Expected: helper can import PyMuPDF and extract image xrefs.
- Actual: `ModuleNotFoundError: No module named 'fitz'`.
- Validation update: helper is optional. Missing PyMuPDF must not block default preview index.
- Close condition: optional original extraction is either documented as unavailable or a future bundled/pure PDF.js path replaces it.

### FAIL-20260706-002

- Batch: B0/B1
- Environment: implementation pass
- Severity: P1
- Status: closed
- Symptom: helper preview patch introduced incomplete preview rendering code while shifting from original image saving to lightweight previews.
- Expected: default path works without helper and helper remains optional.
- Actual: helper file contained invalid preview rendering stub.
- Validation update: rewrite helper to stable original extraction only, and implement preview index in plugin JS from reader canvas.
- Close condition: `python content/helper/pdf_image_extract.py --help` succeeds and `node --check content/pdf-image-saver.js` succeeds.
- Closure: `npm run check` passed.

### FAIL-20260706-003

- Batch: B0/B1
- Environment: Windows PowerShell 5.1 risk
- Severity: P1
- Status: closed
- Symptom: `scripts/install-global.ps1` may write Zotero extension proxy with UTF-8 BOM.
- Expected: proxy file contains plain absolute path with no BOM.
- Actual: `Set-Content -Encoding UTF8` can write BOM and break Zotero proxy path parsing.
- Validation update: write proxy with ASCII or .NET UTF8 no BOM.
- Close condition: proxy bytes start with drive letter, not `EF BB BF`.
- Closure: proxy first bytes `43-3A-5C`.

### FAIL-20260706-004

- Batch: B0/B1
- Environment: multiple Zotero PDF tabs
- Severity: P1
- Status: closed
- Symptom: Tools menu active reader lookup may choose first PDF reader because it checks private `_tabID`.
- Expected: use selected tab and Zotero reader lookup when available.
- Actual: `getActiveReader` does not prefer `Zotero.Reader.getByTabID(selectedID)`.
- Validation update: use `getByTabID`, then `tabID`, then fallback scan.
- Close condition: code path prefers selected reader.
- Closure: `getActiveReader` uses `Zotero.Reader.getByTabID(selectedID)` first.

### FAIL-20260706-005

- Batch: B0/B1
- Environment: optional helper on large or bad PDF
- Severity: P1
- Status: closed
- Symptom: optional helper has no timeout, total byte cap, or cleanup for early failure.
- Expected: helper cannot hang indefinitely or fill temp storage.
- Actual: `runHelperExtraction` can leave output dir on no Python/failure and has no explicit caps.
- Validation update: add process timeout, helper image byte caps, and cleanup on failed helper results.
- Close condition: code has timeout and output cleanup in all non import paths.
- Closure: helper timeout added, byte caps added, early failure cleanup added.

### FAIL-20260706-006

- Batch: B0/B1
- Environment: machine without Python
- Severity: P1
- Status: closed
- Symptom: build check requires Python helper even though helper is optional.
- Expected: build works without Python and warns only.
- Actual: `scripts/check.ps1` hard runs `python ... --help`.
- Validation update: make helper check soft if Python is missing.
- Close condition: `npm run check` passes when JS parses and Python is absent.
- Closure: Python helper check is soft; local check passed.

### FAIL-20260706-007

- Batch: B0/B1
- Environment: reader selection overlay
- Severity: P1
- Status: closed
- Symptom: dragging outside the page before mouseup can leave overlay stuck and lose save action.
- Expected: mouse capture continues until release or cancel.
- Actual: overlay only listens on itself.
- Validation update: use pointer events with pointer capture and pointer cancel cleanup.
- Close condition: code uses `setPointerCapture` and handles `pointerup`, `pointercancel`, `lostpointercapture`.
- Closure: pointer capture and cancellation handlers added.

### FAIL-20260706-008

- Batch: B0/B1
- Environment: multiple Python candidates
- Severity: P1
- Status: closed
- Symptom: optional helper stops on first Python reporting `missing_pymupdf`, so later working Python is not tried.
- Expected: try all candidates before returning optional helper unavailable.
- Actual: first `missing_pymupdf` returns immediately.
- Validation update: record missing PyMuPDF and continue candidates.
- Close condition: helper loop only returns success immediately; failures aggregate.
- Closure: `missing_pymupdf` records and continues to next Python candidate.

### FAIL-20260706-009

- Batch: B2
- Environment: Zotero 7+ default preferences
- Severity: P2
- Status: closed
- Symptom: default preferences are packaged only under `defaults/preferences/prefs.js`, while Zotero 7 docs indicate root `prefs.js`.
- Expected: preferences have root `prefs.js` available for Zotero 7+ bootstrap plugin loading.
- Actual: root `prefs.js` missing.
- Validation update: add root `prefs.js` and include it in package, keep old path as compatibility copy.
- Close condition: XPI contains root `prefs.js`.
- Closure: root `prefs.js` added and verified in XPI.

### FAIL-20260706-010

- Batch: B3
- Environment: auto-detected current page previews
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: first auto-detected preview could be saved even when it exceeded the configured auto-save preview byte cap.
- Expected: auto-save byte cap applies to every preview and total imported HTML attachment size.
- Actual: cap check only blocked later previews after at least one preview had been accepted.
- Validation update: reject any single preview that exceeds the cap and stop before adding previews that would exceed total cap.
- Close condition: auto path checks per-preview and cumulative byte caps before importing the HTML index.
- Closure: auto path skips previews above the auto cap, stops before cumulative cap is exceeded, and `createIndexHTML` rejects HTML index files above `maxIndexBytesMB`.

### FAIL-20260706-011

- Batch: B3
- Environment: local Zotero 9.0.5 bundled PDF.js
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: upstream PDF.js supports `recordImages`, but the installed Zotero 9.0.5 runtime may not expose `recordImages` or `imageCoordinates`.
- Expected: unsupported runtime must not present auto image extraction as guaranteed.
- Actual: B3 initial implementation exposed `Auto Images` directly and only failed after click.
- Validation update: auto path must perform capability detection, use conservative `Auto Raster` naming, and fall back to manual clip without blocking default preview index workflow.
- Close condition: UI labels and runtime checks make auto raster detection optional and safe when PDF.js lacks `imageCoordinates`.
- Closure: toolbar/context labels now say `Auto Raster`; runtime checks require `imageCoordinates` or `recordImages` support and otherwise disable/degrade to manual `Clip Figure`.

### FAIL-20260706-012

- Batch: B3
- Environment: PDF.js auto raster detection after page rotation or repeated render
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `pdfPage.imageCoordinates` may be cached by PDF.js after the first `recordImages` render.
- Expected: each auto raster save records coordinates for the current page orientation and render state.
- Actual: B3 initial auto path did not clear cached coordinates before scratch render.
- Validation update: reset cached `imageCoordinates` before rendering when the property is writable.
- Close condition: auto raster detection clears stale image coordinate cache before scratch render and still falls back safely if the runtime does not support the property.
- Closure: `resetPDFJSImageCoordinates` clears `pdfPage.imageCoordinates` before scratch render and catches read only/runtime errors.

## Revised Validation Checklist

- Check Python executable discovery.
- Check missing PyMuPDF returns clear helper status rather than silent failure.
- Check conda `zlk` is discovered before global Python.
- Check missing Python or PyMuPDF does not block default preview index.
- Check optional PyMuPDF available path extracts original image bytes only when original mode is requested.
- Check default mode stores one HTML attachment with embedded previews and source PDF links.
- Check original extracted temp files are removed after index creation.
- Check extension proxy install does not require VS Code restart.
- Check proxy file has no BOM.
- Check helper failure cleans temp output.
- Check auto-detected previews obey max image count and preview byte cap before import.
- Check missing PDF.js `recordImages` capability disables or safely degrades auto raster detection.
- Check auto raster detection clears cached PDF.js image coordinates before each scratch render.

## Real Commit Log

- `4b121ce` B1 scaffold Zotero PDF image saver.
- `52f4551` docs record B1 validation.
- `604d546` docs start B2 hardening plan.
- `5faadda` B2 harden UI preferences and helper limits.
- `947fb74` docs record B2 completion.
- `ddcdd5a` docs start B3 precision plan.
- `7e671db` B3 add safe auto raster preview detection.
- B3 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
