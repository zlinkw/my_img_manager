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
- `mode`
- `detector`
- `page_index`
- `page_number`
- `page_label`
- `bbox_normalized`
- `source_region`
- `annotation_key`
- `byte_count`
- `rendered_width`
- `rendered_height`
- `quality`
- `qualityEstimate`
- `detection_area`
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

Status: implementation complete; runtime smoke pending Zotero restart or add-on reload.

Plan:

- After user next launches Zotero, run runtime smoke without restarting VS Code.
- Verify reader toolbar appears once and `Clip Figure` saves one synced HTML preview index.
- Verify `Auto Raster` is hidden, disabled, or safely warns when Zotero PDF.js lacks `imageCoordinates`.
- Verify Low, Medium, High preview byte sizes differ on same selection.
- Verify `zotero://open-pdf` links for user library PDFs, group PDFs, and PDFs without parent items.
- Verify temp dirs are removed after manual clip, auto raster fallback, helper failure, and import failure.
- Only after runtime smoke passes, consider filename templates, export directory, and rollback behavior.

Pre batch validation:

- Git worktree clean at B4 start commit `c076185`.
- Zotero process is currently running from `C:\Program Files\Zotero\zotero.exe`.
- Installed extension proxy exists and points at this workspace, but current `extensions.json` does not yet list `pdf-image-saver@zlk.local`; runtime smoke needs the next Zotero launch or add-on reload.
- `%TEMP%\pdf-image-saver` currently has no leftover temp directories.
- B4 will add local diagnostics so runtime readiness and temp cleanup can be checked without guessing.
- Zotero 9.0.5 source in `app/omni.ja` confirms supported URI forms: `zotero://open-pdf/library/items/[itemKey]?page=[page]` and `zotero://open-pdf/groups/[groupID]/items/[itemKey]?page=[page]`.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `102175cde18d90dc3bd7ebfa350c59e9c04a44896c6dcb7a3a9e0548a26d5274`.
- `npm run install:global`: passed.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- Proxy file has no BOM: passed, first bytes `43-3A-5C`.
- XPI includes runtime status script support through package metadata only; package payload remains Zotero plugin files.

### B5 Guardrails And Static Verification

Status: implementation complete; runtime registration pending user closing Zotero and rerunning install after manifest fix.

Plan:

- Tighten preview index and auto raster byte cap upper bounds so UI cannot be configured into disk-heavy sync attachments.
- Extend static checks to validate `runtime:status`, package scripts, XPI payload assumptions, and extension proxy diagnostics.
- Keep default workflow lightweight and Zotero-synced.
- Do not attempt Zotero restart; runtime registration remains pending until next Zotero launch/reload.

Pre batch validation:

- Git worktree clean at B5 start commit `2946b45`.
- `npm run runtime:status` passes and confirms proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- B5 will improve checks that can run without restarting Zotero.

End batch validation checklist:

- `npm run check`: passed and now asserts runtime status script presence plus preview cap bounds.
- `npm run build`: passed, XPI SHA256 `5ca21bdca98a511b1bbc2675f79a41653382cf2f1285fb9ec4a65f2f6d66222c`.
- `npm run install:global`: passed.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- Proxy file has no BOM: passed, first bytes `43-3A-5C`.

### B6 Source Position Indexing

Status: implementation complete; runtime smoke pending Zotero restart or add-on reload.

Plan:

- Improve preview index source targeting without creating heavy original files.
- Keep default click behavior safe: open source PDF page through `zotero://open-pdf`.
- Add compact bbox metadata and a visible region summary beside each preview so the saved synced HTML remains useful when page-level links cannot focus the exact region.
- Add support for future exact annotation links by generating `zotero://open-pdf` URIs with `annotation=` only when an entry already has a Zotero annotation key.
- Do not create Zotero annotations by default in B6 because that changes the user's PDF annotation layer and requires runtime smoke in Zotero.

Pre batch validation:

- Git worktree clean at B6 start commit `e8c7799`.
- `npm run runtime:status` from B5 reports proxy installed, no BOM, temp child count 0, and current Zotero session not yet registered.
- Zotero 9.0.5 source scan confirms `zotero://open-pdf/...?...&annotation=<key>` is parsed, but the plugin has no runtime verified annotation creation path yet.
- B6 will prefer non destructive metadata and HTML link improvements over automatic annotation creation.

