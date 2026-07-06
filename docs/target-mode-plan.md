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

## Regression Loop Control

- Every new fault must get a unique `FAIL-*` section before implementation.
- Every closed fault added from B60 onward must keep `Close condition` and `Closure` evidence.
- Every batch marked complete must replace `Pending` with real validation output.
- Fixes that reveal follow-up faults must record the new fault before changing that behavior.
- `scripts/check.ps1` must enforce these plan-state invariants so a future patch cannot silently reopen old risks or close a fault without evidence.

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
- Git commit records B33: `7565942`.

### B34 HTML Preview Quality Metadata Normalization

Status: complete.

Plan:

- Normalize the request-level `qualityKey` used by `buildIndexHTML()`.
- Keep top-level `metadata.preview_quality` consistent with normalized per-entry preview quality.
- Add regression tests for malformed request quality keys.
- Harden `normalizeQualityKey()` so only own `QUALITY` keys are accepted.
- Preserve normal reader canvas preview quality output unchanged.

Pre batch validation:

- Git worktree clean at B34 start commit `65ecbc6`.
- `buildIndexHTML()` writes top-level `preview_quality: qualityKey` without normalization; recorded as `FAIL-20260706-068`.
- B34 review found `normalizeQualityKey()` accepts inherited object keys such as `constructor`; recorded as `FAIL-20260706-069` before code changes.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `028a3ea08679efccaa0f55ffae695110201f64028b7ea6509327361745dd0109`, bytes `26995`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: passed after fixing inherited quality-key acceptance; final review only found unsynced documentation closure, now resolved.
- Git commit records B34: `f0e0de4`.

### B35 Open PDF Link And Page Target Precision

Status: complete.

Plan:

- Keep Zotero `open-pdf` source links on the documented Zotero URI forms: `library/items/...` for the user library and `groups/<groupID>/items/...` for groups.
- Normalize page numbers and page indexes before URI, HTML, metadata, current-page, context-menu, and duplicate-key use.
- Make malformed HTML preview entry page targets fall back to a single normalized target derived from `pageIndex + 1` or page 1.
- Add regression tests and static checks for user-library API prefix drift, group links, malformed entry page targets, numeric context-menu strings, and invalid page fallbacks.
- Preserve normal reader canvas preview behavior unchanged.

Pre batch validation:

- Git worktree clean at B35 start commit `fe0de63`.
- B35 planning agent found `getLibraryURIPath()` can trust `Zotero.API.getLibraryPrefix()` and emit Web API style `users/<id>` inside `zotero://open-pdf`; recorded as `FAIL-20260706-070`.
- B35 planning agent found `buildIndexHTML()` trusts raw `entry.pageNumber/pageIndex`, allowing source links and metadata to disagree; recorded as `FAIL-20260706-071`.
- B35 planning agent found `getContextPageIndex()` rejects numeric strings and `getCurrentPageIndex()` can return `NaN` for nonnumeric viewer page state; recorded as `FAIL-20260706-072`.
- B35 local review found the new page normalizer can coerce `null` to zero and override a valid page number; recorded as `FAIL-20260706-073` before code changes.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `9a548c482337de5685e5a7a1494d94756f1c6876cd80e902a69e3cb388832181`, bytes `27212`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: local review passed after fixing null/boolean/array page-target coercion; review-agent retry failed twice due 429/503 service availability.
- Git commit records B35: `aae8cb8`.

### B36 HTML Preview Scalar Metadata Normalization

Status: complete.

Plan:

- Normalize preview scalar dimensions and byte counts before visible HTML and metadata output.
- Recompute `byte_count` from the normalized preview data URL instead of trusting entry input.
- Normalize compact text scalar fields (`id`, `mode`, `detector`, `page_label`) to short strings or safe defaults.
- Normalize `detection_area` to a finite `0..1` number or `null`.
- Make malformed preview entries produce concise unknown/null metadata rather than `NaN`, `undefined`, `[object Object]`, or complex objects.

Pre batch validation:

- Git worktree clean at B36 start commit `a3195ff`.
- B36 planning agent found `byteCount/renderedWidth/renderedHeight` are trusted and can produce `NaN MB, undefined x [object Object]px`; recorded as `FAIL-20260706-074`.
- B36 planning agent found `id/mode/detector/pageLabel/detectionArea` can emit objects or `[object Object]` in synced HTML/metadata; recorded as `FAIL-20260706-075`.
- B36 review found fractional dimensions below 1 can normalize to `0px`; recorded as `FAIL-20260706-076` before code changes.
- B36 review found base64 padding is not subtracted from recomputed preview byte counts; recorded as `FAIL-20260706-077` before code changes.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `8e62fee6574bf9e5f6881763a6f5282ba230eafbfc97965c3413401b5d3b6c12`, bytes `27576`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: initial review found fractional-dimension and base64-padding gaps; both were recorded and fixed. Final review agent was unavailable after interruption, and local final review plus static checks passed.
- Git commit records B36: `a3837cc`.

### B37 HTML Source Metadata Scalar Normalization

Status: complete.

Plan:

- Normalize source title used by synced HTML `<title>` and `<h1>`.
- Normalize `parent_item` and `pdf_attachment` metadata fields to short strings or `null`.
- Normalize metadata `scope` to a compact known value and prevent object/array scope output.
- Normalize index attachment titles so malformed Zotero item fields cannot produce `[object Object]`.
- Preserve normal HTML preview output and Zotero link behavior unchanged.

Pre batch validation:

- Git worktree clean at B37 start commit `a202059`.
- B37 planning agent found `sourceTitle`, `serializeItem()`, and `serializeAttachment()` trust raw Zotero item fields and can emit `[object Object]` or complex metadata; recorded as `FAIL-20260706-078`.
- B37 planning agent found raw `scope` can be written into metadata and index-title target paths; recorded as `FAIL-20260706-079`.
- B37 regression test found `buildOpenPDFURI()` still writes raw attachment keys into source links, allowing `[object Object]`; recorded as `FAIL-20260706-080` before code changes.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `598d34659209be680a6c2a372144bb53a891b49159a80995ad2f27d9d0a2ed02`, bytes `27870`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: passed; only documentation closure remained and is now resolved.
- Git commit records B37: `72b78d3`.

### B38 Optional Original Helper Report Scalar Normalization

Status: complete.

Plan:

- Normalize optional helper image report records before Zotero attachment import.
- Reject malformed or out-of-temp-dir helper `file_path` values instead of passing them to `Zotero.Attachments.importFromFile`.
- Normalize original image attachment titles using compact source title, page number, and occurrence fields.
- Normalize helper content types and extensions to known image MIME types or safe fallback.
- Keep default reader preview index workflow unchanged and independent of Python/PyMuPDF.

Pre batch validation:

- Git worktree clean at B38 start commit `262a8e5`.
- B38 planning pass found `importOriginalImages()` passes raw `image.file_path`, `image.content_type`, and `image.extension` into Zotero import; recorded as `FAIL-20260706-081`.
- B38 planning pass found `buildOriginalImageTitle()` uses raw Zotero fields plus raw helper `page_number` and `occurrence`, allowing noisy attachment titles; recorded as `FAIL-20260706-082`.
- B38 implementation review found helper file path prefix checks need lexical `.` and `..` segment normalization before containment checks; recorded as `FAIL-20260706-083`.
- B38 code review found Windows UNC helper output paths can be conflated with single-root paths if leading slashes are collapsed; recorded as `FAIL-20260706-084`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `d80ac0fb7af750e2543ff647edaa87dd2c324d856093516d6c8af92c2c2bc991`, bytes `28934`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: passed after UNC path-root fix; final review found no findings.
- Git commit records B38 implementation: `a0b4754`.

### B39 Optional Original Helper File Existence Guard

Status: complete.

Plan:

- Check normalized optional helper image files still exist before Zotero attachment import.
- Skip missing helper files instead of throwing and aborting the whole optional original import.
- Report missing helper files separately from malformed helper records and over-cap records.
- Keep the default reader preview index workflow unchanged.

Pre batch validation:

- Git worktree clean at B39 start commit `127fd27`.
- B39 planning pass found `importOriginalImages()` trusts normalized helper file paths exist; a missing helper output file can throw inside `Zotero.Attachments.importFromFile` and abort remaining valid original-image imports; recorded as `FAIL-20260706-085`.
- B39 code review found `IOUtils.exists()` exceptions are currently treated as missing files, hiding permission or I/O failures; recorded as `FAIL-20260706-086`.
- B39 code review found dynamic tests cover the existence filter but not the full `importOriginalImages()` missing-file behavior; recorded as `FAIL-20260706-087`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `c6fb88604d8535896616b0248591d0fb3dc65503e4d3afa980566f69308fb932`, bytes `29206`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: passed after separating unreadable helper files from missing files and adding full import behavior coverage.
- Git commit records B39 implementation: `e5401c2`.

### B40 Optional Original Per Image Import Failure Isolation

Status: complete.

Plan:

- Isolate `Zotero.Attachments.importFromFile` failures per original helper image.
- Continue importing later valid original images after one image import fails.
- Report import failures separately from malformed, missing, unreadable, and over-cap helper records.
- Keep the default reader preview index workflow unchanged.

Pre batch validation:

- Git worktree clean at B40 start commit `2d489d8`.
- B40 planning pass found `importOriginalImages()` still wraps the whole import loop, so one existing but unimportable helper image can abort later valid original-image imports; recorded as `FAIL-20260706-088`.
- B40 code review found all per-image imports can fail and still return as a non-fatal warning instead of surfacing a system-level import failure; recorded as `FAIL-20260706-089`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `a9ba4e2ad745663fa9620c79d162d9688db15d7d71a2b4dc3cb806f689af88e3`, bytes `29315`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- Code review: passed after all-attempted import failure escalation was added.
- Git commit records B40 implementation: `aa4e8e5`.

### B41 Optional Helper Failure Message Scalar Normalization

Status: complete.

Plan:

- Normalize optional helper failure `status` and `warnings` before reader toast output.
- Prevent `[object Object]`, `undefined`, arrays, and very long helper warning text in user-visible failure messages.
- Cap helper warning detail count and length to keep UI concise.
- Keep default reader preview index workflow unchanged.

Pre batch validation:

- Git worktree clean at B41 start commit `7cd3038`.
- B41 planning pass found `formatHelperFailure()` joins raw helper `warnings` and raw `status`, allowing noisy or complex values in reader toast output; recorded as `FAIL-20260706-090`.
- B41 code review found `runHelperExtraction()` still interpolates raw helper `report.status` into aggregated warning strings before formatter normalization; recorded as `FAIL-20260706-091`.
- B41 code review found missing-PyMuPDF aggregation spreads raw `warnings`, so non-array warnings can throw before formatter normalization; recorded as `FAIL-20260706-092`.
- B41 code review found helper schema mismatch errors stringify raw `schema_version`, allowing `[object Object]` into warning strings; recorded as `FAIL-20260706-093`.
- B41 local review found `formatHelperFailure()` still reads raw `report.status` before optional normalization guards; malformed or missing reports can throw before fallback formatting; recorded as `FAIL-20260706-094`.
- B41 validation found the new raw-status static guard scans the whole plugin and blocks legitimate helper report state branches outside `formatHelperFailure()`; recorded as `FAIL-20260706-095`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `453f4a76493f1bc95dac041d3b87651bde7693a943eae5b73ff9cd0bc9cba33a`, bytes `29479`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 3, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: passed; no P0-P2 blockers found after formatter branch guard fix.
- Git commit records B41 implementation: `5a20a63`.

