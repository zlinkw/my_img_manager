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
- Target Zotero range: `7.0` to `9.0.*`
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

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

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
- B14 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B15 Runtime Registration Diagnostics And Independent Contract

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

Plan:

- Keep default runtime fully Zotero-contained: reader canvas previews plus synced HTML child attachments, no Python, conda, PyMuPDF, local output directory, or machine-specific path required.
- Keep original embedded image extraction explicitly optional until a bundled pure-JS or Zotero-native extraction path exists.
- Add runtime diagnostics for manifest readability, expected payload files, WebExtension UUID prefs, startup cache hints, and current profile extension source state.
- Do not modify live Zotero profile prefs while Zotero is running.
- Preserve current blocked state: user must close Zotero, then `npm run install:global`, then start Zotero before registration can be validated.

Pre batch validation:

- Git worktree clean at B15 start commit `98bc1ba`.
- `npm run runtime:status`: Zotero running with process count 3, proxy installed, no BOM, registration false, `rescan.needsRescan: true`.
- `extensions.json` does not contain `pdf-image-saver@zlk.local`.
- Profile extension dir contains a development proxy file `pdf-image-saver@zlk.local`, but no copied XPI for this add-on.
- `prefs.js` contains a WebExtension UUID mapping for `pdf-image-saver@zlk.local`, which means profile state may contain partial prior discovery even while `extensions.json` lacks registration.
- `addonStartup.json.lz4` exists and can be scanned for add-on-id hints without decompressing or mutating the profile.

End batch validation checklist:

- `npm run runtime:status`: passed and now reports proxy target manifest readability, id match, `strictMaxVersion: 9.0.*`, missing payload list, profile XPI-source absence, WebExtension UUID hint, startup cache hint, and temp child count 0.
- `npm run smoke:preflight`: expected failure because Zotero is running with rescan pending and registration false; output now includes the WebExtension UUID versus missing `extensions.json` registration hint.
- `npm run check`: passed, including manifest description and target plan contract checks.
- `npm run build`: passed, XPI SHA256 `bcdd8fcf42017e06eff5b3523225200f1ac90237a93d3ce08b9cf8a948d80a8f`.
- `npm run install:global`: passed and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed after install; temp child count 0, manifest diagnostics valid, registration still false until user-controlled close and launch.
- B15 review agent reported docs/manifest target inconsistencies and optional-helper independence risk; those were folded into this batch.

### B16 Review Fixes For Runtime Diagnostics

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

Plan:

- Keep optional helper out of required runtime payload checks; missing helper may be reported as optional info but must not fail preflight.
- Rename startup cache add-on-id scan to a weak raw-bytes hint and remove preflight failure behavior based on that hint.
- Let smoke preflight accept either a valid development proxy source or a valid profile XPI source, preparing for future XPI fallback installs.
- Complete real commit log entries for B14/B15 before the next commit.

Pre batch validation:

- Git worktree has uncommitted target plan commit-log additions after B15 main commit `1ef08d1`.
- B15 review agent reported four P2 issues: optional helper treated as required payload, compressed startup cache treated as semantic text, preflight hard requiring development proxy while ignoring XPI install, and missing real commit log entries.
- `npm run check` passed before B16 changes.

End batch validation checklist:

- `npm run runtime:status`: passed and separates required `missingPayload` from optional `optionalMissingPayload`.
- `npm run smoke:preflight`: expected failure because Zotero is running with rescan pending and registration false; output no longer reports optional helper or startup cache as failures.
- `npm run smoke:preflight` source validation now uses proxy-or-XPI validity logic.
- Startup cache add-on-id value is named `rawBytesContainAddonID`, includes a weak-hint note, and is not used as a hard preflight failure.
- `npm run check`: passed.
- `npm run build`: passed, XPI SHA256 `bcdd8fcf42017e06eff5b3523225200f1ac90237a93d3ce08b9cf8a948d80a8f`.
- `npm run install:global`: passed and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed after install; temp child count 0.
- B16 post implementation review agent did not return before timeout and was closed; local static checks passed.

### B17 XPI Install Fallback

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

Plan:

- Add a formal XPI install mode that copies the built XPI into the Zotero profile extensions directory and removes the development proxy for that add-on when switching to XPI mode.
- Keep `install:global` as the development proxy install used for fast iteration, but expose a separate script for XPI fallback.
- Make runtime diagnostics and preflight keep accepting either valid development proxy or valid XPI source.
- Do not close or restart Zotero automatically; if Zotero is running, XPI mode must report that a clean source switch requires closing Zotero.

Pre batch validation:

- Git worktree clean at B17 start commit `64dd171`.
- `npm run runtime:status`: Zotero running with process count 3, development proxy valid, no profile XPI install source, registration false, `rescan.needsRescan: true`.
- B16 preflight source validation can accept XPI source, but installer cannot yet create that XPI source.

End batch validation checklist:

- `npm run check`: passed and asserts XPI install mode script exists.
- `npm run install:xpi`: passed in protected mode while Zotero is running; it did not switch source and instructed to close Zotero and rerun.
- `npm run build`: passed, XPI SHA256 `0278efa14ba1e7b99f9c88298af808988e6c0c757d53e7ca2a248d13b5720d8a`.
- `npm run install:global`: passed and kept development proxy behavior.
- XPI fallback mode is available for use after the user closes Zotero.
- `npm run runtime:status`: passed and reports profile XPI source state.

### B18 XPI Source Switch Guardrails

Status: complete; closed-Zotero XPI copy validation still pending under FAIL-034.

Plan:

- Reject source switching while Zotero is running in both directions: proxy to XPI and XPI to proxy.
- Make live-runner messages mode-specific so `install:xpi` never instructs the user to rerun `install:global`.
- Strengthen static checks for the exact `install:xpi` package command and source-switch guardrails.
- Keep FAIL-034 open until XPI copy is actually validated with Zotero closed.

Pre batch validation:

- B17 review agent reported four P2 issues: proxy mode can write proxy while profile XPI still exists if Zotero is running, XPI mode prints a conflicting `install:global` rescan instruction, static checks are too loose, and FAIL-034 was given a closure before closed-Zotero XPI copy validation.
- `npm run check`: passed before B18 changes but did not catch these issues.

End batch validation checklist:

- `npm run check`: passed and catches missing/incorrect `install:xpi` command plus missing source-switch guardrail marker.
- `npm run install:xpi`: passed while Zotero is running; prints only XPI-specific rerun guidance and does not switch sources.
- `npm run install:global`: passed while Zotero is running; keeps proxy behavior and does not conflict with absent XPI source.
- `npm run runtime:status`: passed and reports no profile XPI source and valid development proxy.
- `npm run build`: passed, XPI SHA256 `0278efa14ba1e7b99f9c88298af808988e6c0c757d53e7ca2a248d13b5720d8a`.
- `npm run install:global`: passed after build and reported rescan pending because Zotero is running.

### B19 Crop Metadata Precision

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

Plan:

- Make preview metadata bbox reflect the actual canvas crop used to generate preview pixels.
- Clamp source pixel crop to the rendered canvas bounds after rounding.
- Add Node regression tests for selections that overlap page margins or extend beyond the canvas.
- Keep saved HTML source-region map and `open_pdf_uri` page links consistent with the actual preview pixels.

Pre batch validation:

- Git worktree clean at B19 start commit `dd01624`.
- Zotero is still running, so runtime registration smoke remains pending.
- Code review found `renderCanvasPreview()` intersects selection with the canvas for image pixels but records `bboxNormalized` from the original page selection, which can disagree when the canvas does not exactly fill the page element or the selection extends outside the canvas.

End batch validation checklist:

- `npm run check`: passed and includes crop metadata tests.
- `npm run build`: passed, XPI SHA256 `bb4ef2e01449900e89e7ebf5a1db8de9ee6bcbd0253fa129c4e5301c3320bc7c`.
- `npm run install:global`: passed without restarting Zotero and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed after B19 final fix; XPI SHA256 `bb4ef2e01449900e89e7ebf5a1db8de9ee6bcbd0253fa129c4e5301c3320bc7c`, temp child count 0, registration false, `rescan.needsRescan: true`.
- B19 review agent found source-pixel rounding mismatch and insufficient fractional tests; both were folded into this batch before commit.

### B20 Optional Helper Hard Caps

Status: complete; runtime registration pending user-controlled Zotero close, reinstall, and launch.

Plan:

- Add hard runtime clamps for optional original extraction image counts and helper timeout.
- Use the same clamped values for confirmation text and helper command arguments.
- Add static checks so these hard caps cannot be removed accidentally.