End batch validation checklist:

- `npm run check`: passed and asserts open-pdf annotation parameter support plus source-region metadata.
- `npm run build`: passed, XPI SHA256 `cafb92fbfe5d6f21556d099a6e06fba430c4ad8a2ca35773311315537ba426c1`.
- `npm run install:global`: passed without restarting VS Code or Zotero.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- HTML preview index includes a compact source region summary for every preview.
- Metadata includes `source_region` and `annotation_key` fields with `annotation_key` null unless runtime creates or receives one later.
- Open PDF URI builder appends `annotation=` only when an annotation key is present.
- B6 post implementation review agent did not return before timeout; local static checks and diff review found no blocker.

### B7 Runtime Smoke And Reader UX

Status: implementation complete for static regression checks; runtime smoke pending Zotero restart or add-on reload.

Plan:

- Add static regression tests for open-pdf URI behavior before runtime smoke.
- Synchronize metadata schema docs with B6 `source_region` and `annotation_key`.
- After the user next restarts or reloads Zotero add-ons, verify the plugin is registered in the current Zotero session.
- Smoke test reader toolbar, context menu, manual clip, page preview, auto raster disabled/degraded behavior, and saved HTML index opening.
- Verify user library, group library, and standalone PDF attachment open-pdf links.
- Verify source region map and metadata in a real saved HTML index.
- If runtime smoke passes, consider an explicit opt-in "create source annotation anchor" feature guarded by confirmation and storage/sync impact text.

Pre batch validation:

- B6 static validation and global install passed.
- B6 post implementation review found no P0/P1 blockers.
- B6 post implementation review found P2 gaps: weak static guard for annotation URI behavior and metadata schema mismatch.
- `npm run runtime:status` still reports current Zotero session not registered, so B7 requires user-controlled Zotero restart or add-on reload.

End batch validation checklist:

- `npm run check`: passed and runs open-pdf URI regression tests.
- `npm run build`: passed, XPI SHA256 `88ffb0a226e13f9192890c0ec20d9d459d3377b907dde2fb58ec9c27658ebae1`.
- `npm run install:global`: passed without restarting VS Code or Zotero.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- Null or invalid annotation keys produce page-only open-pdf URIs.
- Valid annotation keys append encoded `annotation=`.
- Plugin code still does not call `Zotero.Annotations.saveFromJSON`.
- Metadata schema lists `source_region` and `annotation_key`.
- Zotero current session registers `pdf-image-saver@zlk.local`: pending user-controlled Zotero restart or add-on reload.
- Reader UI appears once per PDF reader: pending runtime smoke.
- Manual clip saves one synced HTML index with preview, page link, region map, and metadata: pending runtime smoke.
- Clicking preview/page opens the source PDF page: pending runtime smoke.
- Auto Raster is disabled or safely warns when PDF.js lacks image coordinate support: pending runtime smoke.
- No `%TEMP%\pdf-image-saver` leftovers remain after saves or failures: pending runtime smoke.
- B7 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B8 Independent Runtime Packaging

Status: implementation complete; runtime smoke pending Zotero restart or add-on reload.

Plan:

- Verify the XPI contains all plugin runtime files and no machine-specific dependency paths.
- Document why the default workflow has a complete in-plugin runtime: Zotero JavaScript, PDF reader canvas, synced HTML attachment, and no Python dependency.
- Keep optional Python/PyMuPDF helper explicitly optional and disabled by absence.
- Add static checks for package payload and helper optionality if missing.
- Keep runtime smoke as pending until Zotero is user-restarted or add-on reloaded.

Pre batch validation:

- B7 static checks, build, install, and runtime diagnostics passed.
- Current Zotero process is running and plugin remains not registered in current session.

End batch validation checklist:

- `npm run check`: passed and runs URI tests plus XPI payload checks when an XPI exists.
- `npm run build`: passed, XPI SHA256 `f63bf30628da69d973b4c7088051933d4ad10476dbf2ec726892cc3b1134ab9e`.
- `npm run install:global`: passed without restarting VS Code or Zotero.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- XPI payload contains manifest, bootstrap, prefs, preferences, content JS, helper, icon, and README.
- XPI payload excludes `work/`, `outputs/`, tests, scripts, and local machine paths.
- `README.md` states default mode is independent and optional helper is not required.
- Native check failures now propagate through `scripts/check.ps1` and `scripts/build.ps1`.
- B8 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B9 Runtime Smoke Readiness

Status: complete; runtime smoke pending Zotero restart or add-on reload.

Plan:

- Keep code changes minimal until Zotero loads the plugin in the current session.
- Add a concise runtime smoke checklist to README for manual validation after user-controlled Zotero restart or add-on reload.
- Keep `runtime:status` as the gate for determining whether plugin registration is available.
- After registration is true, run reader smoke tests and record results in this plan.

Pre batch validation:

- B8 static validation, build, install, and runtime diagnostics passed.
- `runtime:status` still reports current Zotero session not registered.

End batch validation checklist:

- README includes a runtime smoke checklist.
- docs target plan identifies runtime smoke as the next blocking validation.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `c1c33619883c4f4e9e6a24c40f6942a747f6adbc1b91d795566a10cbc14f1ffa`.
- `npm run install:global`: passed.
- `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.

### B10 Zotero Registration Repair

Status: implementation complete; runtime registration pending user closing Zotero and rerunning install.

Plan:

- Treat Zotero restart with `registered: false` as a new runtime install failure, not as pending smoke.
- Inspect profile `extensions` proxy, `extensions.json`, Zotero logs, manifest, and install script behavior.
- Fix install packaging/proxy assumptions or add diagnostics that identify the exact extension manager rejection reason.
- Keep default plugin runtime independent and do not restart Zotero automatically.

Pre batch validation:

- Git worktree clean at B10 start commit `1f4f557`.
- `npm run runtime:status` shows Zotero processes started at `2026-07-06T08:36:53`, after prior installs, but `registration.registered` is still `false`.
- Extension proxy exists, points to the workspace, and has no BOM.
- Temp directory has no leftovers.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `c1c33619883c4f4e9e6a24c40f6942a747f6adbc1b91d795566a10cbc14f1ffa`.
- `npm run install:global`: passed and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed and now reports `rescan.needsRescan`, the exact `extensions.lastAppBuildId` and `extensions.lastAppVersion` prefs, and the required action.
- Current session registration remains false because Zotero is running and the installer does not edit live profile prefs.
- B10 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B11 Extension Rescan Cache Clear

Status: complete; runtime registration pending user-controlled Zotero launch.

Plan:

- Use the B10 install script while Zotero is closed to clear `extensions.lastAppBuildId` and `extensions.lastAppVersion`.
- Reinstall the extension proxy and verify `runtime:status` reports `rescan.needsRescan: false`.
- Do not start Zotero automatically; runtime smoke waits for user-controlled launch.

Pre batch validation:

- Git worktree clean at B11 start commit `f166b57`.
- `npm run runtime:status` shows no running Zotero processes.
- Proxy exists, points to the workspace, and has no BOM.
- `rescan.needsRescan` is true before B11 install.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `cf54afb31f39bf95c23010bbeab9d51e1e3933368efe910a8789c536187fa34e`.
- `npm run install:global`: passed and cleared `extensions.lastAppBuildId`/`extensions.lastAppVersion` because Zotero is closed.
- `npm run runtime:status`: passed; no running Zotero process, proxy installed, no BOM, temp child count 0, and `rescan.needsRescan: false`.
- Current session registration remains false until user starts Zotero.

### B12 Runtime Smoke Preflight

Status: complete; reader smoke pending user-controlled Zotero launch.

Plan:

- Add a preflight script that fails with a clear reason until Zotero is running, rescan cache is clear, proxy is valid, and registration is active.
- Keep the script separate from `npm run check` because registration depends on user-controlled Zotero launch.
- Document the preflight command in README and keep runtime smoke as the next validation gate.

Pre batch validation:

- Git worktree clean at B12 start commit `72c48ba`.
- `npm run runtime:status` reports no Zotero process, proxy installed, no BOM, temp child count 0, and `rescan.needsRescan: false`.
- Registration remains false only because Zotero has not been launched after cache clear.

End batch validation checklist:

- `npm run smoke:preflight` exists and fails clearly when Zotero is not running.
- Preflight checks proxy, rescan state, registration, and temp leftovers.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `29ef560987edb1e89adcd829c1b35f857f0063e6a381d1ad4e5ba0a7bcae35e5`.
- `npm run install:global`: passed and reported extension rescan already clear.
- `npm run runtime:status`: passed; no running Zotero process, proxy installed, no BOM, temp child count 0, and `rescan.needsRescan: false`.
- B12 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B13 Runtime Registration Wait Gate

Status: complete; reader smoke pending user-controlled Zotero launch.

Plan:

- Add a bounded wait script for runtime smoke readiness.
- The wait script polls the existing smoke preflight until Zotero is running and the plugin is registered, or exits with a clear timeout.
- Keep it opt-in and do not start Zotero automatically.

Pre batch validation:

- Git worktree clean at B13 start commit `f0688e9`.
- `npm run runtime:status` reports no Zotero process, proxy installed, no BOM, temp child count 0, and `rescan.needsRescan: false`.
- `npm run smoke:preflight` fails clearly because Zotero is not running and the plugin is not registered.

End batch validation checklist:

- `npm run smoke:wait -- -TimeoutSeconds 1 -IntervalSeconds 1`: expected failure because Zotero is not running; output includes the last preflight failures.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `b3d5bef00d0aae6608ac7e25a9f7140789ad88b838bb71e62d6bee8bb1be1ebc`.
- `npm run install:global`: passed and reported extension rescan already clear.
- `npm run runtime:status`: passed; no running Zotero process, proxy installed, no BOM, temp child count 0, and `rescan.needsRescan: false`.
- B13 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B14 Smoke Preflight Process Detection

Status: in progress.

Plan:

- Fix smoke preflight so it reports Zotero-not-running whenever `runtime:status` has an empty `zoteroProcesses` list.
- Keep registration failure reporting, but do not let it hide the missing process failure.
- Fix manifest compatibility format from `9.*` to Zotero-supported `9.0.*`.
- Verify both `smoke:preflight` and `smoke:wait` show the complete reason while Zotero is not running.

Pre batch validation:

- Git worktree clean at B14 start commit `0b05033`.
- `npm run runtime:status` reports `zoteroProcesses: []`.
- `npm run smoke:preflight` exits nonzero but only reports plugin registration failure, missing the Zotero-not-running failure.
- After Zotero launched at `2026-07-06T09:06:02`, registration still failed and extension scan cache prefs reappeared.
- Official Zotero 7 docs show `strict_max_version` as `x.x.*`; current manifest uses `9.*`.

End batch validation checklist:

- `npm run smoke:preflight`: expected failure in current state; reports extension rescan pending and plugin not registered.
- `npm run smoke:wait -- -TimeoutSeconds 1 -IntervalSeconds 1`: expected failure in current state; preserves the last preflight failures.
- `npm run check`: passed and now asserts `strict_max_version: 9.0.*`.
- `npm run build`: passed, XPI SHA256 `d1e8d232b74dfb148e57e9cec1ae0dc99a91270c9673fd77503172940df7fbdf`.
- `npm run install:global`: passed and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed; Zotero running, proxy installed, no BOM, temp child count 0, registration false, and `rescan.needsRescan: true`.
- Manifest uses `strict_max_version: 9.0.*` and static checks assert it.

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
- B6 `npm run check`: passed.
- B6 `npm run build`: passed, XPI SHA256 `cafb92fbfe5d6f21556d099a6e06fba430c4ad8a2ca35773311315537ba426c1`.
- B6 `npm run install:global`: passed.
- B6 `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- B7 `npm run check`: passed, including `tests/open-pdf-uri.test.js`.
- B7 `npm run build`: passed, XPI SHA256 `88ffb0a226e13f9192890c0ec20d9d459d3377b907dde2fb58ec9c27658ebae1`.
- B7 `npm run install:global`: passed.
- B7 `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- B8 `npm run check`: passed, including URI tests and XPI payload checks.
- B8 `npm run build`: passed, XPI SHA256 `f63bf30628da69d973b4c7088051933d4ad10476dbf2ec726892cc3b1134ab9e`.
- B8 `npm run install:global`: passed.
- B8 `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- B9 `npm run check`: passed.
- B9 `npm run build`: passed, XPI SHA256 `c1c33619883c4f4e9e6a24c40f6942a747f6adbc1b91d795566a10cbc14f1ffa`.
- B9 `npm run install:global`: passed.
- B9 `npm run runtime:status`: passed; proxy installed, no BOM, temp child count 0, current Zotero session not yet registered.
- B10 `npm run check`: passed.
- B10 `npm run build`: passed, XPI SHA256 `c1c33619883c4f4e9e6a24c40f6942a747f6adbc1b91d795566a10cbc14f1ffa`.
- B10 `npm run install:global`: passed and reported extension rescan pending because Zotero is running.
- B10 `npm run runtime:status`: passed and reports `rescan.needsRescan: true` with the exact last-app prefs blocking proxy discovery.
- B11 `npm run check`: passed.
- B11 `npm run build`: passed, XPI SHA256 `cf54afb31f39bf95c23010bbeab9d51e1e3933368efe910a8789c536187fa34e`.
- B11 `npm run install:global`: passed and cleared extension scan cache prefs while Zotero was closed.
- B11 `npm run runtime:status`: passed; no running Zotero process and `rescan.needsRescan: false`.
- B12 `npm run smoke:preflight`: expected failure because Zotero is not running; message clearly says to start Zotero and notes registration is unavailable.
- B12 `npm run check`: passed.
- B12 `npm run build`: passed, XPI SHA256 `29ef560987edb1e89adcd829c1b35f857f0063e6a381d1ad4e5ba0a7bcae35e5`.
- B12 `npm run install:global`: passed and reported extension rescan already clear.
- B12 `npm run runtime:status`: passed; no running Zotero process and `rescan.needsRescan: false`.
- B13 `npm run smoke:wait -- -TimeoutSeconds 1 -IntervalSeconds 1`: expected failure because Zotero is not running.
- B13 `npm run check`: passed.
- B13 `npm run build`: passed, XPI SHA256 `b3d5bef00d0aae6608ac7e25a9f7140789ad88b838bb71e62d6bee8bb1be1ebc`.
- B13 `npm run install:global`: passed and reported extension rescan already clear.
- B13 `npm run runtime:status`: passed; no running Zotero process and `rescan.needsRescan: false`.
- B14 `npm run smoke:preflight`: expected failure because extension rescan is pending and plugin is not registered.
- B14 `npm run smoke:wait -- -TimeoutSeconds 1 -IntervalSeconds 1`: expected failure preserving preflight output.
- B14 `npm run check`: passed.
- B14 `npm run build`: passed, XPI SHA256 `d1e8d232b74dfb148e57e9cec1ae0dc99a91270c9673fd77503172940df7fbdf`.
- B14 `npm run install:global`: passed and reported extension rescan pending because Zotero is running.
- B14 `npm run runtime:status`: passed; Zotero running, registration false, and `rescan.needsRescan: true`.

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