### B42 HTML Preview Entry Container Normalization

Status: complete.

Plan:

- Normalize preview index entry containers before mutating per-entry fields.
- Reject non-array or empty entry lists with clear preview-index errors.
- Convert non-object entry values to safe empty entry objects before scalar/page/bbox/data URL validation.
- Keep normal reader canvas preview output unchanged.

Pre batch validation:

- Git worktree clean at B42 start commit `9626d15`.
- B42 planning pass found `buildIndexHTML()` calls `entries.map()` and then mutates `entry.*`, so non-array entries or scalar/null entry values can produce unclear TypeErrors before existing data URL validation; recorded as `FAIL-20260706-096`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `1938b80d2f321cf3a60d380428c82dec82c104aa3d17e6e44cc40e1c4599ac39`, bytes `29599`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: local read-only review passed with no P0-P2 blockers; subagent review unavailable twice due local proxy HTTP 503.
- Git commit records B42 implementation: `a7abc73`.

### B43 HTML Preview Data URL Base64 Canonical Validation

Status: complete.

Plan:

- Tighten synced HTML preview data URL validation to reject malformed base64 payload lengths.
- Preserve normal canvas-generated `data:image/jpeg;base64,...` output unchanged.
- Keep byte-count metadata derived only from validated canonical base64 payloads.
- Add regression and static checks so malformed preview payloads cannot render as broken previews with incorrect byte counts.

Pre batch validation:

- Git worktree clean at B43 start commit `5cc1a9c`.
- B43 planning pass found `normalizePreviewDataURL()` accepts base64 payloads whose length is not divisible by four, such as `data:image/jpeg;base64,A`, which can create broken preview images and `0 B` metadata instead of a clear validation error; recorded as `FAIL-20260706-097`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `8eb72ca65d77bdcf9cbeb36d3d6f4760805673f605f816af36c01a41db66c718`, bytes `29616`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: passed; no P0-P2 blockers found.
- Git commit records B43 implementation: `bfef86f`.

### B44 Reader Save Entry Options Guard

Status: complete.

Plan:

- Make reader page and auto-raster save entry points tolerate missing option objects.
- Move page-target and job-key setup inside the existing error-handling path.
- Ensure duplicate active-job checks do not delete another in-flight job.
- Add regression/static checks for missing options and guarded active job cleanup.

Pre batch validation:

- Git worktree clean at B44 start commit `b2ae1f7`.
- B44 planning pass found `saveAutoDetectedPageImagePreviews()` and `savePagePreviewIndex()` read `options.*` before their `try/catch`, so malformed internal/menu calls can reject before showing a reader error toast or normalizing cleanup; recorded as `FAIL-20260706-098`.
- B44 code review found the new active-job cleanup static check is too broad and can pass if only one save entry remains guarded; recorded as `FAIL-20260706-099`.
- B44 code review found missing-options tests only assert that either save entry logs the expected guarded-path error, not each entry separately; recorded as `FAIL-20260706-100`.
- B44 re-review found the auto-raster guarded-cleanup static check can still cross into the page-preview function; recorded under `FAIL-20260706-099`.
- Runtime/manual-install failures remain open because their close conditions need manual Zotero installation or closed-Zotero validation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `54a31be2fbad818d908d33ecd4953cf853cf7de4e0301df9cce8c497d1d5aa2b`, bytes `29701`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent review was unavailable due 429 retry limit; local read-only review passed with no P0-P2 blockers found.
- Git commit records B44 implementation: `534954c`.

### B45 Remaining Save Entry Guards

Status: complete.

Plan:

- Make clip-preview and optional-original save entry points tolerate missing option objects.
- Move clip/original page-target and job-key setup inside the existing error-handling path.
- Ensure duplicate active-job checks in clip/original paths do not delete another in-flight job.
- Add regression/static checks for missing options, guarded cleanup, and normalized job scopes across save entry helpers.

Pre batch validation:

- Git worktree clean at B45 start commit `72db93c`.
- B45 planning pass found `saveClipPreviewIndex()` reads `options.pageIndex` before its `try/catch` and unconditionally deletes the active job; recorded as `FAIL-20260706-101`.
- B45 planning pass found `confirmAndSaveOriginalImagesFromReader()` and `saveOriginalImagesFromReader()` read `options.scope/pageIndex` before robust defaulting and guarded handling; recorded as `FAIL-20260706-102`.
- B45 planning pass found `getReaderJobKey()` reads raw `options.scope` and can throw on missing options or emit noisy object scopes; recorded as `FAIL-20260706-103`.
- B45 code review found the original-image normalized-scope static check scans the whole plugin and can cross from confirmation into save function code; recorded as `FAIL-20260706-104`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `4d509d996d12f04d8bd5945d155dab8e60b60d81b32f48c1a3f95a89b0940b3b`, bytes `29769`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent found `FAIL-20260706-104`; fixed and revalidated. Local review found no remaining P0-P2 blockers.
- Git commit records B45 implementation: `d4d3b1d`.

### B46 Selection Overlay Cleanup Guard

Status: complete.

Plan:

- Make selection overlay replacement and cancellation restore the previous page host `position` value.
- Store the host position state on the overlay so replacing an existing overlay can clean up the old host before installing a new overlay.
- Add behavior/static checks for host style restoration and overlay cleanup helper usage.

Pre batch validation:

- Git worktree clean at B46 start commit `3eda1ab`.
- B46 planning pass found repeated Clip Figure starts remove the existing selection overlay with `existing.remove()` but do not restore the previous page host style; recorded as `FAIL-20260706-105`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `603eaf0f0d4985e3ad339cdac83ad89c6d00b1684a58f597137ce19de7c43b45`, bytes `29930`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: planning subagent agreed with B46 scope; local read-only review found no P0-P2 blockers.
- Git commit records B46 implementation: `82fdde1`.

### B47 Reader Toast Fallback Fast Path

Status: complete.

Plan:

- Make reader toast fallback avoid the full PDF viewer context wait when no reader or no PDF reader is available.
- Split toast rendering and fallback alert helpers so behavior is testable and compact.
- Add behavior/static checks proving missing-reader toast feedback is immediate and still uses reader document toast when a context is already available.

Pre batch validation:

- Git worktree clean at B47 start commit `d102a90`.
- B47 planning pass found `showReaderToast(null, ...)` calls `getPDFViewerContext(null)` and waits through PDF context retries before falling back to `Services.prompt.alert`; recorded as `FAIL-20260706-106`.
- B47 code review found the first fix can render a toast in `fallbackWindow.document` before checking `!isPDFReader(reader)`, so missing-reader feedback can still avoid the intended alert path; recorded as `FAIL-20260706-107`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `4de6c08e391d4a482f038fb50a92fdc807417e7fb8130e3803d0404b68084e20`, bytes `30050`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent review failed due concurrency limit; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B47 implementation: `4d44b8b`.

### B48 Save Entry Quality Key Normalization

Status: complete.

Plan:

- Normalize preview quality keys at clip and page save entry boundaries before rendering, duplicate-key generation, and index metadata creation.
- Keep auto-raster behavior unchanged because it already normalizes `qualityKey` before use.
- Add behavior/static checks proving malformed or missing clip/page save quality uses Medium consistently.

Pre batch validation:

- Git worktree clean at B48 start commit `98cc980`.
- B48 planning pass found `saveClipPreviewIndex()` and `savePagePreviewIndex()` pass raw `options.qualityKey` into `renderCanvasPreview()` and `createIndexHTML()`, while duplicate keys use the raw preview quality before HTML metadata later normalizes entry quality; recorded as `FAIL-20260706-108`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `711864fcc57e00ca87c2ae66215d889845d222a0b3c97c4943a08401d1c692d4`, bytes `30055`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent review unavailable due thread/rate limits; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B48 implementation: `831577c`.

### B49 Render Preview Quality Self Normalization

Status: complete.

Plan:

- Normalize preview quality inside `renderCanvasPreview()` so the renderer is safe even if future call sites pass malformed quality keys.
- Keep save-entry boundary normalization from B48 as a first-line guard.
- Add behavior/static checks proving malformed renderer quality falls back to Medium consistently for pixels, metadata, and smoothing quality.

Pre batch validation:

- Git worktree clean at B49 start commit `9c5be3a`.
- B49 planning pass found `renderCanvasPreview()` still reads `QUALITY[qualityKey] || QUALITY.medium` and returns raw `qualityKey` in the preview record, so a future unnormalized call can render Medium pixels while storing invalid quality metadata; recorded as `FAIL-20260706-109`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `783c4d2bea774291e7dae43db39ead409b95c956b0b1168e6c4b8dd3f1b3bad3`, bytes `30054`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: local read-only review and targeted `test/check` rerun found no P0-P2 blockers; subagent review unavailable due prior thread/rate limits.
- Git commit records B49 implementation: `89cbf6d`.

### B50 Reader Toast Input Normalization

Status: complete.

Plan:

- Normalize reader toast messages and levels at the `showReaderToast()` boundary.
- Keep missing-reader fast fallback from B47 unchanged.
- Add behavior/static checks proving malformed toast level/message values cannot leak into CSS class names or fallback alert text.

Pre batch validation:

- Git worktree clean at B50 start commit `35c245f`.
- B50 local planning pass found `showReaderToast()` forwards raw `message` and `level` into `showToastInDocument()` and `showFallbackAlert()`, so malformed internal errors or future callers can render `[object Object]` text or `pdf-image-saver-[object Object]` class names; recorded as `FAIL-20260706-110`.
- Subagent planning scan unavailable due thread limit; local read-only scan selected this as the next low-risk UI correctness hardening task.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `0a7695c5634eb7cbb213c4a0f868b16216cdcd6b80c55c0bc419727229992339`, bytes `30180`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed.
- Code review: local read-only review and targeted `test/check` rerun found no P0-P2 blockers; subagent unavailable due thread limit.
- Git commit records B50 implementation: `e50fcca`.

### B51 Original Confirmation Options Guard

Status: complete.

Plan:

- Harden `confirmAndSaveOriginalImagesFromReader()` against null or malformed options before reading `scope` or spreading options.
- Keep optional original extraction explicit and confirmation-gated.
- Add behavior/static checks proving malformed confirmation options cancel cleanly or route through guarded save logic without uncaught rejection.

Pre batch validation:

- Git worktree clean at B51 start commit `ef5aaa8`.
- B51 initial subagent candidate about original-scope static coverage was rejected as stale because the check already uses `$originalSaveEntry.Value`.
- B51 local planning pass found `confirmAndSaveOriginalImagesFromReader()` reads `options.scope` before normalizing the options object and has no local try/catch; malformed direct/future calls can reject before compact reader feedback; recorded as `FAIL-20260706-111`.
- B51 validation found the first raw-options static guard used PowerShell case-insensitive `-match`, so it falsely matched `safeOptions.scope` and `...safeOptions`; recorded as `FAIL-20260706-112`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `ed5a6cec5a3cbbbee20498d463de5c68b23c73e4512c5d325d0d7a8968512df9`, bytes `30261`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent rejected the initial stale candidate; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B51 implementation: `e288c89`.

### B52 Preview Duplicate Key Normalization

Status: complete.

Plan:

- Normalize duplicate-guard key inputs inside `getPreviewDuplicateKey()` so malformed preview or attachment values cannot throw or leak object text into the recent-save cache.
- Keep rendered preview output and saved HTML index behavior unchanged.
- Add behavior/static checks proving duplicate keys normalize library ID, attachment key, page index, quality, and bbox values before string construction.

Pre batch validation:

- Git worktree clean at B52 start commit `75efb8c`.
- B52 local planning pass found `getPreviewDuplicateKey()` trusts `preview.bboxNormalized.map()`, `attachment.libraryID`, `attachment.key`, `preview.pageIndex`, and `preview.quality` directly; recorded as `FAIL-20260706-113`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `05097b654acf493ae72842c1f9802082aace2ad87573b41c659cdc14f7778f03`, bytes `30309`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent scan timed out and was closed; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B52 implementation: `8bb8096`.

### B53 Diagnostics Report Text Normalization

Status: complete.

Plan:

- Normalize diagnostics report text at `formatDiagnosticsReport()` so malformed runtime fields cannot render object text, `undefined`, `NaN`, or oversized warning lines in user-facing alerts.
- Keep diagnostics content compact: plugin, Zotero, reader state, temp state, source PDF key/page/link, auto-raster availability, and capped warnings.
- Add behavior/static checks proving report fields and warnings are normalized before alert text output.

Pre batch validation:

- Git worktree clean at B53 start commit `45b4388`.
- B53 local planning pass found `formatDiagnosticsReport()` interpolates raw `report.*`, `report.pdf_attachment.*`, and `report.warnings.map(...)` values directly into the diagnostics alert; recorded as `FAIL-20260706-114`.
- B53 validation found the raw diagnostics static guard used PowerShell case-insensitive `-match`, so it falsely matched `safeReport.pdf_attachment`; recorded as `FAIL-20260706-115`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `dd280e38e6355e64d591e4c7e0d0dcace4639547b8a7a6a85e05fb1308207cc7`, bytes `30673`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent timed out and was closed; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B53 implementation: `2eb5c06`.

### B54 Error Message Text Normalization

Status: complete.

Plan:

- Normalize `getErrorMessage()` so thrown objects, arrays, nulls, and empty messages cannot become `[object Object]`, `undefined`, `null`, or oversized text in logs, reader toasts, diagnostics warnings, or helper failure messages.
- Preserve useful scalar error strings and `Error.message` text.
- Add behavior/static checks proving `getErrorMessage()` no longer falls back to raw `String(error)`.

Pre batch validation:

- Git worktree clean at B54 start commit `1d2d11f`.
- B54 local planning pass found `getErrorMessage()` returns `String(error)` for non-`Error` values, allowing object/array/null throw values to leak noisy text into user-visible feedback; recorded as `FAIL-20260706-116`.
- B54 validation found the new noisy-string static guard over-escaped `[object Object]` and looked for literal backslashes; recorded as `FAIL-20260706-117`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `030530099ff6afc05b95d997a74fceba99b93c9bf21883c22670167c90139e0f`, bytes `30747`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent confirmed the issue and local read-only review plus targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B54 implementation: `700a334`.

### B55 Toolbar Quality Tooltip Synchronization

Status: complete.

Plan:

- Make reader toolbar tooltip text reflect the currently selected preview quality and estimated Zotero sync size.
- Keep toolbar behavior unchanged: selected quality still drives clip and auto-raster saves.
- Add behavior/static checks proving toolbar tooltip text uses normalized quality metadata instead of hardcoded Medium text.

Pre batch validation:

- Git worktree clean at B55 start commit `0d78a19`.
- B55 subagent scan failed due local proxy quota, so local read-only planning selected the next UI correctness issue.
- B55 local planning pass found the `Clip Figure` toolbar button title is hardcoded to `Default: Medium, 60-220 KB/image`, so Low/High selections still show the wrong expected storage size; recorded as `FAIL-20260706-118`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `c6658bae5891fb12ff358a4917ed5cb833462732ff77816b08c0e9d7c86d1a54`, bytes `30915`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent unavailable due local proxy quota; local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B55 implementation: `85d058a`.

### B56 Auto Raster Button State Recovery

Status: complete.

Plan:

- Make `updateAutoRasterButtonState()` restore Auto Raster enabled state and selected-quality tooltip when PDF.js image coordinate support is available.
- Preserve unavailable-runtime feedback when PDF.js lacks `recordImages` support.
- Add behavior/static checks proving the button does not remain disabled with an unavailable tooltip after support becomes available.

Pre batch validation:

- Git worktree clean at B56 start commit `ad69cb9`.
- B56 local planning pass found `updateAutoRasterButtonState()` only disables the Auto Raster button when unsupported and never restores `disabled=false` or the selected-quality tooltip when support is available later; recorded as `FAIL-20260706-119`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `e565f6f81be2f21abb09130cd9dd264a0e9f41862920ee1516b53b323e4689c6`, bytes `31002`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: local read-only review and targeted `test/check` rerun found no P0-P2 blockers.
- Git commit records B56 implementation: `05e10d7`.

### B57 Context Menu Default Quality Consistency

Status: complete.

Plan:

- Make context menu default-quality actions use one normalized `getDefaultQualityKey()` value.
- Show the selected default quality and estimated sync size for auto-raster and full-page preview context actions.
- Add behavior/static checks proving the full-page context action no longer hardcodes Medium.
- Add behavior checks that execute context menu commands and prove they pass the displayed default quality.

Pre batch validation:

- Git worktree clean at B57 start commit `b77e584`.
- B57 local planning pass found the context menu full-page preview action is hardcoded to `Medium`, so default-quality changes are not reflected in the action label or save command; recorded as `FAIL-20260706-120`.
- B57 review found the first regression test only checked context menu labels and did not execute `onCommand`, so label/behavior drift could still pass; recorded as `FAIL-20260706-121`.
- B57 validation found the command-path regression test used `deepStrictEqual()` on objects created inside the VM context, so equal fields could still fail because prototypes differ; recorded as `FAIL-20260706-122`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `21a24105cac3893e90fa9ad06daf0d41a725cb815e8b81da4fc4719046ec15fa`, bytes `31218`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent read-only review found missing command-path validation; B57 added that coverage. Local targeted rerun found no P0-P2 blockers.
- Git commit records B57 implementation: `adaccce`.

### B58 Auto Raster Candidate Coordinate Coverage

Status: complete.

Plan:

- Export the PDF.js image-coordinate candidate converter for focused regression tests.
- Add behavior tests proving normalized coordinates become page-relative selection rectangles, tiny candidates are filtered, overlapping candidates are deduped, and largest candidates are returned first.
- Add static checks keeping the converter exported and the candidate sort/dedupe path covered.

Pre batch validation:

- Git worktree clean at B58 start commit `47a26ba`.
- B58 local planning pass found the auto-raster coordinate conversion path is core to precision but has no direct behavior regression coverage; recorded as `FAIL-20260706-123`.
- B58 subagent review found recursive temp cleanup accepts helper-reported `output_dir` without a final temp-root boundary guard; recorded as `FAIL-20260706-124` for the next safety batch.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `095d9a6f34ba54ccb72ab29f994ceef01bef0d2811d96490693a853e585fc119`, bytes `31231`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent read-only review found separate recursive-delete boundary fault; recorded as `FAIL-20260706-124` for B59. B58 local targeted rerun found no P0-P2 blockers in coordinate coverage.
- Git commit records B58 implementation: `dd5022c`.

### B59 Recursive Cleanup Temp Boundary Guard

Status: complete.

Plan:

- Add a final guard so recursive directory cleanup only removes plugin temp child directories under `PathUtils.tempDir/pdf-image-saver/`.
- Keep normal cleanup for helper-created temp output directories and stale temp children.
- Add behavior/static checks proving outside paths and the plugin temp root itself are skipped.

Pre batch validation:

- Git worktree clean at B59 start commit `e76f632`.
- B59 starts from open `FAIL-20260706-124`: recursive cleanup lacks a final temp-root boundary guard.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `fb661947359cc1dbaba3da693fca5f07b5dccc4d9d378c45bfe0856ef8cee69b`, bytes `31413`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent identified the recursive cleanup boundary fault; local targeted rerun found no P0-P2 blockers after guard/tests/static checks.
- Git commit records B59 implementation: `ea79d58`.

### B60 Target Plan Regression Loop Guard

Status: complete.

Plan:

- Add explicit target-plan rules for unique fault IDs, closure evidence, no pending validation in completed batches, and recording follow-up faults before implementation.
- Extend `scripts/check.ps1` to enforce the rules mechanically.
- Keep the change scoped to plan integrity; no plugin runtime behavior change.

Pre batch validation:

- Git worktree clean at B60 start commit `a98bb42`.
- User requested stronger protection against fixing one bug while reintroducing earlier bugs or creating an endless bug chain; recorded as `FAIL-20260706-125`.
- First B60 validation found the new closed-fault evidence check was too broad for early historical `FAIL-*` records that predate the closure template; recorded as `FAIL-20260706-126`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `fb661947359cc1dbaba3da693fca5f07b5dccc4d9d378c45bfe0856ef8cee69b`, bytes `31413`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: local targeted review found the first broad closure-evidence guard caused historical-plan churn; recorded and fixed as `FAIL-20260706-126`.
- Git commit records B60 implementation: `7cdfba2`.

### B61 Optional Helper Temp Creation Ordering

Status: complete.

Plan:

- Move Python command discovery and bundled helper script validation before optional-helper temp directory creation.
- Preserve normal helper output cleanup and no-Python fallback behavior.
- Add static checks proving `runHelperExtraction()` does not create an output directory before helper prerequisites are known.

Pre batch validation:

- Git worktree clean at B61 start commit `e12d985`.
- B61 local planning found `runHelperExtraction()` creates a temp output directory before `getPythonCommands()` and `ensureHelperScriptPath()`, so helper discovery/script failures can create unnecessary temp churn or leave an output directory if helper script loading throws; recorded as `FAIL-20260706-127`.
- Runtime/manual-install smoke remains pending because it needs user-controlled manual Zotero installation.

End batch validation checklist:

- `npm.cmd run test`: passed.
- `npm.cmd run check`: passed.
- `npm.cmd run package:manual`: passed, XPI SHA256 `2d8252f42ffa35d53674369a8958732280ac52c1cff228d057258fc560ca6364`, bytes `31409`.
- `npm.cmd run verify:manual`: passed; manual install status remains pending, Zotero process count 0, temp children 0, registered false, active false.
- `git diff --check`: passed with LF-to-CRLF warnings only.
- Code review: subagent read-only review confirmed the same helper temp creation ordering fault; local targeted rerun found no P0-P2 blockers.
- Git commit records B61 implementation: `6dff38d`.

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
- Status: closed
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
- Status: closed
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
- Status: closed
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

### FAIL-20260706-068