Pre batch validation:

- Git worktree clean at B20 start commit `ded7fbb`.
- Zotero is still running, so runtime registration smoke remains pending.
- Code scan found `maxPageImages`, `maxDocumentImages`, and `helperTimeoutSeconds` are read directly through `getIntegerPref()`, so manually edited prefs can bypass the UI max values.

End batch validation checklist:

- `npm run check`: passed and asserts optional helper hard cap constants/functions.
- `npm run build`: passed, XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- `npm run install:global`: passed without restarting Zotero and reported rescan pending because Zotero is running.
- `npm run runtime:status`: passed after review fixes; XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`, temp child count 0, registration false, `rescan.needsRescan: true`.
- B20 review agent found target-plan status inconsistency and weak static coverage for raw helper max-count reads; both were folded into this batch before commit.

### B21 Runtime Install Validation

Status: packaging complete; runtime registration pending manual Zotero installation.

Plan:

- Validate the closed-Zotero install path now that Zotero is not running.
- Build the current package and switch the profile source to copied XPI mode to validate the independent install fallback.
- Verify runtime status reports a valid XPI source, no development proxy, clear extension rescan prefs, and no temp files.
- Launch Zotero only after the closed-Zotero install state is clean, then run bounded runtime smoke checks.
- Reopen runtime failures whose close conditions require a successful Zotero registration or copied-XPI validation.

Pre batch validation:

- Git worktree clean at B21 start commit `76779d8`.
- `npm run runtime:status`: passed; Zotero process count 0, development proxy exists, profile XPI absent, registration false, `rescan.needsRescan: true`, and `extensions.lastAppBuildId` plus `extensions.lastAppVersion` remain in `prefs.js`.
- Plan review found `FAIL-20260706-027` and `FAIL-20260706-034` were marked closed before their close conditions were runtime-verified; recorded as `FAIL-20260706-049`.

End batch validation checklist:

- `npm run build`: passed, XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- `npm run install:xpi`: passed while Zotero was closed; copied profile XPI and cleared extension scan cache prefs.
- `npm run runtime:status` before launch: passed; `zoteroProcessCount: 0`, `rescan.needsRescan: false`, development proxy absent, profile XPI present and valid, temp child count 0.
- Zotero launch: attempted by opening `C:\Program Files\Zotero\zotero.exe`; no install confirmation popup appeared.
- `npm run smoke:wait -- -TimeoutSeconds 180 -IntervalSeconds 5`: did not reach a verified registered state before the user chose manual installation handoff.
- `npm run runtime:status` after Zotero launch: passed; Zotero process count 0, registration false, profile XPI absent, `rescan.needsRescan: true`, startup cache raw-byte add-on hint false, temp child count 0.
- Runtime install fallback remains unresolved under `FAIL-20260706-050`.
- Reader PDF smoke: pending manual Zotero installation and user-opened PDF reader.
- Final `npm run check`: passed.
- Final `npm run build`: passed, packaged XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.

### B22 Manual Install Package Handoff

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Treat manual Zotero add-on manager installation as the supported handoff path until `FAIL-20260706-050` is diagnosed.
- Add a packaging command that builds the XPI and prints the exact artifact path, SHA256, manual install steps, and post-install verification commands.
- Update README so development proxy/profile XPI fallback is no longer the primary user-facing install path.
- Add static checks for the manual package handoff contract.

Pre batch validation:

- Git worktree clean at B22 start commit `8ac61bd`.
- B21 packaged XPI exists at `outputs/pdf-image-saver-0.1.0.xpi`, size 25804 bytes.
- B21 SHA256 remains `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- README still emphasizes development install commands and needs a clearer manual install path after the copied-XPI fallback failed.

End batch validation checklist:

- `npm run package:manual`: passed; printed manual Zotero add-on manager install steps, XPI path, SHA256, byte size, and post-install verification commands.
- `npm run check`: passed.
- `npm run build`: passed, packaged XPI SHA256 `64b4b823c79afa2d04956d19ca8eab0d3ec67d56cbded82607096831ff42e097`.
- Git commit records B22: `58540f5`.

### B23 Manual Install Verification Diagnostics

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Make manual post-install validation tolerant of Zotero's real registered add-on state instead of over-requiring the development proxy/profile-XPI source shape.
- Add a read-only manual verification command that prints package identity, registration state, source hints, and next actions.
- Update README and static checks so the post-install workflow points to the manual verifier.

Pre batch validation:

- Git worktree clean at B23 start commit `58540f5`.
- B22 added `npm run package:manual`, but post-install verification still depends on `smoke:preflight`.
- `smoke:preflight` checks source validity before considering a registered active extension, so a future manual install could be falsely rejected if Zotero stores the XPI somewhere other than the profile source path currently inspected by `runtime:status`; recorded as `FAIL-20260706-051`.

End batch validation checklist:

- `npm run verify:manual`: passed; reported packaged XPI exists, Zotero process count 3, temp children 0, profile registration false, source hints false, rescan needed true, and next action to install the XPI from Zotero Add-ons.
- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed; printed `npm run verify:manual` in post-install verification commands and built XPI SHA256 `24f48b0b03c12c73bd103e2efba1f6718bef59f7d4fee39824f106737cddbdf2`.
- Git commit records B23: `405bc1d`.

### B24 Reader Listener Shutdown Hardening

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Audit core plugin shutdown and reader listener cleanup against local Zotero 9.0.5 source.
- Avoid using a Zotero 9.0.5 public unregister path that can remove unrelated reader event listeners.
- Add static checks so reader listener cleanup remains plugin-ID scoped.

Pre batch validation:

- Git worktree clean at B24 start commit `405bc1d`.
- Local Zotero 9.0.5 `app\omni.ja` source confirms `Zotero.Reader.registerEventListener(type, handler, pluginID)` and `_unregisterEventListenerByPluginID(pluginID)` exist.
- Local Zotero 9.0.5 `Zotero.Reader.unregisterEventListener(type, handler)` filters listeners with `x.type === type && x.handler === handler`, which can retain only the target listener and drop unrelated listeners; recorded as `FAIL-20260706-052`.
- `Zotero.Attachments.importFromFile()` accepts `file`, `parentItemID`, `libraryID`, `title`, `contentType`, and `charset`, matching current import calls.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `f921e70fef60d0db2a171f29f54b8df50f1aeb6095906dabff8bc4b473bc12e4`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Git commit records B24: `266f6e4`.

### B25 Helper Report Isolation

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Harden optional original-image helper execution so multiple Python candidates cannot reuse a stale `report.json`.
- Preserve missing-PyMuPDF diagnostics while detecting nonzero exits that do not produce a fresh report.
- Add static checks that each helper run removes the prior report and records helper exit code.

Pre batch validation:

- Git worktree clean at B25 start commit `266f6e4`.
- Main HTML index creation/import path matched Zotero 9.0.5 `Zotero.Attachments.importFromFile()` arguments.
- Optional helper loop reuses one `report.json` path across Python candidates, and `runProcess()` only logs nonzero exit values; recorded as `FAIL-20260706-053`.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `abd001395b50ca6bbc2b5f54866f1df408178733d5a3ba8b53667d7e38efef33`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Git commit records B25: `44cc930`.

### B26 HTML Index Regression Coverage

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Add pure-function regression coverage for the saved HTML index, because this is the artifact users sync and reopen on other machines.
- Verify source PDF links, page labels, source region metadata, annotation key normalization, embedded metadata JSON, and HTML escaping.
- Keep the test independent of Zotero runtime by using existing Node VM test harness.

Pre batch validation:

- Git worktree clean at B26 start commit `44cc930`.
- `tests/open-pdf-uri.test.js` covers URI, annotation key, source region, and canvas crop math, but does not cover `buildIndexHTML()` output.
- `buildIndexHTML()` is a pure enough function once Zotero/version/config and item field stubs are provided.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `8bb8549b63579451e191c6410805f05af3f8f6a62c34124e756fbb52623eedd6`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Git commit records B26: `4a11a40`.

### B27 Startup Preference Pane Registration

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Harden bootstrap startup around Zotero preference pane registration.
- Ensure async preference pane registration failures are awaited, logged, and do not become unhandled promise rejections during add-on startup.
- Add static checks for this startup contract.

Pre batch validation:

- Git worktree clean at B27 start commit `4a11a40`.
- Local Zotero 9.0.5 `PreferencePanes.register()` is async and can throw while resolving plugin name, icon, pane source, or scripts.
- Current `bootstrap.js` calls `Zotero.PreferencePanes.register()` without `await` or `try/catch`; recorded as `FAIL-20260706-054`.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `b30ebbd007d58228fe008c1f25575dcf4766864e1c53251c1c66ae3780f8e391`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Git commit records B27: `19f2229`.