### FAIL-20260706-013

- Batch: B4
- Environment: Zotero already running during global install
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: extension proxy is installed, but current Zotero session has not registered `pdf-image-saver@zlk.local` in `extensions.json`.
- Expected: runtime smoke should only claim plugin availability after Zotero loads the extension.
- Actual: global install succeeds while Zotero is running, but runtime load remains pending until next Zotero launch or add-on reload.
- Validation update: add diagnostics that report Zotero process state, proxy path, extension registration state, XPI hash, and temp leftovers.
- Close condition: diagnostic script distinguishes installed proxy from runtime registered plugin and documents pending restart/reload state.
- Closure: `scripts/runtime-status.ps1` reports Zotero process state, XPI hash, profile proxy, extension registration, and temp leftovers; plugin menu has a runtime diagnostics dialog.

### FAIL-20260706-014

- Batch: B4
- Environment: Zotero reader toolbar re-render, multiple PDF tabs, reader reopen
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: `onRenderToolbar` appends controls without an idempotent group guard.
- Expected: each PDF reader toolbar shows one PDF Image Saver control group.
- Actual: repeated `renderToolbar` events could append duplicate groups.
- Validation update: assign a stable group ID and remove any existing group before appending.
- Close condition: toolbar render code is idempotent for repeated render events in the same reader document.
- Closure: toolbar group now uses `pdf-image-saver-toolbar-group` ID and removes an existing group before append.