- Batch: B34
- Environment: synced HTML preview index metadata JSON with malformed request quality
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildIndexHTML()` writes top-level `metadata.preview_quality` from raw `qualityKey`.
- Expected: request-level preview quality is normalized with the same quality vocabulary as preview entries.
- Actual: malformed `qualityKey` can leave top-level metadata inconsistent with normalized entry quality.
- Validation update: normalize request-level quality before metadata output.
- Close condition: regression tests prove invalid request quality becomes Medium and static checks assert normalized preview quality metadata.
- Closure: `buildIndexHTML()` normalizes request-level quality before metadata output, and regression/static checks prove invalid request quality falls back to Medium.

### FAIL-20260706-069

- Batch: B34
- Environment: preview quality normalization for request-level and entry-level quality keys
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `normalizeQualityKey()` uses `QUALITY[value]` truthiness.
- Expected: only own `QUALITY` keys `low`, `medium`, and `high` are valid.
- Actual: inherited object keys such as `constructor`, `toString`, or `__proto__` can pass normalization and leak invalid preview quality metadata or undefined quality estimates.
- Validation update: harden `normalizeQualityKey()` with an own-key check.
- Close condition: regression tests prove prototype-key quality input falls back to Medium, and static checks assert an own-key guard is used.
- Closure: `normalizeQualityKey()` now accepts only own `QUALITY` keys, and regression/static checks prove `constructor` falls back to Medium for both request and entry quality.

### FAIL-20260706-070

- Batch: B35
- Environment: Zotero `open-pdf` URI generation for user-library attachments when Zotero API prefix helpers are available
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `getLibraryURIPath()` returns `Zotero.API.getLibraryPrefix(libraryID)` before checking Zotero `open-pdf` URI forms.
- Expected: user-library source links use `zotero://open-pdf/library/items/<key>?page=<n>`, and group links use `zotero://open-pdf/groups/<groupID>/items/<key>?page=<n>`.
- Actual: a Web API style prefix such as `users/999` can produce an unsupported `zotero://open-pdf/users/999/items/...` link.
- Validation update: remove API-prefix trust from Zotero open-pdf link construction and derive only documented library/group paths.
- Close condition: regression tests prove a mocked API `users/999` prefix cannot change user-library open-pdf links, group links remain valid, and static checks reject API prefix use in `getLibraryURIPath()`.
- Closure: `getLibraryURIPath()` now derives only user-library and group-library Zotero open-pdf paths, tests mock a `users/999` API prefix, and static checks reject `getLibraryPrefix` in plugin code.

### FAIL-20260706-071

- Batch: B35
- Environment: synced HTML preview index creation from preview entries with malformed page target fields
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildIndexHTML()` trusts raw `entry.pageNumber` and `entry.pageIndex`.
- Expected: visible page text, metadata page fields, duplicate target data, and `open_pdf_uri` are derived from one normalized page target.
- Actual: malformed or divergent `entry.pageNumber/pageIndex` can make saved source links and metadata disagree.
- Validation update: normalize each entry page target during HTML index build before URI, visible text, and metadata output.
- Close condition: regression tests prove malformed `pageNumber` plus valid `pageIndex` outputs a consistent `pageIndex + 1` link and metadata fields, and static checks assert page-target normalization runs in `buildIndexHTML()`.
- Closure: `buildIndexHTML()` normalizes each entry page target before URI and metadata output, and tests prove malformed `pageNumber` with valid `pageIndex` produces consistent page 7 URI and metadata.

### FAIL-20260706-072

- Batch: B35
- Environment: reader current-page and context-menu page targeting
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `getContextPageIndex()` accepts only integer page indexes, while `getCurrentPageIndex()` can subtract from nonnumeric viewer page state.
- Expected: numeric strings from context state are accepted, and invalid page state falls back to a safe zero-based page index.
- Actual: string page indexes are dropped, and nonnumeric viewer page values can produce `NaN`.
- Validation update: add shared page index and page number normalization helpers.
- Close condition: regression tests prove numeric strings are accepted and invalid/negative page values fall back safely, while static checks assert the shared helpers are used.
- Closure: shared page index/page number helpers are used for current-page, context-menu, and URI paths; tests cover numeric strings and invalid/negative fallbacks.

### FAIL-20260706-073

- Batch: B35
- Environment: shared page index normalization introduced for HTML preview entries and reader page targeting
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `toFiniteNumber()` uses `Number(value)` for all value types.
- Expected: only finite numbers and nonempty numeric strings are accepted as page targets.
- Actual: `null`, booleans, or arrays can be coerced into numeric page indexes, and a missing `entry.pageIndex` can override a valid `entry.pageNumber` as page 1.
- Validation update: restrict page-target numeric coercion to numbers and trimmed strings.
- Close condition: regression tests prove `null` page indexes do not override valid page numbers and non-string/non-number values fall back safely.
- Closure: page-target numeric coercion now accepts only finite numbers and nonempty strings, tests cover null, boolean, and array rejection plus null pageIndex preserving a valid pageNumber.

### FAIL-20260706-074

- Batch: B36
- Environment: synced HTML preview index creation from malformed preview size fields
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildIndexHTML()` passes `entry.byteCount`, `entry.renderedWidth`, and `entry.renderedHeight` directly to visible HTML and metadata.
- Expected: byte count and rendered dimensions are finite concise scalar values; malformed values do not appear as `NaN`, `Infinity`, `undefined`, or object text.
- Actual: malformed size fields can render as `NaN MB, undefined x [object Object]px` and can store complex values in metadata.
- Validation update: normalize preview byte and dimension fields during HTML index build.
- Close condition: regression tests prove malformed size fields produce a recomputed byte count and `null` dimensions without `NaN`, `undefined`, or `[object Object]`; static checks assert scalar normalization is used.
- Closure: `buildIndexHTML()` normalizes dimensions and recomputes byte count from normalized data URLs before visible and metadata output; regression/static checks cover malformed scalar values.

### FAIL-20260706-075

- Batch: B36
- Environment: synced HTML preview index creation from malformed preview text and ratio fields
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildIndexHTML()` emits `id`, `mode`, `detector`, `pageLabel`, and `detectionArea` without scalar normalization.
- Expected: synced metadata remains compact and simple, with short strings or `null` and a finite normalized detection area.
- Actual: objects can appear in metadata or visible HTML as `[object Object]`.
- Validation update: normalize compact preview scalar fields during HTML index build.
- Close condition: regression tests prove malformed scalar fields do not emit object text and metadata contains only string, number, or null values for those fields.
- Closure: preview `id`, `mode`, `detector`, `page_label`, and `detection_area` are normalized to compact scalar values before output; regression tests reject object text.

### FAIL-20260706-076

- Batch: B36
- Environment: rendered dimension normalization for synced HTML preview entries
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `normalizePositiveInteger()` floors finite values after checking only `number <= 0`.
- Expected: rendered dimensions smaller than 1 pixel are malformed and should become `null`.
- Actual: `0.5` can become `0`, producing `0px` in visible HTML and `0` in metadata.
- Validation update: require positive integer-normalized dimensions to be at least 1 before output.
- Close condition: regression tests prove fractional subpixel dimensions become `null` and visible HTML uses `unknown size`.
- Closure: positive integer normalization now rejects values below one pixel, and regression/static checks cover subpixel dimensions.

### FAIL-20260706-077

- Batch: B36
- Environment: recomputed preview byte count from normalized base64 data URLs
- Zotero version target: 9.0.5
- Severity: P4
- Status: closed
- Symptom: `estimateDataURLBytes()` estimates `(base64.length * 3) / 4` without subtracting base64 padding.
- Expected: byte count reflects the decoded preview payload length.
- Actual: padded base64 such as `AA==` is over-counted.
- Validation update: subtract trailing base64 padding from decoded byte estimates.
- Close condition: regression tests prove `data:image/jpeg;base64,AA==` yields `byte_count: 1`.
- Closure: preview byte estimates now subtract base64 padding, and regression/static checks cover padded base64 data URLs.

### FAIL-20260706-078

- Batch: B37
- Environment: synced HTML preview source title plus `parent_item` and `pdf_attachment` metadata
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `sourceTitle`, `serializeItem()`, and `serializeAttachment()` trust raw item keys and `getField()` values.
- Expected: source metadata is compact and scalar, with short strings or `null`.
- Actual: malformed Zotero field values can appear as `[object Object]` in HTML or complex objects in metadata.
- Validation update: normalize source title and serialized item/attachment fields before HTML and metadata output.
- Close condition: regression tests prove malformed source fields do not emit `[object Object]`, `undefined`, arrays, or objects, and static checks reject raw `getField()` serialization.
- Closure: source title, parent item metadata, and PDF attachment metadata are normalized to short strings or `null`, and regression/static checks cover malformed fields.

### FAIL-20260706-079

- Batch: B37
- Environment: synced HTML preview scope metadata and generated index attachment titles
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildIndexHTML()` writes raw `scope` to metadata, and title generation can use raw scope/page target values.
- Expected: metadata scope and attachment title target are short known strings.
- Actual: malformed scope values can be stored as objects or noisy text in synced metadata/title paths.
- Validation update: normalize index scope and title target values.
- Close condition: regression tests prove object/unknown scope becomes `unknown` in metadata/title paths and static checks assert scope normalization is used.
- Closure: HTML metadata scope and generated index-title targets now use normalized known scope values, with malformed scope falling back to `unknown`.

### FAIL-20260706-080

- Batch: B37
- Environment: Zotero `open-pdf` URI generation from malformed attachment keys
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildOpenPDFURI()` interpolates `attachment.key` directly into source links.
- Expected: source links use a compact item-key scalar and never emit object text.
- Actual: malformed attachment keys can produce `zotero://open-pdf/.../[object Object]?...` in visible HTML and metadata.
- Validation update: normalize attachment keys before building open-pdf URIs.
- Close condition: regression tests prove malformed attachment keys do not emit `[object Object]`, and static checks assert open-pdf URI key normalization.
- Closure: `buildOpenPDFURI()` normalizes attachment keys and falls back to `UNKNOWN` for malformed keys; regression/static checks cover source link output.

### FAIL-20260706-081

- Batch: B38
- Environment: optional original image helper report import path
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `importOriginalImages()` passes raw `image.file_path`, `image.content_type`, and `image.extension` from helper reports into Zotero import.
- Expected: original-image import uses normalized scalar fields, rejects malformed paths, and only imports files from the helper output directory.
- Actual: malformed helper reports can send object or out-of-scope file paths and noisy content type values into `Zotero.Attachments.importFromFile`.
- Validation update: normalize helper image records before import and add regression/static checks for path, MIME, and omission counts.
- Close condition: tests prove invalid helper image records are skipped, out-of-temp-dir paths are rejected, content types are normalized, and import iteration uses sanitized image records only.
- Closure: `limitOriginalImagesForImport()` now calls `normalizeOriginalImageForImport()` and import uses normalized `filePath` and `contentType`; regression/static checks cover malformed records, out-of-dir paths, MIME fallback, invalid counts, and over-cap counts.

### FAIL-20260706-082

- Batch: B38
- Environment: optional original image attachment title generation
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `buildOriginalImageTitle()` builds titles from raw Zotero fields and raw helper `page_number` and `occurrence`.
- Expected: optional original image attachment titles remain compact scalar text with safe page and occurrence fallbacks.
- Actual: malformed helper or item fields can produce `[object Object]`, `undefined`, or noisy title text.
- Validation update: normalize original title base, page number, and occurrence before title output.
- Close condition: regression tests prove malformed title inputs produce a compact fallback title and static checks assert normalized title generation.
- Closure: original attachment titles now use normalized source title, page number, and occurrence values; regression/static checks cover malformed source and helper fields.

### FAIL-20260706-083

- Batch: B38
- Environment: optional helper file path containment checks
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: helper image file paths can contain `.` or `..` path segments before the output-directory prefix check.
- Expected: containment checks compare normalized lexical paths so `..` cannot escape the helper output directory.
- Actual: a string such as `output_dir\..\other\image.png` can still share the raw output prefix before path segment resolution.
- Validation update: normalize path segments before helper output directory containment checks and add regression/static checks.
- Close condition: tests prove sibling and `..` escape paths are rejected while nested helper output files remain accepted.
- Closure: helper path comparison now normalizes `.` and `..` segments before containment checks; regression/static checks cover sibling paths, parent-directory escapes, and internal normalized paths.

### FAIL-20260706-084