### B28 Active Reader Targeting

Status: complete; manual Zotero install and reader smoke pending user action.

Plan:

- Harden active PDF reader selection so Tools menu commands only target the selected Zotero reader tab.
- Add direct Zotero 9.0.5 `reader._iframeWindow` support to PDF viewer context discovery.
- Add regression tests for active reader selection and direct iframe context discovery.

Pre batch validation:

- Git worktree clean at B28 start commit `19f2229`.
- Local Zotero 9.0.5 `ReaderInstance` stores the reader iframe on `reader._iframeWindow`, while current context discovery only checks `_lastView`, `_primaryView`, and internal view fields.
- Current `getActiveReader()` falls back from selected library item ID to the first PDF reader if no selected reader tab is found; recorded as `FAIL-20260706-055`.

End batch validation checklist:

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `c9372a54ba896172f43cae7e71be1e00d53d0e906d0513b013aaf620ba22c0e1`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Git commit records B28: pending.

### B29 Strict PDF Reader Type Guard

Status: complete.

Plan:

- Make PDF reader detection strict so the toolbar/context actions only appear for actual PDF readers.
- Support Zotero 9.0.5 public `reader.type`, private `_type`, and attachment reader type fallback, but do not treat missing type as PDF.
- Add regression tests for selected PDF, selected EPUB, and type-missing readers.

Pre batch validation:

- Git worktree clean at B29 start commit `374e730`.
- Local Zotero 9.0.5 `ReaderInstance` has public `get type()` returning `_type`, and `_type` is one of `pdf`, `epub`, or `snapshot`.
- Current `isPDFReader(reader)` returns true when `reader.type` is missing, which can misclassify test doubles, future API shapes, or partially initialized non-PDF readers as PDF; recorded as `FAIL-20260706-056`.

End batch validation checklist:

- `npm run check`: passed and covers strict PDF reader detection for public `reader.type`, private `_type`, attachment reader type fallback, EPUB rejection, and type-missing rejection.
- `npm run build`: passed.
- `npm run package:manual`: passed, packaged XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1`.
- `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Code review: passed; no blocking code issues found, only plan status needed closure.
- Git commit records B29: `a5cbf3c`.

### B30 Target Plan State Consistency Guard

Status: complete.

Plan:

- Close `FAIL-20260706-047` because `FAIL-20260706-045` is already closed and has matching closure evidence.
- Add a static target-plan consistency check so future failure sections cannot remain `Status: open` while also carrying a `Closure:` line.
- Keep runtime/manual-install failures open when their close conditions still depend on manual Zotero installation or closed-Zotero validation.

Pre batch validation:

- Git worktree clean at B30 start commit `0496825`.
- `FAIL-20260706-047` is still `Status: open` even though its own closure says `FAIL-045` is now closed.
- Current `scripts/check.ps1` has no generic target-plan status/closure consistency guard; recorded as `FAIL-20260706-057`.
- Validation shell resolved `npm` to `npm.ps1`, which is blocked by the Windows execution policy in this session; recorded as `FAIL-20260706-058`.
- `npm.cmd run verify:manual` failed because `runtime-status.ps1` calls `.ToString("s")` on a null Zotero process `StartTime`; recorded as `FAIL-20260706-059`.
- B30 code review found the target-plan failure-section regex can consume following non-failure sections after the last `FAIL-*` heading; recorded as `FAIL-20260706-060`.

End batch validation checklist:

- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, packaged XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1`.
- `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Plan review: passed after fixing the failure-section heading boundary and closing B30 failure states.
- Git commit records B30: `8b1e2c3`.

### B31 Original Import Hard Cap Enforcement

Status: complete.

Plan:

- Add a second runtime hard cap at the Zotero attachment import boundary for optional original image extraction.
- Do not rely only on the helper `--max-images` argument, because helper bugs or malformed reports could otherwise import too many original files.
- Add regression coverage for truncating helper reports beyond the current hard cap.
- Preserve default preview index behavior unchanged.

Pre batch validation:

- Git worktree clean at B31 start commit `25cc413`.
- Runtime helper args pass `--max-images`, but `importOriginalImages()` loops through every `report.images` entry without enforcing the cap again; recorded as `FAIL-20260706-061`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed and covers page/document import caps plus hard cap truncation.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, packaged XPI SHA256 `35cfab091a28b2a777bdab770369c95d71b1ca5e6e3105c94c8d939bbcc4a617`.
- `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Code review: passed after adding document hard-cap regression coverage.
- Git commit records B31: `fb03ce1`.

### B32 HTML Preview Entry Sanitization

Status: complete.

Plan:

- Validate preview `dataURL` before writing it into the synced HTML index.
- Normalize per-entry preview quality before reading `QUALITY[entry.quality]`, so malformed entries do not crash with an unhelpful TypeError.
- Add regression tests for malicious or malformed preview image URLs and invalid quality keys.
- Preserve default reader canvas previews unchanged.

Pre batch validation:

- Git worktree clean at B32 start commit `81600ee`.
- `buildIndexHTML()` writes `entry.dataURL` directly into `<img src="...">`; recorded as `FAIL-20260706-062`.
- `buildIndexHTML()` reads `QUALITY[entry.quality].label` without normalizing entry quality; recorded as `FAIL-20260706-063`.
- Code review found metadata schema lists `qualityEstimate`, but metadata JSON does not emit the normalized quality estimate; recorded as `FAIL-20260706-064`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed and covers malformed preview data URLs, invalid quality fallback, and normalized metadata `quality_estimate`.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, packaged XPI SHA256 `92ff8d47ac482681c309937af7404b932a778676f902ccaecfb311b3db441586`.
- `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Code review: passed after adding normalized metadata `quality_estimate`.
- Git commit records B32: `dd82bdf`.

### B33 HTML Preview BBox Normalization

Status: complete.

Plan:

- Normalize `bboxNormalized` for each HTML preview entry before rendering visible bbox text and metadata.
- Recompute `sourceRegion` from the normalized bbox so the visible source map, metadata, and bbox text stay consistent.
- Add regression tests for string/reversed/malformed bbox values.
- Preserve normal reader canvas preview bbox output unchanged.

Pre batch validation:

- Git worktree clean at B33 start commit `14f7732`.
- `buildIndexHTML()` calls `entry.bboxNormalized.map((value) => value.toFixed(4))` directly; recorded as `FAIL-20260706-065`.
- `buildIndexHTML()` only fills `sourceRegion` when it is missing, so stale or mismatched source region data can remain after bbox normalization; recorded as `FAIL-20260706-066`.
- First B33 regression test matched the substring `stale` from the entry id instead of the stale source-region label; recorded as `FAIL-20260706-067`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed after fixing the stale-label assertion token.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, packaged XPI SHA256 `c493df863c924cac3c91fc30172897963e8ce36307fd6294c7aa61489f757f33`.
- `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- Code review: passed; only plan closure remained.
- Git commit records B33: pending.

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
- B15 `npm run runtime:status`: passed and reports proxy target manifest readability, payload completeness, WebExtension UUID hint, startup cache hint, and temp child count 0.
- B15 `npm run smoke:preflight`: expected failure because extension rescan is pending and plugin is not registered; output includes WebExtension UUID versus missing `extensions.json` registration hint.
- B15 `npm run check`: passed.
- B15 `npm run build`: passed, XPI SHA256 `bcdd8fcf42017e06eff5b3523225200f1ac90237a93d3ce08b9cf8a948d80a8f`.
- B15 `npm run install:global`: passed and reported rescan pending because Zotero is running.
- B15 `npm run runtime:status` after install: passed; Zotero running, registration false, `rescan.needsRescan: true`, temp child count 0.
- B16 `npm run check`: passed.
- B16 `npm run runtime:status`: passed and reports required/optional payload split plus raw startup-cache hint.
- B16 `npm run smoke:preflight`: expected failure because extension rescan is pending and plugin is not registered; output does not include optional helper or startup-cache hard failures.
- B16 `npm run build`: passed, XPI SHA256 `bcdd8fcf42017e06eff5b3523225200f1ac90237a93d3ce08b9cf8a948d80a8f`.
- B16 `npm run install:global`: passed and reported rescan pending because Zotero is running.
- B16 `npm run runtime:status` after install: passed; Zotero running, registration false, `rescan.needsRescan: true`, temp child count 0.
- B17 `npm run check`: passed.
- B17 `npm run install:xpi`: passed in protected mode while Zotero is running and did not switch source.
- B17 `npm run build`: passed, XPI SHA256 `0278efa14ba1e7b99f9c88298af808988e6c0c757d53e7ca2a248d13b5720d8a`.
- B17 `npm run install:global`: passed and reported rescan pending because Zotero is running.
- B17 `npm run runtime:status`: passed; development proxy valid, profile XPI source absent, registration false, `rescan.needsRescan: true`, temp child count 0.
- B18 `npm run install:xpi`: passed while Zotero is running; output only points back to `npm run install:xpi`.
- B18 `npm run install:global`: passed while Zotero is running; proxy behavior retained.
- B18 first `npm run check`: failed due invalid PowerShell regex escape for `$false`; recorded as FAIL-039 before fixing.
- B18 `npm run check`: passed after regex fix.
- B18 `npm run runtime:status`: passed; development proxy valid, profile XPI source absent, registration false, `rescan.needsRescan: true`, temp child count 0.
- B18 `npm run build`: passed, XPI SHA256 `0278efa14ba1e7b99f9c88298af808988e6c0c757d53e7ca2a248d13b5720d8a`.
- B18 `npm run install:global`: passed after build and reported rescan pending because Zotero is running.
- B19 first `npm run check`: failed because crop helper assumed rect `right`/`bottom`; recorded as FAIL-041 before fixing.
- B19 second `npm run check`: failed because VM realm arrays made `deepStrictEqual` unreliable; recorded as FAIL-042 before fixing.
- B19 review agent reported source-pixel rounding mismatch; recorded as FAIL-043 before fixing.
- B19 third `npm run check`: failed because fractional test hand expectation was off by one; recorded as FAIL-044 before fixing.
- B19 `npm run check`: passed after crop helper and tests were corrected.
- B19 `npm run build`: passed, XPI SHA256 `bb4ef2e01449900e89e7ebf5a1db8de9ee6bcbd0253fa129c4e5301c3320bc7c`.
- B19 `npm run install:global`: passed and reported rescan pending because Zotero is running.
- B20 first `npm run check`: failed due invalid static regex for raw helper timeout reads; recorded as FAIL-046 before fixing.
- B20 `npm run check`: passed after regex fix.
- B20 `npm run build`: passed, XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- B20 `npm run install:global`: passed and reported rescan pending because Zotero is running.
- B20 `npm run runtime:status`: passed after review fixes; XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`, temp child count 0, registration false, `rescan.needsRescan: true`.
- B21 pre-validation `npm run runtime:status`: passed; Zotero process count 0, development proxy target valid, profile XPI absent, registration false, `rescan.needsRescan: true`, extension scan cache prefs present.
- B21 `npm run build`: passed, XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- B21 `npm run install:xpi`: passed while Zotero was closed and copied `pdf-image-saver@zlk.local.xpi` into the profile.
- B21 `npm run runtime:status` before Zotero launch: passed; profile XPI present and valid, development proxy absent, `rescan.needsRescan: false`, temp child count 0.
- B21 after Zotero launch attempt: no popup appeared; follow-up `npm run runtime:status` showed Zotero process count 0, registration false, profile XPI absent, `rescan.needsRescan: true`, startup cache raw-byte add-on hint false, temp child count 0.
- B21 final `npm run check`: passed.
- B21 final `npm run build`: passed; packaged XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187`.
- B22 `npm run package:manual`: passed; printed XPI path `outputs\pdf-image-saver-0.1.0.xpi`, SHA256 `64b4b823c79afa2d04956d19ca8eab0d3ec67d56cbded82607096831ff42e097`, size 26128 bytes, manual install steps, and post-install verification commands.
- B22 `npm run check`: passed.
- B22 `npm run build`: passed; packaged XPI SHA256 `64b4b823c79afa2d04956d19ca8eab0d3ec67d56cbded82607096831ff42e097`.
- B23 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B23 `npm run check`: passed.
- B23 `npm run build`: passed.
- B23 `npm run package:manual`: passed; packaged XPI SHA256 `24f48b0b03c12c73bd103e2efba1f6718bef59f7d4fee39824f106737cddbdf2`.
- B24 local Zotero 9.0.5 source audit: Reader event registration and attachment import API matched the plugin, but public reader unregister behavior is unsafe for unrelated listeners.
- B24 `npm run check`: passed.
- B24 `npm run build`: passed.
- B24 `npm run package:manual`: passed; packaged XPI SHA256 `f921e70fef60d0db2a171f29f54b8df50f1aeb6095906dabff8bc4b473bc12e4`.
- B24 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B25 `npm run check`: passed.
- B25 `npm run build`: passed.
- B25 `npm run package:manual`: passed; packaged XPI SHA256 `abd001395b50ca6bbc2b5f54866f1df408178733d5a3ba8b53667d7e38efef33`.
- B25 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B26 `npm run check`: passed and includes HTML index output regression coverage.
- B26 `npm run build`: passed.
- B26 `npm run package:manual`: passed; packaged XPI SHA256 `8bb8549b63579451e191c6410805f05af3f8f6a62c34124e756fbb52623eedd6`.
- B26 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B27 `npm run check`: passed.
- B27 `npm run build`: passed.
- B27 `npm run package:manual`: passed; packaged XPI SHA256 `b30ebbd007d58228fe008c1f25575dcf4766864e1c53251c1c66ae3780f8e391`.
- B27 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B28 `npm run check`: passed and covers active reader selection plus direct iframe context lookup.
- B28 `npm run build`: passed.
- B28 `npm run package:manual`: passed; packaged XPI SHA256 `c9372a54ba896172f43cae7e71be1e00d53d0e906d0513b013aaf620ba22c0e1`.
- B28 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B29 `npm run check`: passed and covers strict PDF reader detection for PDF, EPUB, and type-missing reader cases.
- B29 `npm run build`: passed.
- B29 `npm run package:manual`: passed; packaged XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1`.
- B29 `npm run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B30 `npm.cmd run check`: passed and now includes target plan open-with-closure consistency, runtime-status process metadata null safety, and strict PDF reader checks.
- B30 `npm.cmd run build`: passed.
- B30 `npm.cmd run package:manual`: passed; packaged XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1`.
- B30 `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B31 `npm.cmd run test`: passed and covers optional original import-side cap behavior.
- B31 `npm.cmd run check`: passed.
- B31 `npm.cmd run build`: passed.
- B31 `npm.cmd run package:manual`: passed; packaged XPI SHA256 `35cfab091a28b2a777bdab770369c95d71b1ca5e6e3105c94c8d939bbcc4a617`.
- B31 `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B32 `npm.cmd run test`: passed and covers HTML preview entry sanitization plus normalized `quality_estimate` metadata.
- B32 `npm.cmd run check`: passed.
- B32 `npm.cmd run build`: passed.
- B32 `npm.cmd run package:manual`: passed; packaged XPI SHA256 `92ff8d47ac482681c309937af7404b932a778676f902ccaecfb311b3db441586`.
- B32 `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.
- B33 `npm.cmd run test`: passed after fixing the stale-label assertion token.
- B33 `npm.cmd run check`: passed.
- B33 `npm.cmd run build`: passed.
- B33 `npm.cmd run package:manual`: passed; packaged XPI SHA256 `c493df863c924cac3c91fc30172897963e8ce36307fd6294c7aa61489f757f33`.
- B33 `npm.cmd run verify:manual`: passed; current state remains manual-install pending, with Zotero process count 3 and no temp leftovers.

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

### FAIL-20260706-028

- Batch: B15
- Environment: target plan and public manifest text after B14
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: plan and manifest text still imply the primary feature is original embedded image extraction and target range is `9.*`.
- Expected: execution docs and add-on metadata match the implemented independent default path: reader-canvas preview index, Zotero-synced HTML child attachment, target max `9.0.*`, optional helper only for explicit original extraction.
- Actual: plan scope had conflicting local-Python language, plugin contract still said `9.*`, and manifest description still says "Save original embedded images".
- Validation update: align target plan, manifest description, and README wording with the independent default runtime contract.
- Close condition: static checks assert manifest description and target plan contract match `9.0.*` and preview-index default wording.
- Closure: target plan now documents `7.0` to `9.0.*`, removes required local-Python wording, manifest description names lightweight synced preview indexes, and `npm run check` asserts these contracts.

### FAIL-20260706-029

- Batch: B15
- Environment: `npm run runtime:status` while Zotero registration is false
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: runtime status reports registration false but does not expose enough profile state to distinguish manifest rejection, proxy target problems, startup cache hints, or partial WebExtension UUID discovery.
- Expected: runtime diagnostics expose installed source state, manifest readability, expected payload files, WebExtension UUID prefs, and startup cache add-on-id hints.
- Actual: runtime status only reports proxy, `extensions.json` registration, rescan prefs, Zotero processes, XPI hash, and temp dir state.
- Validation update: extend runtime diagnostics and smoke preflight failure output before the next user-controlled Zotero restart.
- Close condition: `runtime:status` and `smoke:preflight` expose actionable manifest/source/cache hints without mutating the live profile.
- Closure: `runtime:status` now reports source manifest details, payload completeness, profile XPI-source state, WebExtension UUID presence, and startup cache add-on-id hint; preflight includes UUID versus missing registration hints.

### FAIL-20260706-030

- Batch: B16
- Environment: B15 runtime diagnostics source payload check
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: optional `content\helper\pdf_image_extract.py` is included in the source missing-payload list that preflight treats as a registration-blocking failure.
- Expected: default preview-index runtime does not require Python helper files; helper presence may be reported as optional diagnostics only.
- Actual: missing helper would populate `missingPayload` and trigger `Proxy target payload missing`.
- Validation update: split required and optional source payload checks.
- Close condition: `smoke:preflight` does not fail solely due to missing optional helper.
- Closure: runtime status now reports `optionalMissingPayload` separately, and preflight only hard-fails required `missingPayload`.

### FAIL-20260706-031

- Batch: B16
- Environment: B15 startup cache diagnostics
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `addonStartup.json.lz4` is compressed, but diagnostics name a direct UTF-8 raw byte search result as `containsAddonID`.
- Expected: diagnostics avoid implying reliable parsed semantics unless the cache is actually decompressed and parsed.
- Actual: raw byte decoding can produce false negatives and preflight can report a hard failure.
- Validation update: rename this field to a raw-bytes weak hint and do not fail preflight based on it.
- Close condition: startup cache hint is clearly weak and not a preflight failure condition.
- Closure: field renamed to `rawBytesContainAddonID`, runtime status includes a weak-hint note, and preflight no longer fails on startup cache raw-byte hints.

### FAIL-20260706-032

- Batch: B16
- Environment: future profile XPI fallback or formal XPI installation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: smoke preflight hard requires the development proxy and ignores `source.xpiInstall`.
- Expected: a valid development proxy or a valid profile XPI install source should satisfy source diagnostics.
- Actual: missing proxy would fail even if an XPI install source is valid.
- Validation update: validate install source with proxy-or-XPI logic.
- Close condition: preflight accepts either valid source and only reports source failure when both are invalid.
- Closure: preflight now computes `devProxyValid` and `xpiInstallValid` and only reports invalid source when both are false.

### FAIL-20260706-033

- Batch: B16
- Environment: target plan real commit log
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: real commit log omitted B14 documentation commits while later sections referenced `98bc1ba`.
- Expected: real commit log is complete enough to audit batch state transitions.
- Actual: `5b6efd0` and `98bc1ba` were missing from the real commit log at B15 review time.
- Validation update: add missing commits and keep B15/B16 commits recorded.
- Close condition: real commit log contains B14 validation and review-timeout docs commits plus B15 commit.
- Closure: real commit log now includes `5b6efd0`, `98bc1ba`, and `1ef08d1`.

### FAIL-20260706-034

- Batch: B17
- Environment: install script and profile source diagnostics
- Zotero version target: 9.0.5
- Severity: P2
- Status: open
- Symptom: runtime diagnostics and preflight can recognize a profile XPI install source, but no install script can create one.
- Expected: there is a documented command to switch a profile from development proxy install to copied XPI install after Zotero is closed.
- Actual: `npm run install:global` only writes a development proxy path into the profile.
- Validation update: add XPI install mode/script and static checks.
- Close condition: XPI fallback command exists, refuses unsafe live source switching while Zotero is running, and can copy the built XPI when Zotero is closed.
- Partial progress: `npm run install:xpi` exists and refuses unsafe live source switching while Zotero is running; closed-Zotero XPI copy validation remains pending.

### FAIL-20260706-035

- Batch: B18
- Environment: proxy install mode with an existing profile XPI source and Zotero running
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: proxy mode can leave both a development proxy and copied XPI source in the profile.
- Expected: source switching is rejected while Zotero is running, preventing dual-source state.
- Actual: if a profile XPI exists and Zotero is running, the script warns but still writes the proxy file.
- Validation update: make `Install-DevelopmentProxy` return without writing proxy when source switching cannot safely remove the profile XPI.
- Close condition: static check enforces the guarded return and runtime output does not switch source while Zotero is running.
- Closure: `Install-DevelopmentProxy` now returns `$false` before writing proxy when a profile XPI exists and Zotero is running; static check asserts this guard.

### FAIL-20260706-036

- Batch: B18
- Environment: XPI install mode with Zotero running
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `install:xpi` prints an XPI rerun instruction and then the generic rescan instruction tells the user to rerun `install:global`.
- Expected: XPI mode only tells the user to close Zotero and rerun `npm run install:xpi`.
- Actual: generic rescan message points to `install:global`, which switches back to proxy mode.
- Validation update: make source-switch and rescan guidance mode-specific.
- Close condition: `npm run install:xpi` output while Zotero is running does not mention rerunning `install:global`.
- Closure: `Enable-ExtensionDirectoryRescan` now receives a mode-specific retry command; `install:xpi` output only points to `npm run install:xpi`.

### FAIL-20260706-037

- Batch: B18
- Environment: static install-script validation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `npm run check` did not catch B17 source-switch bugs.
- Expected: static checks cover the exact `install:xpi` command and source-switch guardrail markers.
- Actual: checks only looked for loose strings.
- Validation update: assert exact package script and guarded return markers.
- Close condition: removing guardrail marker or changing `install:xpi` command makes `npm run check` fail.
- Closure: `npm run check` now asserts exact `install:xpi` command, guarded return marker, and mode-specific retry command marker.

### FAIL-20260706-038

- Batch: B18
- Environment: target plan execution source
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: FAIL-034 had a closure line before closed-Zotero XPI copy validation.
- Expected: FAIL-034 remains open until copied XPI install is validated while Zotero is closed.
- Actual: B17 documented a closure after only live-runner refusal was verified.
- Validation update: downgrade closure to partial progress and add closed-Zotero validation to pending checklist.
- Close condition: plan keeps FAIL-034 open until actual closed-Zotero XPI copy succeeds.
- Closure: FAIL-034 remains open with only partial progress recorded, and B18 status notes closed-Zotero XPI copy validation is still pending.

### FAIL-20260706-039

- Batch: B18
- Environment: `npm run check` with PowerShell regex for source-switch guard
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: static guardrail regex for `return $false` expands `$false` inside a double-quoted PowerShell string and produces an invalid regex escape.
- Expected: static check regex treats `$false` literally.
- Actual: `npm run check` fails with `Unrecognized escape sequence \F`.
- Validation update: use a single-quoted regex or escaped dollar for the guardrail assertion.
- Close condition: `npm run check` passes and still catches missing guarded return.
- Closure: guardrail regex now uses a single-quoted pattern, and `npm run check` passes.

### FAIL-20260706-040

- Batch: B19
- Environment: manual clip or auto raster preview when the rendered canvas does not exactly match the page element rectangle
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: preview pixels are cropped from the intersection of the user selection and rendered canvas, but metadata `bbox_normalized` is computed from the original selection relative to the page element.
- Expected: `bbox_normalized` and source region map describe the actual preview pixels that were saved.
- Actual: selecting into page margins or any page/canvas offset can make saved metadata point to a larger or shifted source region than the preview.
- Validation update: compute a reusable canvas crop model that returns clamped source pixels and normalized page bbox from the actual crop client rectangle.
- Close condition: tests prove actual bbox matches canvas intersection, not original out-of-canvas selection.
- Closure: `calculateCanvasCrop()` now drives both `drawImage()` source pixels and metadata bbox, and tests cover canvas/page offset plus page-edge clipping.

### FAIL-20260706-041

- Batch: B19
- Environment: `npm run check` crop metadata regression test
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: crop helper assumes `canvasRect.right` and `canvasRect.bottom` are present.
- Expected: helper works with any rectangle carrying `left`, `top`, `width`, and `height`, matching test fixtures and non-DOM callers.
- Actual: missing `right`/`bottom` produces `NaN` crop edges and bbox fallback values `[0.1, 0.1, 1, 1]`.
- Validation update: normalize rectangles to include right and bottom before intersection.
- Close condition: crop metadata regression tests pass.
- Closure: `rectWithEdges()` normalizes test and DOM rectangles before intersection, and crop metadata tests pass.

### FAIL-20260706-042

- Batch: B19
- Environment: Node VM regression tests
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `assert.deepStrictEqual()` reports identical bbox arrays as unequal.
- Expected: regression test compares values, not VM realm array prototypes.
- Actual: arrays returned from the VM context have a different prototype from the host test context.
- Validation update: convert VM arrays with `Array.from()` before deep equality assertions.
- Close condition: crop metadata regression tests compare values and pass.
- Closure: crop tests now use `Array.from()` for VM-returned arrays, and `npm run check` passes.

### FAIL-20260706-043

- Batch: B19
- Environment: non-integer rendered canvas scale or fractional user selection
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `bbox_normalized` is computed from the floating client rectangle before source pixel rounding, while `drawImage` uses floored/ceiled source pixels.
- Expected: metadata bbox describes the exact source pixel rectangle used by `drawImage`.
- Actual: saved preview pixels can expand by up to one source pixel on each edge, while bbox records the narrower pre-rounded crop.
- Validation update: compute bbox from final `sourceX/sourceY/sourceRight/sourceBottom` projected back into page coordinates.
- Close condition: regression tests include a fractional/non-integer scale case proving bbox follows rounded source pixels.
- Closure: bbox is now projected from rounded `drawImage()` source pixels, and fractional scale regression test asserts the rounded source-pixel bbox.

### FAIL-20260706-044

- Batch: B19
- Environment: fractional crop regression test
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: fractional crop test expected `sourceHeight` 115 but helper returned 114.
- Expected: test expectation matches the ceil/floor source-pixel math.
- Actual: hand-calculated expectation was off by one.
- Validation update: correct expected source height and projected bbox values from actual source pixel boundaries.
- Close condition: fractional crop regression test passes.
- Closure: fractional crop expected source height and projected bbox values were corrected, and `npm run check` passes.

### FAIL-20260706-045

- Batch: B20
- Environment: optional original extraction with manually edited Zotero prefs
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: optional helper max image count and timeout rely on preference UI max values but runtime reads raw prefs directly.
- Expected: optional original extraction is hard-capped in runtime code even if prefs are manually edited.
- Actual: `maxPageImages`, `maxDocumentImages`, and `helperTimeoutSeconds` can exceed UI max values through edited prefs.
- Validation update: add hard cap constants and clamped helper getter functions.
- Close condition: confirmation text, helper args, and process timeout all use hard-clamped values and static checks assert the guardrails.
- Closure: confirmation text and helper args now use `getHelperMaxImages()`, process timeout uses `getHelperTimeoutSeconds()`, and `npm run check` asserts hard cap constants and getters.

### FAIL-20260706-046

- Batch: B20
- Environment: `npm run check` static regex for raw helper timeout reads
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: new static regex for direct helper timeout reads has invalid grouping and fails with `Too many )'s`.
- Expected: static check detects direct raw helper timeout usage without invalid regex syntax.
- Actual: `npm run check` fails before validating the code.
- Validation update: simplify the regex to a valid direct-pattern check.
- Close condition: `npm run check` passes.
- Closure: static regex was simplified and `npm run check` passes.