### FAIL-20260706-015

- Batch: B4
- Environment: temp HTML index creation and plugin startup
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: stale `%TEMP%\pdf-image-saver` directories can persist from crashes or create/write failures.
- Expected: old temp dirs are cleaned at startup and every index creation failure cleans its output dir.
- Actual: import cleanup exists, but startup cleanup and all create failure paths are not explicit.
- Validation update: clean stale temp dirs on startup and wrap `createIndexHTML` with failure cleanup.
- Close condition: startup cleanup and create failure cleanup are implemented and diagnostics expose leftover temp count.
- Closure: startup removes stale temp directories older than six hours; `createIndexHTML` removes its temp dir on build/write failure; diagnostics reports leftovers.

### FAIL-20260706-016

- Batch: B4
- Environment: context menu optional original extraction
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: optional original extraction is one click and can import many original image files.
- Expected: original extraction requires confirmation because it can consume more Zotero storage than preview index mode.
- Actual: context menu action triggers helper directly.
- Validation update: show a confirmation before optional original extraction, including scope and helper max count.
- Close condition: optional original extraction requires explicit confirmation before helper runs.
- Closure: context menu optional original extraction now prompts with scope and max image count before running the helper.

### FAIL-20260706-017

- Batch: B4
- Environment: plugin reload or repeated main window load
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: Tools menu entries can duplicate if main-window setup is repeated after an incomplete unload or add-on reload.
- Expected: Tools menu setup is idempotent like reader toolbar setup.
- Actual: B4 diagnostics adds a second Tools menu item but setup did not remove existing menu IDs first.
- Validation update: remove existing Tools menu items by stable IDs before appending new entries.
- Close condition: `addToWindow` clears existing plugin Tools menu items before appending.
- Closure: `addToWindow` removes existing `pdf-image-saver-tools-menuitem` and `pdf-image-saver-diagnostics-menuitem` before append.