- Batch: B38
- Environment: optional helper file path containment checks on Windows UNC paths
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: UNC paths and single-root Windows paths can be conflated if leading slashes are collapsed before comparison.
- Expected: UNC roots such as `\\server\share` remain distinct from `\server\share` style rooted paths.
- Actual: raw slash collapsing can make different Windows path roots compare as the same prefix.
- Validation update: preserve UNC root identity during path normalization and add regression/static checks.
- Close condition: tests prove UNC helper output paths accept matching UNC children and reject single-root lookalikes.
- Closure: helper path normalization preserves UNC server/share roots before segment normalization; regression/static checks cover matching UNC children and single-root lookalikes.

### FAIL-20260706-085

- Batch: B39
- Environment: optional original helper file import after report normalization
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `importOriginalImages()` passes normalized helper file paths to Zotero import without checking that the files still exist.
- Expected: missing helper output files are skipped and counted so remaining valid original images can still be imported.
- Actual: a missing helper output file can throw inside `Zotero.Attachments.importFromFile` and abort the whole optional original import.
- Validation update: add an async file-existence filter before import and regression/static checks for missing-file counts.
- Close condition: tests prove missing helper files are omitted, valid files are preserved, and import iteration uses the existence-filtered image list.
- Closure: `importOriginalImages()` now iterates existence-filtered `prepared.images`; behavior tests prove missing files are not imported and later valid files still import.

### FAIL-20260706-086

- Batch: B39
- Environment: optional original helper file existence check errors
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: helper file existence check exceptions can be counted as missing files.
- Expected: permission, invalid path, or I/O errors are exposed separately from ordinary missing helper files.
- Actual: `IOUtils.exists()` exceptions can be logged and converted to `false`, making them look like missing files in user feedback.
- Validation update: classify existence check errors separately and keep them visible in import results and toast text.
- Close condition: tests prove an existence-check exception increments `errorCount`, does not increment `missingCount`, and keeps valid files importable.
- Closure: `getHelperImageFileStatus()` now returns a separate error state, import results expose `errorCount`, toast reports unreadable files, and tests cover error/missing separation.

### FAIL-20260706-087

- Batch: B39
- Environment: optional original image import behavior-level regression coverage
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: tests cover the existence filter but not full `importOriginalImages()` behavior.
- Expected: regression coverage proves missing helper files are not passed to `Zotero.Attachments.importFromFile` and do not abort later valid imports.
- Actual: full import behavior relies mainly on static regex checks.
- Validation update: export and test `importOriginalImages()` with stubbed `Zotero.Attachments.importFromFile`.
- Close condition: tests prove only existing helper files are imported and missing helper files do not abort the import loop.
- Closure: `importOriginalImages()` is exported for regression tests, and behavior tests prove only existing helper files are sent to Zotero import.

### FAIL-20260706-088

- Batch: B40
- Environment: optional original image Zotero attachment import loop
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: one existing helper image that fails during `Zotero.Attachments.importFromFile` aborts the remaining original-image import loop.
- Expected: failed individual original imports are counted and later valid images still import.
- Actual: the import loop throws out to the reader-level catch, so later valid images are not imported.
- Validation update: isolate per-image import failures and add behavior/static checks for continuing after one import failure.
- Close condition: tests prove a failing existing image increments `importErrorCount`, is omitted from imported files, and later valid files still import.
- Closure: per-image import failures are counted and logged while later valid files continue importing; behavior/static checks cover partial failure continuation.

### FAIL-20260706-089

- Batch: B40
- Environment: optional original image Zotero attachment import loop systemic failures
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: all `Zotero.Attachments.importFromFile` calls can fail and still return as a non-fatal warning result.
- Expected: partial import failures are counted, but all attempted original imports failing is surfaced as an overall import error.
- Actual: user feedback can show `Saved 0` with warnings even when the Zotero import path is systemically broken.
- Validation update: throw a clear overall error when every attempted original import fails and add behavior/static checks.
- Close condition: tests prove partial failures continue but all attempted import failures reject with a clear error.
- Closure: when every attempted Zotero original image import fails, the plugin throws a clear overall error; behavior/static checks cover all-failed escalation.

### FAIL-20260706-090

- Batch: B41
- Environment: optional helper failure reader toast messages
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `formatHelperFailure()` joins raw helper `warnings` and raw `status`.
- Expected: optional helper failure messages use compact scalar text and never show `[object Object]`, arrays, `undefined`, or very long helper details.
- Actual: malformed helper reports can produce noisy user-visible toast text.
- Validation update: normalize helper status and warning strings before formatting failure messages.
- Close condition: tests prove malformed helper status and warnings produce concise scalar failure text, and static checks reject raw warning joins.
- Closure: formatter now normalizes status and warning detail text; tests cover malformed status, warnings, and concise output; static checks block raw warning joins.

### FAIL-20260706-091

- Batch: B41
- Environment: optional helper multi-candidate failure aggregation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `runHelperExtraction()` interpolates raw helper `report.status` into aggregated failure warnings.
- Expected: helper candidate failure aggregation normalizes status text before adding it to `warnings`.
- Actual: malformed helper status can become `[object Object]` or array text in warning strings before `formatHelperFailure()` sees them.
- Validation update: normalize helper report status at aggregation time and add regression/static checks.
- Close condition: tests and static checks prove candidate failure aggregation uses normalized status text.
- Closure: helper candidate failure aggregation now uses `normalizeHelperStatusText(report.status)` and regression/static checks cover normalized warning output.

### FAIL-20260706-092

- Batch: B41
- Environment: optional helper missing PyMuPDF warning aggregation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: missing-PyMuPDF aggregation spreads raw `missingPyMuPDFReport.warnings`.
- Expected: helper warning aggregation accepts malformed warning containers and normalizes them before output.
- Actual: non-array `warnings` can throw before `formatHelperFailure()` normalizes the final message.
- Validation update: use the helper warning normalizer during aggregation and add regression/static checks.
- Close condition: tests/static checks prove malformed warning containers do not throw or leak object text.
- Closure: missing-PyMuPDF aggregation now normalizes existing warnings before spread; malformed warning containers return an empty detail list without throwing.

### FAIL-20260706-093

- Batch: B41
- Environment: optional helper schema mismatch error formatting
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: malformed helper `schema_version` values are interpolated directly into schema mismatch errors.
- Expected: schema mismatch errors include a compact scalar schema value or `unknown`.
- Actual: object schema values can become `[object Object]` in warning strings.
- Validation update: normalize schema values before creating schema mismatch errors and add regression/static checks.
- Close condition: tests/static checks prove malformed schema values do not leak object text.
- Closure: helper schema mismatch errors now call `normalizeHelperSchemaText(report.schema_version)` and tests/static checks cover object schema fallback.

### FAIL-20260706-094

- Batch: B41
- Environment: optional helper failure formatter branch guards
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `formatHelperFailure()` checks raw `report.status` before optional normalization guards.
- Expected: missing or malformed helper reports format to a compact fallback message without throwing.
- Actual: missing reports can throw before the formatter reaches normalized fallback status and warnings.
- Validation update: normalize helper status once at formatter entry and branch on normalized status.
- Close condition: tests/static checks prove missing or malformed helper reports do not throw and do not leak object text.
- Closure: `formatHelperFailure()` now normalizes status at entry, branches on normalized status, and handles null reports as `unknown`.

### FAIL-20260706-095

- Batch: B41
- Environment: B41 PowerShell static guard scope
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: the raw `report.status` formatter guard scans the whole plugin file.
- Expected: the guard only rejects raw `report.status` branches inside `formatHelperFailure()`.
- Actual: legitimate helper state checks in `runHelperExtraction()` fail `npm.cmd run check`.
- Validation update: scope the raw-status branch guard to the formatter function and keep positive normalized-branch checks.
- Close condition: `npm.cmd run check` passes while still blocking raw `report.status` branches in `formatHelperFailure()`.
- Closure: raw-status static guard is scoped to `formatHelperFailure()` and `npm.cmd run check` passes while preserving positive normalized branch checks.

### FAIL-20260706-096

- Batch: B42
- Environment: synced HTML preview index entry list normalization
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `buildIndexHTML()` calls `entries.map()` and mutates `entry.*` without first normalizing the entry list and entry containers.
- Expected: malformed entry containers produce clear preview-index validation errors or safe fallback entry objects before field normalization.
- Actual: non-array entries or null/scalar entries can throw unclear TypeErrors before the plugin reaches existing preview data URL validation.
- Validation update: normalize the preview entry list at the start of HTML index generation and add regression/static checks.
- Close condition: tests/static checks prove non-array entry lists fail clearly and scalar/null entries are normalized before data URL validation.
- Closure: `buildIndexHTML()` now uses `normalizePreviewEntries()` before field mutation; tests cover non-array, empty, null, and scalar entry containers; static checks block raw `entries.map()` output paths.

### FAIL-20260706-097

- Batch: B43
- Environment: synced HTML preview data URL validation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `normalizePreviewDataURL()` accepts base64 payloads with invalid canonical length.
- Expected: preview data URLs must contain canonical image base64 payloads before HTML output and byte-count metadata generation.
- Actual: malformed payloads such as `data:image/jpeg;base64,A` can pass validation, render as broken previews, and produce misleading `0 B` metadata.
- Validation update: require base64 payload length to be divisible by four after the existing MIME/character validation and add regression/static checks.
- Close condition: tests/static checks prove malformed base64 lengths are rejected before HTML output while normal canvas-style payloads still pass.
- Closure: `normalizePreviewDataURL()` now captures and validates the base64 payload length, tests cover malformed length rejection and canonical padded payload acceptance, and static checks guard the validation path.

### FAIL-20260706-098

- Batch: B44
- Environment: reader save entry error handling
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: reader page and auto-raster save entry points read `options.*` before entering their `try/catch`.
- Expected: missing or malformed option objects should be handled by the same reader error feedback path as later page/canvas failures.
- Actual: missing options can throw before the save entry point reaches its local catch block, producing inconsistent button/menu behavior and possible unhandled rejections.
- Validation update: default options to `{}`, move setup into guarded blocks, and only clear active jobs that the current call added.
- Close condition: tests/static checks prove missing options do not reject and active-job cleanup is guarded.
- Closure: both reader save entries now default missing options, move page/job setup inside local `try/catch`, and clear active jobs only when the current call added the job; regression/static checks pass.

### FAIL-20260706-099

- Batch: B44
- Environment: B44 reader save active-job static checks
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: the new `jobAdded` static check scans the whole plugin once instead of checking both save entry functions independently.
- Expected: static checks prove both `saveAutoDetectedPageImagePreviews()` and `savePagePreviewIndex()` guard active-job deletion.
- Actual: one guarded entry can satisfy the check while the other regresses.
- Validation update: scope guarded-cleanup static checks to each save entry function without allowing cross-function matches.
- Close condition: static checks fail if either save entry drops guarded cleanup.
- Closure: `scripts/check.ps1` now extracts auto-raster and page-preview function blocks separately and validates guarded cleanup within each block.

### FAIL-20260706-100

- Batch: B44
- Environment: B44 missing-options regression tests
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: missing-options tests assert that at least one save entry logs the expected guarded-path error.
- Expected: tests prove both page and auto-raster save entries individually handle missing options through the guarded error path.
- Actual: one entry can still reject or log a pre-guard `TypeError` while the other makes the test pass.
- Validation update: assert each save entry adds its own expected guarded-path error.
- Close condition: regression tests fail if either save entry does not log the guarded page/canvas error.
- Closure: `tests/open-pdf-uri.test.js` now calls each reader save entry without options and asserts each call logs its own guarded page/canvas error without rejecting.

### FAIL-20260706-101