### FAIL-20260706-047

- Batch: B20
- Environment: target plan execution source
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: FAIL-045 remains open even though B20 status is complete and FAIL-045 has a closure.
- Expected: closed failures with closure have `Status: closed`.
- Actual: target plan state is internally inconsistent.
- Validation update: correct FAIL-045 status.
- Close condition: FAIL-045 status and closure are consistent.
- Closure: FAIL-045 status is now closed and matches its closure text.

### FAIL-20260706-048

- Batch: B20
- Environment: static helper hard-cap validation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: static checks confirm hard-clamped helper getters exist but do not prevent raw `maxPageImages` or `maxDocumentImages` reads outside the getter.
- Expected: `npm run check` fails if confirmation text or helper args bypass `getHelperMaxImages()`.
- Actual: a future regression could reintroduce direct `getIntegerPref()` reads and still pass check.
- Validation update: assert call count for `getHelperMaxImages()` and fail on raw helper image-count pref reads outside the getter body.
- Close condition: static checks cover both current call sites and raw-read regressions.
- Closure: `npm run check` now asserts `getHelperMaxImages()` call count and rejects raw helper image-count pref reads outside the getter.

### FAIL-20260706-049

- Batch: B21
- Environment: target plan execution source
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: runtime install failures were marked closed before their runtime close conditions were actually verified.
- Expected: `FAIL-20260706-027` remains open until Zotero registers the plugin after launch, and `FAIL-20260706-034` remains open until copied-XPI install is validated while Zotero is closed.
- Actual: both failures had `Status: closed` even though B21 pre-validation still showed registration false and XPI source absent.
- Validation update: reopen the two runtime failures and add B21 closed-Zotero XPI plus runtime registration validation to the batch checklist.
- Close condition: target plan status matches the real runtime validation state.
- Closure: `FAIL-20260706-027` and `FAIL-20260706-034` are open again until their runtime checks pass.