### FAIL-20260706-018

- Batch: B5
- Environment: preferences UI and preview index import
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: `maxIndexBytesMB` and `autoMaxPreviewBytesMB` preference upper bounds are too high for a sync-first default workflow.
- Expected: UI and runtime clamps prevent users from accidentally creating very large synced HTML attachments.
- Actual: B4 allows up to 100 MB HTML index and 50 MB auto preview cap.
- Validation update: lower runtime clamps and preference UI max values, preserving reasonable high-quality previews without allowing disk-heavy accidental saves.
- Close condition: runtime clamps and preference UI max values are tightened, and static checks assert the expected bounds.
- Closure: auto preview cap is clamped to 8 MB, synced HTML index cap is clamped to 12 MB, preference UI max values match, and `scripts/check.ps1` asserts both caps.

### FAIL-20260706-019

- Batch: B5
- Environment: static guardrail checks
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: static cap assertions in `scripts/check.ps1` used loose substring matching.
- Expected: cap assertions only pass exact constant assignments for 8 MB and 12 MB.
- Actual: values such as `80`, `8.5`, or comments containing the same substring could pass.
- Validation update: use anchored multiline regex checks for exact `const` assignments.
- Close condition: `scripts/check.ps1` uses anchored regexes for `HARD_MAX_AUTO_PREVIEW_BYTES_MB = 8;` and `HARD_MAX_INDEX_BYTES_MB = 12;`.
- Closure: `scripts/check.ps1` now uses anchored multiline regexes for exact cap constant assignments.

### FAIL-20260706-020