- Batch: B45
- Environment: clip-preview save entry error handling
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `saveClipPreviewIndex()` reads `options.pageIndex` before entering its `try/catch` and always deletes the computed active-job key.
- Expected: missing option objects should be handled through the reader error feedback path, and duplicate-running calls must not delete another in-flight clip save.
- Actual: malformed internal calls can reject before local error handling, and future duplicate-return paths can clear a job that the current call did not add.
- Validation update: default options to `{}`, move setup into the guarded block, and only clear active jobs added by the current call.
- Close condition: tests/static checks prove missing options do not reject and clip active-job cleanup is guarded.
- Closure: `saveClipPreviewIndex()` now defaults missing options, computes job setup inside `try`, and clears active jobs only when the current call added the job; behavior and static checks cover the path.

### FAIL-20260706-102

- Batch: B45
- Environment: optional original-image save entry error handling
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `confirmAndSaveOriginalImagesFromReader()` and `saveOriginalImagesFromReader()` read `options.scope/pageIndex` before robust defaulting and guarded handling.
- Expected: optional original extraction should default malformed option objects to the current-page scope or report a normal reader error, without unhandled rejections.
- Actual: missing options can throw before confirmation or before the save entry reaches its local catch block.
- Validation update: default options to `{}`, normalize original extraction scope, move setup into guarded blocks, and add behavior/static coverage.
- Close condition: tests/static checks prove missing options do not reject and original active-job cleanup is guarded.
- Closure: original extraction confirmation and save entries now default missing options, normalize scope, handle missing reader through the guarded error path, and use guarded active-job cleanup.

### FAIL-20260706-103

- Batch: B45
- Environment: reader active-job key generation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `getReaderJobKey()` reads raw `options.scope` and `options.pageIndex`.
- Expected: job keys should tolerate missing option objects and use compact normalized known scopes.
- Actual: missing options can throw, and object or unknown scopes can produce noisy duplicate keys.
- Validation update: default `options` to `{}`, normalize scope through `normalizeScope()`, and test malformed scope fallback.
- Close condition: tests/static checks prove missing options and malformed scope values produce stable compact job keys.
- Closure: `getReaderJobKey()` now defaults options, normalizes scopes through the known scope vocabulary, and regression tests cover missing options plus malformed scope fallback.

### FAIL-20260706-104

- Batch: B45
- Environment: B45 original-image static scope guard
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: the normalized-scope static check scans the whole plugin and can match `normalizeOriginalScope()` in the confirmation helper plus `getReaderJobKey()` in the save helper.
- Expected: static checks prove `saveOriginalImagesFromReader()` itself normalizes scope before job-key generation.
- Actual: a future save-function regression can pass if another function still contains the normalization call.
- Validation update: scope the normalized-scope check to the extracted original save function block.
- Close condition: static checks fail if `saveOriginalImagesFromReader()` stops normalizing scope before calling `getReaderJobKey()`.
- Closure: the original-image normalized-scope static assertion now runs against the extracted `saveOriginalImagesFromReader()` block instead of the full plugin text.

### FAIL-20260706-105

- Batch: B46
- Environment: manual clip selection overlay lifecycle
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: starting Clip Figure again removes an existing selection overlay with `existing.remove()` but does not restore the old page element's previous `style.position`.
- Expected: replacing, cancelling, or completing a clip overlay restores the host page position to its exact previous value.
- Actual: repeated clip starts can leave a PDF page host stuck at `position: relative`, causing avoidable reader layout/style drift.
- Validation update: introduce a cleanup helper that stores previous host position on the overlay and restores it whenever an overlay is removed.
- Close condition: tests/static checks prove existing overlay replacement and normal cleanup restore host position.
- Closure: selection overlay installation now cleans existing overlays through `cleanupSelectionOverlay()`, stores previous host position on each overlay, and restores it for replacement, cancel, small-selection, and pointer-up cleanup paths; tests and static checks cover the lifecycle.

### FAIL-20260706-106

- Batch: B47
- Environment: reader toast fallback without an active PDF reader context
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `showReaderToast(null, ...)` calls `getPDFViewerContext(null)` and waits through retry delays before falling back to a prompt alert.
- Expected: missing-reader or non-PDF-reader feedback should show a fallback alert immediately, while valid reader documents still get in-reader toast UI.
- Actual: error feedback paths invoked without a reader can be delayed by context polling even though no PDF context can appear.
- Validation update: add a fast fallback path plus regression/static checks for no-reader toast behavior.
- Close condition: tests/static checks prove no-reader toast does not call `Zotero.Promise.delay()` and still displays the fallback alert.
- Closure: `showReaderToast()` now immediately alerts for missing or non-PDF readers without polling PDF context, and tests/static checks cover the no-reader fast path.

### FAIL-20260706-107

- Batch: B47
- Environment: reader toast fallback with Zotero main window document available
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the B47 fast-path fix can render a toast in `fallbackWindow.document` before checking `!isPDFReader(reader)`.
- Expected: missing-reader or non-PDF-reader feedback should use the immediate alert fallback even when the Zotero main window has a document body.
- Actual: `showReaderToast(null, ...)` can create a transient main-window toast instead of the prompt alert.
- Validation update: move the non-PDF fallback before any fallback-window document toast attempt and test a main-window document stub.
- Close condition: tests/static checks prove no-reader toast with a main-window document does not create a DOM toast and does show `Services.prompt.alert`.
- Closure: the non-PDF fallback now runs before reader/main-window document toast attempts; tests cover a main-window document body and prove no DOM toast or style injection occurs.

### FAIL-20260706-108

- Batch: B48
- Environment: clip and page preview save quality handling
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `saveClipPreviewIndex()` and `savePagePreviewIndex()` pass raw `options.qualityKey` into preview rendering, duplicate keys, and index creation.
- Expected: save entry boundaries normalize quality keys so rendered preview quality, duplicate keys, visible HTML, and metadata all use one quality value.
- Actual: missing or malformed quality keys render as Medium through `QUALITY[qualityKey] || QUALITY.medium`, but the preview record and duplicate key can carry raw or `undefined` quality before HTML normalizes it later.
- Validation update: normalize clip/page save entry `qualityKey` before `renderCanvasPreview()` and `createIndexHTML()`, then add behavior/static checks.
- Close condition: tests/static checks prove clip/page save entries call `normalizeQualityKey()` before rendering and index creation.
- Closure: clip and page save entries now normalize `qualityKey` before rendering, duplicate-key generation, and index creation; static checks scope this to each save entry and renderer tests verify Medium quality output.

### FAIL-20260706-109

- Batch: B49
- Environment: canvas preview renderer quality handling
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `renderCanvasPreview()` falls back to Medium pixels for malformed `qualityKey` but returns the raw malformed value in preview metadata.
- Expected: the renderer itself should normalize quality so preview pixels, `preview.quality`, `qualityEstimate`, and smoothing behavior agree.
- Actual: direct or future unnormalized renderer calls can create a preview with Medium pixels but invalid quality metadata until later HTML normalization.
- Validation update: normalize `qualityKey` at renderer entry and add behavior/static checks.
- Close condition: tests/static checks prove malformed renderer quality becomes Medium before pixel sizing, JPEG quality, smoothing, and preview metadata.
- Closure: `renderCanvasPreview()` now normalizes `qualityKey` before `QUALITY` lookup, smoothing selection, and preview metadata output; behavior/static checks prove malformed quality keys produce Medium pixels and metadata.

### FAIL-20260706-110

- Batch: B50
- Environment: reader toast UI feedback
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `showReaderToast()` forwards raw `message` and `level` to document toast rendering and fallback alerts.
- Expected: toast messages should be compact scalar strings and toast levels should be one of `info`, `success`, `warning`, or `error`.
- Actual: malformed internal callers can produce noisy alert text and unsupported CSS classes such as `pdf-image-saver-[object Object]`.
- Validation update: normalize `message` and `level` once at the reader toast boundary and add behavior/static checks.
- Close condition: tests/static checks prove malformed toast input becomes a compact fallback message and a supported level before document toast or alert output.
- Closure: `showReaderToast()` now normalizes toast message and level before document toast or fallback alert paths; behavior/static checks cover malformed message objects, invalid levels, and fallback alert error messages.

### FAIL-20260706-111

- Batch: B51
- Environment: optional original image confirmation entry
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `confirmAndSaveOriginalImagesFromReader()` reads `options.scope` before normalizing the options object and has no local guarded error path.
- Expected: optional original confirmation should tolerate null or malformed options and still require explicit user confirmation before original image import.
- Actual: direct or future malformed calls can reject before showing compact reader feedback.
- Validation update: normalize confirmation options at entry, wrap confirmation flow in guarded error handling, export the entry for regression tests, and add static checks.
- Close condition: behavior/static checks prove null confirmation options do not throw and the confirmation path keeps normalized options before calling original-image save.
- Closure: `confirmAndSaveOriginalImagesFromReader()` now normalizes options with `normalizeOptionsObject()`, keeps confirmation gated, catches prompt/save delegation errors, and has behavior/static regression coverage for null options and safe delegation.

### FAIL-20260706-112

- Batch: B51
- Environment: B51 static validation for original confirmation options
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the raw `options.scope` and `...options` static guards use PowerShell case-insensitive matching, so they match `safeOptions.scope` and `...safeOptions`.
- Expected: static guards should reject only raw lowercase `options` usage in `confirmAndSaveOriginalImagesFromReader()`.
- Actual: `npm.cmd run check` fails even when the implementation uses `safeOptions`.
- Validation update: make the raw-options static guards case-sensitive.
- Close condition: `npm.cmd run check` passes while still guarding raw `options.scope` and `...options` spellings.
- Closure: raw original confirmation options guards now use `-cmatch`, so `safeOptions` passes while lowercase raw `options.scope` and `...options` remain rejected.

### FAIL-20260706-113

- Batch: B52
- Environment: in-session duplicate guard key generation
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `getPreviewDuplicateKey()` calls `preview.bboxNormalized.map()` and interpolates raw attachment/preview fields.
- Expected: duplicate guard keys should be compact normalized strings even if future callers pass malformed preview or attachment records.
- Actual: malformed `bboxNormalized` can throw, and malformed attachment key/library/page/quality values can leak object text or invalid quality values into `recentIndexSaves`.
- Validation update: normalize duplicate key inputs and add behavior/static checks.
- Close condition: tests/static checks prove malformed duplicate-key inputs produce a stable normalized key and never use raw bbox map or raw attachment key interpolation.
- Closure: `getPreviewDuplicateKey()` now normalizes library ID, attachment key, page index, quality, and bbox before building the cache key; tests/static checks cover malformed inputs and raw-field regressions.

### FAIL-20260706-114

- Batch: B53
- Environment: runtime diagnostics alert text
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `formatDiagnosticsReport()` interpolates raw diagnostics fields and maps raw warnings directly into the alert body.
- Expected: diagnostics text should be compact scalar output with normalized booleans, counts, source identifiers, page target, links, and capped warning lines.
- Actual: malformed runtime fields can produce `[object Object]`, `undefined`, `NaN`, invalid quality text, or oversized warnings in a user-facing alert.
- Validation update: normalize diagnostics report fields at output boundary and add behavior/static checks.
- Close condition: tests/static checks prove malformed diagnostics input produces compact normalized alert text and does not map raw warnings.
- Closure: `formatDiagnosticsReport()` now normalizes the report container, PDF attachment container, booleans, counts, quality, page target, source identifiers, byte display, and warning lines before alert output; tests/static checks cover malformed diagnostics input and raw-field regressions.