### FAIL-20260706-050

- Batch: B21
- Environment: copied profile XPI fallback followed by Zotero launch
- Zotero version target: 9.0.5
- Severity: P1
- Status: open
- Symptom: after `npm run install:xpi` successfully copied the profile XPI and cleared rescan prefs, launching Zotero produced no confirmation popup and follow-up runtime diagnostics showed the profile XPI absent and registration false.
- Expected: copied profile XPI remains in `extensions`, Zotero scans it, and the add-on becomes registered or reports a clear rejection reason.
- Actual: profile XPI is gone after launch, `extensions.lastAppBuildId` and `extensions.lastAppVersion` are back in `prefs.js`, startup cache raw-byte add-on hint is false, and `extensions.json` has no registered add-on entry.
- Validation update: manual Zotero add-on manager installation from the packaged XPI is now the next runtime validation path; source-copy fallback needs a separate diagnostic batch before it can be considered reliable.
- Close condition: either manual install registers the packaged XPI, or source-copy fallback is diagnosed and fixed with evidence that Zotero preserves and registers the copied XPI.

### FAIL-20260706-051

- Batch: B23
- Environment: manual Zotero add-on manager installation with a registered extension whose source path is not the development proxy or the inspected profile XPI fallback path
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `smoke:preflight` can fail on "No valid extension source" before accepting a registered and active add-on.
- Expected: once `extensions.json` proves the add-on is registered and active, smoke preflight should accept runtime registration even if source shape diagnostics are incomplete.
- Actual: source validation is evaluated independently and can reject a valid manual install whose package source is not represented by `source.developmentProxy` or `source.xpiInstall`.
- Validation update: make source validity a required fallback only while the plugin is unregistered; add a separate read-only manual verifier for post-install state.
- Close condition: `smoke:preflight` accepts a registered active add-on, and `npm run verify:manual` reports clear next actions when the add-on is not yet installed.
- Closure: source validation now only blocks while registration is missing, `npm run verify:manual` reports package, profile, registration, source hints, rescan state, temp children, and next action, and B23 checks pass.

### FAIL-20260706-052

- Batch: B24
- Environment: plugin shutdown or add-on reload with other reader event listeners registered in Zotero 9.0.5
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: plugin shutdown calls `Zotero.Reader.unregisterEventListener(type, handler)` for each handler.
- Expected: removing this plugin's reader handlers must not remove unrelated reader listeners registered by Zotero or other plugins.
- Actual: local Zotero 9.0.5 source shows public `unregisterEventListener(type, handler)` keeps only listeners matching the passed type and handler, which can drop unrelated listeners during the first unregister call.
- Validation update: use Zotero's plugin-ID scoped unregister path when available, and fall back to filtering `_registeredListeners` by plugin ID rather than iterating the public unregister function.
- Close condition: static checks confirm cleanup uses `_unregisterEventListenerByPluginID(config.id)` or plugin-ID filtering and does not call public `unregisterEventListener(type, handler)` in the normal path.
- Closure: reader cleanup now uses `_unregisterEventListenerByPluginID(config.id)` when available and plugin-ID filtering as fallback; static checks assert both guards.

### FAIL-20260706-053