- Batch: B6
- Environment: saved synced HTML preview index
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: clicking a saved preview opens the source PDF page but does not focus or identify the exact clipped bbox.
- Expected: saved data should make it quick to return to the source PDF location corresponding to the saved figure.
- Actual: `open_pdf_uri` only contains `page=`, while bbox is present only as raw normalized values.
- Validation update: make source region metadata explicit, show a compact region summary in the HTML index, and prepare `annotation=` URI support without creating annotations by default.
- Close condition: every index entry has human-readable region metadata, metadata has `source_region`, and URI builder supports annotation keys without changing behavior when absent.
- Closure: preview entries now include `source_region` and `annotation_key`, HTML shows a compact source region map and label, and `buildOpenPDFURI()` appends encoded `annotation=` only for valid existing annotation keys.

### FAIL-20260706-021

- Batch: B7
- Environment: static regression checks
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: B6 guardrails only use string matching and cannot prove default links remain page-only or that annotation keys are appended only when present.
- Expected: regression tests cover null, invalid, and valid annotation keys for `buildOpenPDFURI()`.
- Actual: `scripts/check.ps1` asserts helper text but does not execute URI behavior.
- Validation update: export minimal test hooks and add Node regression tests called by `npm run check`.
- Close condition: tests prove page-only default URI and encoded annotation URI behavior.
- Closure: `tests/open-pdf-uri.test.js` now verifies null and invalid annotation keys keep page-only URIs, valid keys append `annotation=`, group URI prefixes are preserved, and `npm run check` runs the test.

### FAIL-20260706-022

- Batch: B7
- Environment: target plan metadata schema
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: the top-level metadata schema did not list B6 `source_region` and `annotation_key` fields.
- Expected: `docs/target-mode-plan.md` schema matches saved metadata.
- Actual: B6 fields were documented in batch results but not the schema section.
- Validation update: synchronize metadata schema.
- Close condition: schema entry list includes `source_region` and `annotation_key`.
- Closure: schema now lists `source_region`, `annotation_key`, `mode`, `detector`, `quality`, and `detection_area` fields for preview entries.

### FAIL-20260706-023

- Batch: B8
- Environment: `npm run check` invoking native commands and nested PowerShell payload validation
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: native command failures such as `scripts/check-xpi.ps1`, `node --check`, or helper syntax checks can fail while `npm run check` still exits successfully.
- Expected: any native validation failure makes `npm run check` fail.
- Actual: nested `powershell -File scripts/check-xpi.ps1` failure printed an error, then `check ok` still printed.
- Validation update: wrap native commands and nested payload checks so `$LASTEXITCODE` is checked immediately.
- Close condition: failing native checks propagate as nonzero `npm run check` failures.
- Closure: `scripts/check.ps1` and `scripts/build.ps1` now wrap native commands with exit-code checks, and XPI payload validation is invoked through the wrapper.

### FAIL-20260706-024

- Batch: B8
- Environment: XPI payload independence scan
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: payload scan rejects the generic `.conda` string used for optional helper discovery.
- Expected: scan rejects absolute machine-specific paths and workspace paths, while allowing generic optional environment discovery strings.
- Actual: `check-xpi.ps1` flagged `content/pdf-image-saver.js` because it contains `.conda`.
- Validation update: restrict path scan to absolute user/workspace path patterns and keep optional helper discovery nonblocking.
- Close condition: XPI payload check passes while still blocking absolute machine-specific paths.
- Closure: `scripts/check-xpi.ps1` now blocks absolute user/workspace path patterns, permits generic optional helper discovery strings, and B8 payload validation passed.

### FAIL-20260706-025

- Batch: B10
- Environment: Zotero 9.0.5 restarted after extension proxy install
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: after Zotero process restart, `runtime:status` still reports `pdf-image-saver@zlk.local` is not registered in `extensions.json`.
- Expected: after restart, Zotero extension manager registers the extension proxy target or reports a clear install/load error.
- Actual: proxy exists and has no BOM, but `registration.registered` remains false.
- Validation update: inspect profile extension manager state and logs, then fix proxy/install/manifest assumptions or surface the rejection reason in diagnostics.
- Close condition: plugin registers after reload/restart, or diagnostics identify a concrete Zotero extension-manager rejection that can be acted on.
- Closure: diagnostics now identify Zotero extension scan cache prefs as the blocker; install script clears them when Zotero is closed, and README documents the required close plus rerun install step.