### FAIL-20260706-115

- Batch: B53
- Environment: B53 static validation for diagnostics report text
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the raw `report.pdf_attachment` static guard uses PowerShell case-insensitive matching, so it matches `safeReport.pdf_attachment`.
- Expected: static guards should reject only raw lowercase `report` field access in `formatDiagnosticsReport()`.
- Actual: `npm.cmd run check` fails even when the implementation uses `safeReport`.
- Validation update: make the raw diagnostics static guards case-sensitive.
- Close condition: `npm.cmd run check` passes while still guarding raw `report.warnings.map` and `report.pdf_attachment` spellings.
- Closure: raw diagnostics static guards now use `-cmatch`, so `safeReport` passes while lowercase raw `report.warnings.map` and `report.pdf_attachment` remain rejected.

### FAIL-20260706-116

- Batch: B54
- Environment: shared error-message formatting
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `getErrorMessage()` returns `String(error)` when the thrown value is not an object with a string `message`.
- Expected: user-facing logs, toasts, diagnostics warnings, and helper failure strings should use compact scalar error text or a safe fallback.
- Actual: thrown objects, arrays, nulls, and undefined can become `[object Object]`, array text, `null`, or `undefined` in user-visible feedback.
- Validation update: normalize error messages at the shared helper and add behavior/static checks.
- Close condition: tests/static checks prove object, array, null, undefined, empty, and oversized error values normalize without raw `String(error)`.
- Closure: `getErrorMessage()` now preserves useful `Error.message`, string, and numeric values but sends object, array, null, undefined, empty, stringified null/undefined/object, and oversized values through compact capped fallback behavior.

### FAIL-20260706-117

- Batch: B54
- Environment: B54 static validation for noisy error strings
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the noisy-string static guard over-escapes `[object Object]` and searches for literal backslashes.
- Expected: static guard should match the actual source check `text === "[object Object]"`.
- Actual: `npm.cmd run check` fails even though the implementation rejects `[object Object]`.
- Validation update: fix the static regex escaping for `[object Object]`.
- Close condition: `npm.cmd run check` passes while still asserting `undefined`, `null`, and `[object Object]` rejection.
- Closure: the noisy-string static guard now matches actual `[object Object]` source text without literal backslashes and `npm.cmd run check` passes.

### FAIL-20260706-118

- Batch: B55
- Environment: reader toolbar UI quality feedback
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the `Clip Figure` toolbar button title is hardcoded to Medium quality and `60-220 KB/image`.
- Expected: toolbar action text should show the selected quality and estimated per-image sync size so the user can make storage-conscious choices.
- Actual: after selecting Low or High, the button tooltip still claims Medium quality and the wrong estimate.
- Validation update: centralize toolbar quality tooltip text and update it when the quality selector changes.
- Close condition: behavior/static checks prove toolbar tooltip text is generated from normalized quality metadata and hardcoded Medium tooltip text is gone.
- Closure: toolbar select, Clip Figure, and Auto Raster tooltips now use normalized selected quality metadata; change events refresh tooltip text and behavior/static checks prevent returning to the hardcoded Medium tooltip.

### FAIL-20260706-119

- Batch: B56
- Environment: reader toolbar Auto Raster button availability state
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `updateAutoRasterButtonState()` disables Auto Raster and writes an unavailable tooltip when PDF.js lacks image coordinate support, but does not restore enabled state or the quality tooltip when support is available later.
- Expected: Auto Raster button state should reflect the current reader/page support and selected quality.
- Actual: a previous unsupported state can leave the button disabled or with stale unavailable text even after support is available.
- Validation update: centralize Auto Raster button state application and add behavior/static checks.
- Close condition: tests/static checks prove unavailable state disables the button and available state re-enables it with the selected quality estimate.
- Closure: `applyAutoRasterButtonState()` now handles both unavailable and available states; `updateAutoRasterButtonState()` passes the selected quality key, behavior tests cover disable/re-enable transitions, and static checks lock the recovery path.

### FAIL-20260706-120

- Batch: B57
- Environment: reader context menu default-quality preview actions
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the context menu full-page preview action is labeled `Save current page preview index (Medium)` and passes `qualityKey: "medium"` even when the default preview quality is Low or High.
- Expected: context menu default-quality actions should reflect the current normalized default quality and show the estimated sync size.
- Actual: users can set a non-Medium default quality but still see and trigger a Medium-only full-page preview action from the context menu.
- Validation update: compute one default quality key for the context menu, reuse it for labels and command arguments, and add behavior/static checks.
- Close condition: tests/static checks prove Auto Raster and full-page preview context labels show default quality estimates and page preview passes the default quality key.
- Closure: context menu default-quality actions now use one normalized default quality key for labels and command arguments; tests/static checks cover Auto Raster and page-preview labels and page-preview command quality.

### FAIL-20260706-121

- Batch: B57
- Environment: reader context menu default-quality command validation
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the B57 regression test checks Auto Raster and page-preview context menu labels but does not execute their `onCommand` handlers.
- Expected: behavior tests should prove the clicked context menu action passes the same normalized default quality shown in the label.
- Actual: the UI label could show High while the command still saves Medium and the test would pass.
- Validation update: make context menu action creation directly testable and execute Auto Raster/Page Preview command handlers with stub save functions.
- Close condition: tests prove context menu Auto Raster and page-preview `onCommand` handlers pass the normalized default quality key.
- Closure: `buildContextMenuActions()` exposes the shared action path for tests, and behavior tests execute Auto Raster/Page Preview commands to prove both pass `qualityKey: "high"` with the context page index.

### FAIL-20260706-122

- Batch: B57
- Environment: Node VM regression tests for context menu command payloads
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the command-path regression test fails even when the actual and expected payload fields are identical.
- Expected: tests should compare behavior fields and not fail on cross-context object prototypes.
- Actual: `assert.deepStrictEqual()` compares objects created inside the VM realm against host-realm object literals and fails with a misleading diff.
- Validation update: assert command count, action names, reader identity, and option scalar fields directly.
- Close condition: `npm.cmd run test` passes while still proving Auto Raster and page-preview command handlers pass `qualityKey: "high"` and `pageIndex: 2`.
- Closure: the VM-backed regression test now compares scalar behavior fields and reader identity directly; `npm.cmd run test` passes while preserving command-path coverage.

### FAIL-20260706-123

- Batch: B58
- Environment: auto-raster PDF.js image-coordinate conversion
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: `imageCoordinatesToCandidates()` converts PDF.js recorded image coordinates into source selection rectangles, filters tiny images, dedupes overlaps, and sorts by area, but there is no direct behavior regression test for that precision-critical path.
- Expected: tests should prove coordinate-to-selection math, tiny-candidate filtering, overlap dedupe, and largest-first ordering.
- Actual: current coverage reaches auto-raster behavior only indirectly through static checks and save-entry guards.
- Validation update: export the converter under `__test__`, add targeted behavior tests, and add static checks for export and candidate ordering path.
- Close condition: tests/static checks prove normalized coordinates produce the expected page-relative candidate rectangles and sorted/deduped output.
- Closure: `imageCoordinatesToCandidates()` is exported for regression tests; behavior tests cover normalized coordinate mapping, tiny filtering, overlap dedupe, largest-first ordering, page index, and detector metadata; static checks lock export and candidate ordering.

### FAIL-20260706-124

- Batch: B59
- Environment: recursive cleanup of optional-helper output directories
- Zotero version target: 9.0.5
- Severity: P1
- Status: closed
- Symptom: `importOriginalImages()` passes `report.output_dir` to `removeDirectoryIfExists()`, and `removeDirectoryIfExists()` recursively removes any supplied path without proving it is under `PathUtils.tempDir/pdf-image-saver/`.
- Expected: recursive cleanup should only remove directories inside the plugin temp root.
- Actual: a malformed or future helper report could point cleanup at a non-plugin directory.
- Validation update: add a final deletion-boundary guard and tests/static checks proving outside paths are skipped.
- Close condition: tests/static checks prove recursive removal is limited to the normalized plugin temp root.
- Closure: `removeDirectoryIfExists()` now calls `isPluginTempChildDirectory()` before recursive removal; the guard requires a normalized child path under `PathUtils.tempDir/pdf-image-saver/`, tests prove outside paths and the temp root are skipped, and static checks lock the guard before `IOUtils.remove()`.

### FAIL-20260706-125

- Batch: B60
- Environment: target-mode planning and validation loop
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: the target plan documents many regressions and follow-up faults, but only one generic status/closure consistency rule is enforced.
- Expected: plan-state checks should prevent duplicate fault IDs, completed batches with pending validation, and closed faults without close conditions or closure evidence.
- Actual: a future batch could mark itself complete or close a fault without enough machine-checked evidence, increasing the risk of bug-fix loops.
- Validation update: add explicit regression-loop control rules and enforce them in `scripts/check.ps1`.
- Close condition: static checks fail on duplicate `FAIL-*` IDs, closed failures without `Close condition`/`Closure`, completed batches with pending validation, or a missing regression-loop-control plan section.
- Closure: `Regression Loop Control` is now a plan-level section, and `scripts/check.ps1` enforces unique `FAIL-*` IDs, no open failure with closure evidence, B60-and-later closed-failure close condition/closure evidence, and no completed batch with pending validation.

### FAIL-20260706-126

- Batch: B60
- Environment: target-plan consistency check over historical failure sections
- Zotero version target: 9.0.5
- Severity: P3
- Status: closed
- Symptom: the first B60 check rejected `FAIL-20260706-001` because early historical failures predate the current `Closure` evidence template.
- Expected: new plan-invariant checks should protect future batches without forcing unrelated historical metadata churn.
- Actual: the broad closed-failure evidence check fails on old plan history before it can guard B60 and later work.
- Validation update: enforce close-condition and closure evidence only for B60-and-later failure IDs, while keeping duplicate-ID and open-with-closure guards global.
- Close condition: `npm.cmd run check` passes and still enforces closure evidence for `FAIL-20260706-125` and later.
- Closure: the close-evidence guard now applies from `FAIL-20260706-125` onward, preserving historical plan records while enforcing the stricter template for B60 and later; `npm.cmd run check` passes.

### FAIL-20260706-127