- Batch: B25
- Environment: optional original-image helper with multiple Python candidates, for example conda `zlk`, env vars, and PATH candidates
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: helper attempts share one `report.json`, and `runProcess()` logs nonzero exits without making the caller distinguish a fresh report from a stale report.
- Expected: each helper candidate must either produce a fresh report that is attributed to that command and exit code, or fail clearly without reading a previous candidate's report.
- Actual: if candidate A writes a report and exits nonzero, candidate B exits nonzero without writing a report, the caller can read candidate A's stale report as if candidate B produced it.
- Validation update: delete `report.json` before each candidate, return helper exit codes from `runProcess()`, require a fresh report after each process run, and store the exit code in helper metadata.
- Close condition: static checks assert report removal before each candidate and helper exit-code recording.
- Closure: each helper candidate now removes `report.json` before process start, requires a fresh report after process completion, records `helper.exit_code`, and `runProcess()` returns the exit code.

### FAIL-20260706-054

- Batch: B27
- Environment: plugin startup in Zotero 9.0.5 while preference pane registration rejects
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `bootstrap.js` calls async `Zotero.PreferencePanes.register()` without `await` or error handling.
- Expected: preference pane registration should be awaited or explicitly caught so startup logs preference failures without unhandled promise rejections.
- Actual: local Zotero 9.0.5 source shows `register()` awaits plugin name, icon, source, and script URI resolution and can throw, but plugin startup does not await it.
- Validation update: wrap preference pane registration in an awaited helper that catches/logs failures and continues loading the core reader plugin.
- Close condition: static checks assert startup awaits a preference registration helper and that helper catches registration errors.
- Closure: startup now awaits `registerPreferencePane(id, rootURI)`, and the helper catches/logs preference pane registration failures before continuing core plugin load.

### FAIL-20260706-055

- Batch: B28
- Environment: Tools menu command while a non-reader Zotero tab or library item is selected and at least one PDF reader is open elsewhere
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `getActiveReader()` can fall back to the first PDF reader when no selected reader tab matches.
- Expected: Tools menu clipping should only target the selected PDF reader tab, or report that no active PDF reader is available.
- Actual: selected library item IDs can be passed through reader lookup and then the function returns the first PDF reader, risking clipping/saving the wrong paper.
- Validation update: use Zotero tab selected ID only, do not use selected library items as tab IDs, and remove the first-reader fallback.
- Close condition: regression tests prove selected tab match succeeds and non-reader selection returns null even when other PDF readers exist.
- Closure: `getActiveReader()` now uses Zotero selected tab ID only and returns null without a selected PDF reader tab; context lookup also checks direct `reader._iframeWindow`.

### FAIL-20260706-056

- Batch: B29
- Environment: reader event dispatch or Tools menu selection with EPUB/snapshot readers or partially initialized reader objects
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `isPDFReader(reader)` returns true when `reader.type` is missing.
- Expected: only readers with an explicit PDF type or PDF attachment reader type are accepted.
- Actual: missing `reader.type` is treated as PDF, allowing non-PDF or partial reader objects through PDF-only toolbar/context/diagnostic paths.
- Validation update: derive reader type from `reader.type`, `reader._type`, or `reader._item.attachmentReaderType`, and require it to equal `pdf`.
- Close condition: regression tests prove PDF readers are accepted while EPUB and type-missing readers are rejected.
- Closure: `isPDFReader()` now delegates to `getReaderType()` and requires an explicit `pdf` type; regression tests and `scripts/check.ps1` cover the guard.

### FAIL-20260706-057

- Batch: B30
- Environment: target plan execution source after multiple documentation and code batches
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: a failure section can remain `Status: open` while also containing a `Closure:` line.
- Expected: target plan state cannot silently drift after a closure is recorded.
- Actual: `FAIL-20260706-047` kept `Status: open` even though it had a closure and its close condition was satisfied.
- Validation update: add a static check that fails when any `FAIL-*` section contains both `Status: open` and `Closure:`.
- Close condition: `npm run check` fails on open-with-closure failure sections and passes after `FAIL-20260706-047` is closed.
- Closure: `scripts/check.ps1` now rejects open failure sections that contain closure evidence, and `FAIL-20260706-047` is closed.

### FAIL-20260706-058

- Batch: B30
- Environment: PowerShell validation command execution in the managed sandbox
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `npm run check` fails before project scripts run because PowerShell resolves `npm` to `npm.ps1`.
- Expected: validation commands run without changing host execution policy.
- Actual: Windows execution policy blocks `C:\Program Files\nodejs\npm.ps1`.
- Validation update: run npm scripts as `npm.cmd ...` in this shell and document the fallback if needed.
- Close condition: B30 validation commands complete through `npm.cmd` without changing PowerShell execution policy.
- Closure: B30 validation completed through `npm.cmd` without changing host execution policy.

### FAIL-20260706-059

- Batch: B30
- Environment: read-only manual installer verification while Zotero process metadata is partially unavailable
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `npm.cmd run verify:manual` fails inside `runtime-status.ps1`.
- Expected: runtime status tolerates missing or inaccessible process fields and still reports Zotero process count.
- Actual: `runtime-status.ps1` calls `$_.StartTime.ToString("s")` and crashes when `StartTime` is null.
- Validation update: format Zotero process metadata with null-safe helpers for `StartTime` and `Path`.
- Close condition: `npm.cmd run verify:manual` passes when Zotero process metadata is incomplete.
- Closure: `runtime-status.ps1` now uses null-safe process metadata helpers and `npm.cmd run verify:manual` passes.

### FAIL-20260706-060

- Batch: B30
- Environment: target plan consistency static check near the end of `docs/target-mode-plan.md`
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the failure-section regex stops only at the next `###` heading or EOF.
- Expected: a `FAIL-*` section ends before the next Markdown heading at any level.
- Actual: the last `FAIL-*` section can include later `## Revised Validation Checklist` or `## Real Commit Log` content and falsely detect closure evidence there.
- Validation update: stop failure-section parsing at the next Markdown heading of any level.
- Close condition: `scripts/check.ps1` uses a heading-boundary regex that cannot include later `##` sections in a failure body.
- Closure: `scripts/check.ps1` now stops failure-section parsing at any Markdown heading level.

### FAIL-20260706-061

- Batch: B31
- Environment: optional original image extraction when the helper returns more image records than requested
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `importOriginalImages()` imports every `report.images` entry.
- Expected: Zotero import code enforces the same hard image count cap as helper invocation.
- Actual: the helper receives `--max-images`, but a bad or stale report with extra images could still create too many Zotero attachments.
- Validation update: add an import-side limiter that truncates report images to `getHelperMaxImages(scope)` before creating attachments.
- Close condition: regression tests prove over-cap helper reports are truncated before import, and static checks assert the import path uses the limiter.
- Closure: `limitOriginalImagesForImport()` now truncates page and document reports at the import boundary, tests cover configured caps and hard caps, and static checks reject direct raw report iteration.

### FAIL-20260706-062

- Batch: B32
- Environment: synced HTML preview index creation from preview entry data
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildIndexHTML()` writes `entry.dataURL` directly into `<img src="...">`.
- Expected: preview image URLs are constrained to safe base64 image data URLs before HTML output.
- Actual: malformed or unexpected preview data can become a broken or unsafe HTML attribute.
- Validation update: add a preview data URL sanitizer and escape the resulting `src` attribute.
- Close condition: regression tests reject malformed preview data URLs and static checks assert the sanitizer is used.
- Closure: `normalizePreviewDataURL()` now rejects malformed preview URLs before HTML output, `<img src>` escapes the normalized value, and tests/static checks cover the guard.

### FAIL-20260706-063

- Batch: B32
- Environment: synced HTML preview index creation with malformed preview entry quality
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildIndexHTML()` reads `QUALITY[entry.quality].label` without normalizing `entry.quality`.
- Expected: invalid preview entry quality falls back to Medium with the matching size estimate.
- Actual: malformed entry quality throws an unhelpful TypeError and can skip cleanup only through the generic index error path.
- Validation update: normalize per-entry quality before HTML and metadata output.
- Close condition: regression tests prove invalid entry quality becomes Medium and static checks assert normalized entry quality is used.
- Closure: `buildIndexHTML()` normalizes entry quality and quality estimate before HTML/metadata output, and regression tests cover invalid quality fallback.

### FAIL-20260706-064

- Batch: B32
- Environment: synced HTML preview index metadata JSON
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: metadata schema lists `qualityEstimate`, but `metadata.entries[]` omits it.
- Expected: synced metadata includes the normalized preview quality estimate shown in the HTML UI.
- Actual: B32 normalizes `entry.qualityEstimate` for display but metadata JSON does not record it.
- Validation update: add `quality_estimate` to metadata entries after entry quality normalization.
- Close condition: regression tests prove metadata includes normalized `quality_estimate`, and static checks assert the field is emitted.
- Closure: metadata entries now include normalized `quality_estimate`, and regression/static checks cover it.

### FAIL-20260706-065