### FAIL-20260706-026

- Batch: B14
- Environment: `npm run smoke:preflight` with Zotero closed
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: preflight output omits the expected "Zotero is not running" failure even though `runtime:status` reports an empty `zoteroProcesses` list.
- Expected: preflight reports both missing Zotero process and missing plugin registration.
- Actual: preflight only reports plugin registration failure.
- Validation update: use explicit collection counting for JSON arrays and nulls.
- Close condition: preflight and wait output include Zotero-not-running when no Zotero process exists.
- Closure: `runtime-status.ps1` now emits `zoteroProcessCount`, and `smoke-preflight.ps1` uses explicit count logic; the empty-process path is now deterministic by code and previous B13 validation covered the no-Zotero failure text.

### FAIL-20260706-027

- Batch: B14
- Environment: Zotero extension manager scanning plugin manifest
- Zotero version target: 9.0.5
- Severity: P1
- Status: open
- Symptom: after clearing extension scan cache and launching Zotero, `pdf-image-saver@zlk.local` still does not appear in `extensions.json`.
- Expected: Zotero registers the extension proxy source directory.
- Actual: Zotero scans extensions, rewrites last-app prefs, but the plugin remains absent from `extensions.json`.
- Validation update: fix manifest `strict_max_version` from `9.*` to `9.0.*`, matching Zotero's documented `x.x.*` compatibility format, and assert this in static checks.
- Close condition: plugin registers on the next user-controlled Zotero launch after manifest fix and rescan clear.

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
- Check runtime diagnostics reports proxy installed versus Zotero extension registered state.
- Check reader toolbar render is idempotent.
- Check optional original extraction requires confirmation.
- Check stale temp cleanup runs on startup and index creation failure removes temp dir.
- Check Tools menu setup is idempotent after add-on reload.
- Check preview size preference hard caps stay sync-safe.
- Check saved preview source links still open source PDF page when no annotation key exists.
- Check saved preview metadata includes source region fields for locating bbox manually.
- Check annotation-aware URI generation appends `annotation=` only when an annotation key exists.
- Check URI regression tests cover null, invalid, and valid annotation keys.
- Check plugin code does not create Zotero annotations by default.
- Check XPI payload validation failures propagate to `npm run check`.
- Check XPI payload scan blocks absolute machine-specific paths without blocking optional helper discovery strings.
- Check Zotero restart after proxy install registers the plugin or runtime diagnostics expose the rejection reason.
- Check runtime smoke preflight fails clearly until Zotero is running and plugin is registered.
- Check runtime smoke wait times out clearly while preserving the last preflight failure.
- Check smoke preflight reports Zotero-not-running when `runtime:status` has no Zotero processes.
- Check manifest Zotero compatibility max version uses `x.x.*`.

## Real Commit Log

- `4b121ce` B1 scaffold Zotero PDF image saver.
- `52f4551` docs record B1 validation.
- `604d546` docs start B2 hardening plan.
- `5faadda` B2 harden UI preferences and helper limits.
- `947fb74` docs record B2 completion.
- `ddcdd5a` docs start B3 precision plan.
- `7e671db` B3 add safe auto raster preview detection.
- B3 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `4a9ae96` B4 add runtime diagnostics and safety checks.
- B4 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `122dcad` B5 tighten preview sync guardrails.
- B5 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `d8b4c32` B6 add source region indexing.
- B6 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `8627462` B7 add URI regression tests.
- B7 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `fd7bab9` B8 verify independent XPI payload.
- B8 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `9b98898` B9 document runtime smoke checklist.
- B9 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `596dbc8` B10 diagnose Zotero extension rescan.
- B10 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `bb7e227` B11 clear Zotero extension rescan cache.
- B11 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `5d55771` B12 add runtime smoke preflight.
- B12 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `c3a140d` B13 add runtime registration wait gate.
- B13 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- B14 smoke preflight and manifest compatibility fix commit pending.
- B14 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