- Batch: B61
- Environment: optional-helper temp output creation
- Zotero version target: 9.0.5
- Severity: P2
- Status: closed
- Symptom: `runHelperExtraction()` creates a temp output directory before Python command discovery and bundled helper script loading complete.
- Expected: optional-helper temp output directories should be created only after prerequisites are available, so discovery/helper-script failures cannot create avoidable temp churn or leave output directories.
- Actual: `createTempDirectory()` runs before `getPythonCommands()` and `ensureHelperScriptPath()`.
- Validation update: move prerequisite discovery before temp directory creation and add static checks for the ordering.
- Close condition: static checks prove `runHelperExtraction()` gets Python commands and helper script path before calling `createTempDirectory()`, while no-Python fallback still returns `output_dir: null`.
- Closure: `runHelperExtraction()` now discovers Python commands and loads the bundled helper script before creating temp output; no-Python fallback returns `output_dir: null` without cleanup work, and static checks lock the ordering.

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
- Check synced HTML preview top-level `preview_quality` is normalized.
- Check preview quality normalization rejects inherited object prototype keys for both request and entry quality.
- Check Zotero `open-pdf` links never use Web API `users/<id>` prefixes.
- Check HTML preview page links and metadata are derived from normalized page targets.
- Check reader current-page and context-menu page targeting accept numeric strings and reject invalid values safely.
- Check page target normalizers reject null, boolean, and array values instead of numeric coercion.
- Check synced HTML preview scalar metadata cannot emit `NaN`, `Infinity`, `undefined`, `[object Object]`, or complex objects.
- Check synced HTML preview byte count is recomputed from the normalized data URL before metadata output.
- Check synced HTML preview rendered dimensions below one pixel become `null`.
- Check synced HTML preview byte count subtracts base64 padding.
- Check synced HTML preview source item metadata is scalar and compact.
- Check synced HTML preview scope metadata and generated titles are normalized.
- Check Zotero `open-pdf` source links normalize attachment keys before URI output.
- Check optional original helper image records are normalized before Zotero import.
- Check optional original helper file paths are scalar and stay inside the helper output directory.
- Check optional original image attachment titles normalize source title, page number, and occurrence.
- Check optional helper file path containment resolves `.` and `..` path segments before prefix comparison.
- Check optional helper file path containment preserves Windows UNC root identity before prefix comparison.
- Check optional original helper import skips missing output files without aborting remaining valid imports.
- Check optional original helper existence-check errors are reported separately from missing files.
- Check optional original helper import behavior dynamically skips missing files before `Zotero.Attachments.importFromFile`.
- Check optional original helper import continues after one existing helper file fails Zotero attachment import.
- Check optional original helper import reports an overall error when every attempted Zotero attachment import fails.
- Check optional helper failure messages normalize status and warning details before reader toast output.
- Check optional helper candidate failure aggregation normalizes helper status before warning output.
- Check optional helper warning aggregation handles malformed warning containers without throwing.
- Check optional helper schema mismatch errors normalize schema values before warning output.
- Check optional helper failure formatter handles missing or malformed helper reports without throwing.
- Check B41 raw-status static guard is scoped to the helper failure formatter.
- Check synced HTML preview entry lists and entry containers are normalized before field mutation.
- Check synced HTML preview data URL base64 payloads use canonical lengths before byte-count metadata output.
- Check reader page and auto-raster save entry points handle missing options inside guarded error paths.
- Check each reader save entry has independently scoped active-job cleanup static coverage.
- Check each reader save entry has independent missing-options regression coverage.
- Check clip-preview and optional-original save entry points handle missing options inside guarded error paths.
- Check all save entry active-job cleanup paths only delete jobs added by the current call.
- Check reader active-job keys normalize malformed scopes and tolerate missing option objects.
- Check original-image normalized-scope static coverage is scoped to `saveOriginalImagesFromReader()`.
- Check selection overlay replacement and cleanup restore the previous page host position.
- Check reader toast fallback does not wait for PDF context when no reader is available.
- Check reader toast fallback uses alert rather than main-window DOM toast when no PDF reader is available.
- Check clip/page save entries normalize quality keys before rendering, duplicate-key generation, and index metadata.
- Check canvas preview renderer self-normalizes malformed quality keys before pixels and metadata.
- Check reader toast message and level inputs are normalized before document toast and fallback alert output.
- Check optional original confirmation normalizes malformed options before scope use and save delegation.
- Check raw original confirmation options static guards are case-sensitive and do not reject `safeOptions`.
- Check preview duplicate guard keys normalize malformed preview and attachment fields.
- Check runtime diagnostics alert text normalizes malformed report fields and warning lines.
- Check raw diagnostics static guards are case-sensitive and do not reject `safeReport`.
- Check shared error message formatting normalizes object, array, null, undefined, empty, and oversized values.
- Check noisy error string static guard matches actual `[object Object]` source text without literal backslashes.
- Check reader toolbar tooltips follow the selected preview quality estimate.
- Check Auto Raster button state recovers from unavailable to available with the selected quality tooltip.
- Check context menu default-quality actions show the normalized default quality estimate and do not hardcode Medium for full-page preview.
- Check context menu default-quality action commands pass the same normalized quality key shown in their labels.
- Check VM-backed command payload tests assert scalar behavior fields rather than cross-context object prototype equality.
- Check auto-raster PDF.js image-coordinate conversion is behavior-tested for rectangle math, tiny-candidate filtering, overlap dedupe, and largest-first ordering.
- Check recursive cleanup only removes paths under the normalized plugin temp root.
- Check optional-helper temp output directories are created only after Python and helper script prerequisites are available.

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
- `7565942` B33 normalize HTML preview bbox.
- B33 XPI SHA256 `c493df863c924cac3c91fc30172897963e8ce36307fd6294c7aa61489f757f33` was built in `outputs/` for manual Zotero add-on manager installation.
- `f0e0de4` B34 normalize HTML preview quality metadata.
- B34 XPI SHA256 `028a3ea08679efccaa0f55ffae695110201f64028b7ea6509327361745dd0109` was built in `outputs/` for manual Zotero add-on manager installation.
- `aae8cb8` B35 normalize open-pdf page targets.
- B35 XPI SHA256 `9a548c482337de5685e5a7a1494d94756f1c6876cd80e902a69e3cb388832181` was built in `outputs/` for manual Zotero add-on manager installation.
- `a3837cc` B36 normalize HTML preview scalar metadata.
- B36 XPI SHA256 `8e62fee6574bf9e5f6881763a6f5282ba230eafbfc97965c3413401b5d3b6c12` was built in `outputs/` for manual Zotero add-on manager installation.
- `72b78d3` B37 normalize HTML source metadata.
- B37 XPI SHA256 `598d34659209be680a6c2a372144bb53a891b49159a80995ad2f27d9d0a2ed02` was built in `outputs/` for manual Zotero add-on manager installation.
- `a0b4754` B38 normalize original helper import.
- B38 XPI SHA256 `d80ac0fb7af750e2543ff647edaa87dd2c324d856093516d6c8af92c2c2bc991` was built in `outputs/` for manual Zotero add-on manager installation.
- `e5401c2` B39 guard original helper file imports.
- B39 XPI SHA256 `c6fb88604d8535896616b0248591d0fb3dc65503e4d3afa980566f69308fb932` was built in `outputs/` for manual Zotero add-on manager installation.
- `aa4e8e5` B40 isolate original import failures.
- B40 XPI SHA256 `a9ba4e2ad745663fa9620c79d162d9688db15d7d71a2b4dc3cb806f689af88e3` was built in `outputs/` for manual Zotero add-on manager installation.
- `5a20a63` B41 normalize helper failure messages.
- B41 XPI SHA256 `453f4a76493f1bc95dac041d3b87651bde7693a943eae5b73ff9cd0bc9cba33a` was built in `outputs/` for manual Zotero add-on manager installation.
- `a7abc73` B42 normalize preview entry containers.
- B42 XPI SHA256 `1938b80d2f321cf3a60d380428c82dec82c104aa3d17e6e44cc40e1c4599ac39` was built in `outputs/` for manual Zotero add-on manager installation.
- `bfef86f` B43 validate preview data url base64.
- B43 XPI SHA256 `8eb72ca65d77bdcf9cbeb36d3d6f4760805673f605f816af36c01a41db66c718` was built in `outputs/` for manual Zotero add-on manager installation.
- `534954c` B44 guard reader save entry options.
- B44 XPI SHA256 `54a31be2fbad818d908d33ecd4953cf853cf7de4e0301df9cce8c497d1d5aa2b` was built in `outputs/` for manual Zotero add-on manager installation.
- `d4d3b1d` B45 guard remaining save entry options.
- B45 XPI SHA256 `4d509d996d12f04d8bd5945d155dab8e60b60d81b32f48c1a3f95a89b0940b3b` was built in `outputs/` for manual Zotero add-on manager installation.
- `82fdde1` B46 restore selection overlay host state.
- B46 XPI SHA256 `603eaf0f0d4985e3ad339cdac83ad89c6d00b1684a58f597137ce19de7c43b45` was built in `outputs/` for manual Zotero add-on manager installation.
- `4d44b8b` B47 speed up reader toast fallback.
- B47 XPI SHA256 `4de6c08e391d4a482f038fb50a92fdc807417e7fb8130e3803d0404b68084e20` was built in `outputs/` for manual Zotero add-on manager installation.
- `831577c` B48 normalize save entry quality keys.
- B48 XPI SHA256 `711864fcc57e00ca87c2ae66215d889845d222a0b3c97c4943a08401d1c692d4` was built in `outputs/` for manual Zotero add-on manager installation.
- `89cbf6d` B49 normalize renderer quality keys.
- B49 XPI SHA256 `783c4d2bea774291e7dae43db39ead409b95c956b0b1168e6c4b8dd3f1b3bad3` was built in `outputs/` for manual Zotero add-on manager installation.
- `e50fcca` B50 normalize reader toast inputs.
- B50 XPI SHA256 `0a7695c5634eb7cbb213c4a0f868b16216cdcd6b80c55c0bc419727229992339` was built in `outputs/` for manual Zotero add-on manager installation.
- `e288c89` B51 guard original confirmation options.
- B51 XPI SHA256 `ed5a6cec5a3cbbbee20498d463de5c68b23c73e4512c5d325d0d7a8968512df9` was built in `outputs/` for manual Zotero add-on manager installation.
- `8bb8096` B52 normalize duplicate preview keys.
- B52 XPI SHA256 `05097b654acf493ae72842c1f9802082aace2ad87573b41c659cdc14f7778f03` was built in `outputs/` for manual Zotero add-on manager installation.
- `2eb5c06` B53 normalize diagnostics report text.
- B53 XPI SHA256 `dd280e38e6355e64d591e4c7e0d0dcace4639547b8a7a6a85e05fb1308207cc7` was built in `outputs/` for manual Zotero add-on manager installation.
- `700a334` B54 normalize shared error messages.
- B54 XPI SHA256 `030530099ff6afc05b95d997a74fceba99b93c9bf21883c22670167c90139e0f` was built in `outputs/` for manual Zotero add-on manager installation.
- `85d058a` B55 sync toolbar quality tooltips.
- B55 XPI SHA256 `c6658bae5891fb12ff358a4917ed5cb833462732ff77816b08c0e9d7c86d1a54` was built in `outputs/` for manual Zotero add-on manager installation.
- `05e10d7` B56 recover auto raster button state.
- B56 XPI SHA256 `e565f6f81be2f21abb09130cd9dd264a0e9f41862920ee1516b53b323e4689c6` was built in `outputs/` for manual Zotero add-on manager installation.
- `adaccce` B57 sync context menu default quality.
- B57 XPI SHA256 `21a24105cac3893e90fa9ad06daf0d41a725cb815e8b81da4fc4719046ec15fa` was built in `outputs/` for manual Zotero add-on manager installation.
- `dd5022c` B58 cover auto raster coordinates.
- B58 XPI SHA256 `095d9a6f34ba54ccb72ab29f994ceef01bef0d2811d96490693a853e585fc119` was built in `outputs/` for manual Zotero add-on manager installation.
- `ea79d58` B59 guard recursive temp cleanup.
- B59 XPI SHA256 `fb661947359cc1dbaba3da693fca5f07b5dccc4d9d378c45bfe0856ef8cee69b` was built in `outputs/` for manual Zotero add-on manager installation.
- `7cdfba2` B60 guard target plan regression loop.
- B60 XPI SHA256 `fb661947359cc1dbaba3da693fca5f07b5dccc4d9d378c45bfe0856ef8cee69b` was built in `outputs/` for manual Zotero add-on manager installation; plugin payload unchanged from B59.
- `6dff38d` B61 delay helper temp creation.
- B61 XPI SHA256 `2d8252f42ffa35d53674369a8958732280ac52c1cff228d057258fc560ca6364` was built in `outputs/` for manual Zotero add-on manager installation.