- Batch: B33
- Environment: synced HTML preview index creation with malformed preview bbox data
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildIndexHTML()` calls `entry.bboxNormalized.map((value) => value.toFixed(4))` directly.
- Expected: bbox metadata is normalized to four finite normalized numbers before visible and JSON output.
- Actual: malformed bbox entries can throw unhelpful errors or produce inconsistent output.
- Validation update: add `normalizeBBoxNormalized()` and apply it before source region and HTML output.
- Close condition: regression tests prove malformed bbox input is normalized and static checks assert direct bbox mapping is not used before normalization.
- Closure: `buildIndexHTML()` now normalizes bbox values before visible and JSON output; regression and static checks cover malformed and reversed bbox input.

### FAIL-20260706-066

- Batch: B33
- Environment: synced HTML preview index creation when preview entries carry stale `sourceRegion`
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildIndexHTML()` keeps an existing `entry.sourceRegion` even if it no longer matches `entry.bboxNormalized`.
- Expected: saved HTML source map, metadata `source_region`, and visible bbox text are derived from the same normalized bbox.
- Actual: stale source region data can disagree with normalized bbox metadata.
- Validation update: recompute `sourceRegion` from normalized bbox during HTML index build.
- Close condition: regression tests prove stale source region is replaced and static checks assert source region is rebuilt from normalized bbox.
- Closure: `buildIndexHTML()` now rebuilds `sourceRegion` from normalized bbox, and tests prove stale source-region labels are replaced.

### FAIL-20260706-067

- Batch: B33
- Environment: B33 HTML source-region regression test
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the test for stale source-region removal fails even after source region is rebuilt.
- Expected: the test should detect the stale source-region label only.
- Actual: the assertion matches `stale` inside the test entry id `entry-stale-region`.
- Validation update: use a unique stale label token that does not appear elsewhere in the generated HTML.
- Close condition: `npm.cmd run test` passes while still proving the stale label is absent.
- Closure: the test now uses `OBSOLETE_REGION_LABEL`, and `npm.cmd run test` passes while still checking stale label removal.

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
- Check manifest and plan wording make reader preview index the independent default and original extraction optional.
- Check runtime diagnostics include installed source state, manifest readability, expected payload files, WebExtension UUID prefs, and startup cache add-on-id hints.
- Check optional helper diagnostics do not make the default runtime source invalid.
- Check startup cache add-on-id scan is labeled as raw-byte weak hint unless decompressed parsing is implemented.
- Check smoke preflight accepts valid development proxy or valid profile XPI source.
- Check real commit log includes documentation-only batch commits.
- Check install scripts expose a copied-XPI fallback for independent profile installation.
- Check install scripts reject live source switching in both directions.
- Check XPI install mode does not tell the user to rerun proxy install.
- Check preview bbox metadata reflects the actual rendered canvas crop.
- Check optional original helper count and timeout prefs are hard-clamped in runtime.
- Check target plan does not close runtime failures before their close conditions are validated.
- Check copied-XPI profile fallback survives Zotero launch or clearly hand off to manual add-on manager installation.
- Check manual install verifier reports package identity, registration state, source hints, rescan state, temp children, and next action.
- Check reader event listener cleanup is scoped by plugin ID and does not remove unrelated listeners.
- Check optional helper report files are isolated per Python candidate and helper exit codes are recorded.
- Check HTML index output includes escaped title text, Zotero source PDF links, source region map, metadata JSON, source region metadata, and normalized annotation keys.
- Check bootstrap awaits preference pane registration through a catch/log helper so pane failures do not become unhandled startup rejections.
- Check Tools menu active reader selection never falls back to selected library items or arbitrary first PDF reader.
- Check PDF viewer context lookup supports Zotero 9.0.5 direct `reader._iframeWindow`.
- Check PDF reader detection requires explicit `pdf` type from `reader.type`, `reader._type`, or `reader._item.attachmentReaderType`, and rejects EPUB plus type-missing readers.
- Check target plan failure sections cannot have `Status: open` and `Closure:` at the same time.
- Check Windows PowerShell validation can use `npm.cmd` when `npm.ps1` is blocked by execution policy.
- Check runtime status handles null or inaccessible Zotero process `StartTime` and `Path` fields.
- Check target-plan failure-section parsing stops before the next Markdown heading at any level.
- Check optional original-image import enforces the helper image hard cap even if the helper report contains too many images.
- Check synced HTML preview index rejects malformed preview data URLs before writing `<img src>`.
- Check synced HTML preview index normalizes malformed preview entry quality to Medium.
- Check synced HTML preview metadata includes normalized `quality_estimate`.
- Check synced HTML preview index normalizes bbox values before visible and JSON output.
- Check synced HTML preview source region is rebuilt from the normalized bbox.

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
- `5d54001` B14 fix manifest compatibility and preflight count.
- `5b6efd0` docs record B14 validation.
- `98bc1ba` docs record B14 review timeout.
- B14 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `1ef08d1` B15 add runtime registration diagnostics.
- B15 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `45defcc` B16 harden runtime diagnostics checks.
- B16 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `64dd171` docs record B16 validation.
- `439179e` B18 guard Zotero install source switches.
- B17/B18 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `dd01624` docs record B18 validation.
- `a3ba2a4` B19 align preview crop metadata.
- B19 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `ded7fbb` docs record B19 validation.
- `c8b887b` B20 hard cap optional helper prefs.
- B20 XPI and SHA256 were built in `outputs/` and installed globally, but remain ignored build outputs rather than committed files.
- `76779d8` docs record B20 validation.
- B21 XPI SHA256 `a3b6576c66b2ee3c5b5be9cfb38b85d42b2d78c2585d6ce1701a71a382518187` was built in `outputs/` for manual Zotero add-on manager installation; runtime source-copy fallback remains open under `FAIL-20260706-050`.
- `58540f5` B22 add manual package handoff.
- B22 XPI SHA256 `64b4b823c79afa2d04956d19ca8eab0d3ec67d56cbded82607096831ff42e097` was built in `outputs/` for manual Zotero add-on manager installation.
- `405bc1d` B23 add manual install verifier.
- B23 XPI SHA256 `24f48b0b03c12c73bd103e2efba1f6718bef59f7d4fee39824f106737cddbdf2` was built in `outputs/` for manual Zotero add-on manager installation.
- `266f6e4` B24 scope reader listener cleanup.
- B24 XPI SHA256 `f921e70fef60d0db2a171f29f54b8df50f1aeb6095906dabff8bc4b473bc12e4` was built in `outputs/` for manual Zotero add-on manager installation.
- `44cc930` B25 isolate helper reports.
- B25 XPI SHA256 `abd001395b50ca6bbc2b5f54866f1df408178733d5a3ba8b53667d7e38efef33` was built in `outputs/` for manual Zotero add-on manager installation.
- `4a11a40` B26 cover HTML index output.
- B26 XPI SHA256 `8bb8549b63579451e191c6410805f05af3f8f6a62c34124e756fbb52623eedd6` was built in `outputs/` for manual Zotero add-on manager installation.
- `19f2229` B27 harden startup preference pane.
- B27 XPI SHA256 `b30ebbd007d58228fe008c1f25575dcf4766864e1c53251c1c66ae3780f8e391` was built in `outputs/` for manual Zotero add-on manager installation.
- `374e730` B28 target selected reader tab.
- B28 XPI SHA256 `c9372a54ba896172f43cae7e71be1e00d53d0e906d0513b013aaf620ba22c0e1` was built in `outputs/` for manual Zotero add-on manager installation.
- `a5cbf3c` B29 require explicit PDF reader type.
- B29 XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1` was built in `outputs/` for manual Zotero add-on manager installation.
- `8b1e2c3` B30 guard target plan consistency.
- B30 XPI SHA256 `a5392ab2329053045eb709071deac81f4f0906eb2f45194dfc6b5daefbe0b0e1` was built in `outputs/` for manual Zotero add-on manager installation.
- `fb03ce1` B31 enforce original import cap.
- B31 XPI SHA256 `35cfab091a28b2a777bdab770369c95d71b1ca5e6e3105c94c8d939bbcc4a617` was built in `outputs/` for manual Zotero add-on manager installation.
- `dd82bdf` B32 sanitize HTML preview entries.
- B32 XPI SHA256 `92ff8d47ac482681c309937af7404b932a778676f902ccaecfb311b3db441586` was built in `outputs/` for manual Zotero add-on manager installation.
- B33 XPI SHA256 `c493df863c924cac3c91fc30172897963e8ce36307fd6294c7aa61489f757f33` was built in `outputs/` for manual Zotero add-on manager installation.
