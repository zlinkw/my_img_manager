# Project Constraints

This file is the modification contract for PDF Image Saver. Read it before changing code, tests, scripts, docs, or packaging behavior.

## Background Agents

- Background agents are disabled for this project.
- Do not create or restart target-mode, GoalPulse, review-agent, planning-agent, subagent, watcher, daemon, or auto-iteration loops inside this repository.
- Do not create `.agents/`, `.goalpulse/`, `agent-state/`, or similar local agent state directories.
- `docs/target-mode-plan.md` is historical only. It must not be used as an active execution plan.
- Compress `docs/target-mode-plan.md` on a schedule and whenever it grows past a short snapshot: rewrite in place, never append batch ledgers.
- Keep `docs/target-mode-plan.md` under 80 lines / 4096 bytes. `npm.cmd run check` enforces this; when it fails, compress the file rather than raising the cap.
- New work must be driven by explicit user requests plus this constraint file, not by autonomous background planning.

## Product Scope

- The plugin captures useful figures from the open Zotero PDF reader.
- Manual current-page clipping is the only regular capture workflow; whole-page preview and original extraction remain explicit secondary actions.
- Category inference may prefill the confirmation dialog from captions or nearby references, but it must never become an automatic capture workflow.
- Optional original image extraction must not be required for normal clipping.
- Zotero 9.x compatibility is the runtime baseline; manifest `strict_max_version` stays `9.*`.
- Online update checking is disabled. The manifest must not advertise `update_url`, the plugin must not poll release feeds, and upgrades happen only through a user-initiated stable XPI install in Zotero's add-on manager.
- Do not add GitHub Actions workflows. Release validation and packaging are local responsibilities; publishing may only hand off locally built artifacts.

## Storage Contract

- The only persistent image store is `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`.
- `images.image_blob` is the shared original image payload. Do not generate Zotero HTML preview attachments, thumbnail libraries, preview databases, or alternate image stores.
- The full gallery may materialize original bytes temporarily under `%TEMP%\pdf-image-saver\paper-image-library-view`; those files are rebuildable view output, never a data source.
- Database schema, gallery UI, sharing, bridge security, and PPT reuse must follow `docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md` and `docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md`.
- Do not read or write Zotero internal `zotero.sqlite`, `zotero.sqlite-wal`, or `zotero.sqlite-shm`.
- Saved image bytes remain bounded by the selected quality and fixed per-image limits.
- Saved metadata must preserve source provenance: PDF attachment key, page number, bbox/source region, duplicate keys, annotation key when available, and `zotero://open-pdf` source link.

## UI Contract

- Reader toolbar actions must stay obvious and low-risk: quality, clip current page, current-paper gallery, global gallery.
- Quality choices must show expected storage impact.
- Error messages must explain whether the failure is capture, helper, duplicate, byte cap, or Zotero storage related.
- Full gallery management is owned by the Zotero plugin; PPT must reuse the generated gallery and may keep only its documented lightweight read-only picker.

## Optimization Priority

- Future work must optimize UI first.
- Keep working on UI until remaining UI issues are exhausted or blocked by missing user design choices.
- Only after UI is no longer the highest-value remaining surface should batches move to non-UI feature work.
- UI here means reader toolbar, context menu, selection overlay, toasts/alerts, diagnostics text, preference pane layout/status, and any user-facing wording that affects operation clarity.
- Do not expand feature scope while there are still clear UI clarity, density, labeling, feedback, or preference-status problems that can be fixed safely.

## Modification Rules

- Keep changes scoped to one coherent behavior surface per batch.
- Before editing shared behavior, read the related implementation, tests, README section, and this file.
- If a fix changes user-visible behavior, update README and tests in the same batch.
- If a fix changes metadata shape, duplicate identity, storage location, or Zotero URI generation, update static checks and regression tests in the same batch.
- Prefer deterministic validation over broad fallback logic. Do not add vague catch-all behavior that can hide bad metadata.
- Do not leave half-migrated architecture where old docs describe one storage mode and code implements another.

## Validation Rules

- Minimum fast iteration validation: `npm.cmd test` plus `git diff --check`.
- For script, manifest, packaging, or runtime contract changes, also run `npm.cmd run check`.
- `npm.cmd run check` owns the release gates: unit/static checks, the PPT-side Zotero protocol gate, and the headless Chromium UI audit. Both external gates skip explicitly (never fail) when the PPT repo or a browser is absent.
- Any UI change must keep `npm.cmd run audit:index-buttons` green. It is the only gate that exercises real DOM behavior.
- Browser-audit fixtures live in `tests/current-release.test.js` and their shape is asserted there. Never weaken a fixture to make the audit pass; if the audit contradicts the implementation and README, fix whichever one is actually wrong and say which in the batch notes.
- Handoff XPI paths must be resolved through `scripts/current-xpi.ps1`. Never hardcode an `outputs\pdf-image-saver-<version>.xpi` filename; a static check enforces this.
- Release changes must keep `package.json`, `manifest.json`, version assertions, and stable asset naming synchronized. Stable release artifacts use `pdf-image-saver-<manifest-version>.xpi`. Never reintroduce `updates.json`, `update_url`, or `.github/workflows/`.
- For install handoff changes, run `npm.cmd run build` and package only when explicitly requested.
- Do not use bare `npm run` in Windows instructions; use `npm.cmd run`.

## Optimization Backlog

### UI First

- Dense reader toolbar, menus, overlays, toasts, diagnostics, prefs, and HTML indexes landed.
- Keep fixed internal error categories: `Capture failed:` / `Helper:` / `Storage failed:` / `Byte cap:`; all displayed wording must be native Chinese.
- Every new internal error must gain a Chinese entry in the `known` table in the same batch; a static check fails the build otherwise. Never compose user-visible text as a Chinese prefix plus a raw internal message — translate first, then prefix, or the "contains Chinese" guard passes on the prefix alone and leaks English.
- Keep stable toolbar widths/aria and single toast element.
- Inventable densify churn is exhausted. Further UI only for concrete clarity gaps or user-reported runtime wording.
- Selection size badge now marks below-min drags as `min12`; toast is click/Esc-dismiss; index Open actions include page (`Open pN`).
- Clip drag hint shows quality; source-region map is a clickable open-PDF link.
- Toolbar exposes `aria-busy`/`data-mode`; busy controls explain their lock; toast Esc yields to active clip overlay.
- Below-min selection badge uses `is-min` visual state.
- Clip cancel: Esc/RMB; toast uses aria-live/data-level/progress aria-busy; index header shows total preview bytes; prefs short labels keep title tooltips.
- Selection size badge includes quality mark L/M/H; preview entries show `#N` badge and summary Det; original index rows numbered.
- Success toasts include quality mark L/M/H with estimate/size.
- Index header is sticky; Open map title includes page; toast shows dismiss mark; Trace no longer duplicates Det.
- Progress toasts and context-menu clip/auto/page labels include quality marks; entry badges include L/M/H; original index sticky header/thead.
- Quality labels include mark L/M/H across toolbar, prefs, diagnostics, index Q lines, and min12 badges.
- Attachment/document titles include quality marks; index headers expose `Open first pN`.
- Multi-entry indexes expose jump anchors/lists with page marks (`#NpN`), Open last, top anchor, and Top footer; busy toasts include quality marks.
- Capture stores figure `image_category`, `color_family`, `layout_hint`, `aspect_ratio`, `slide_slot`, `role_hint`, `insert_hint`, `caption_hint`, `story_order`, `story_beat`, `dominant_hex`, `contrast_hex`, palette, `style_tags`, and `ppt_assist_token` for PPT search/color/layout/placement/narrative/drawing assist; toolbar/prefs expose Cat; indexes expose category/layout/slot/role/insert/caption/hue/story filters, palette chips, Copy PPT/pal/pair/role/insert/cap/story.

- The headless UI audit is restored and wired into `npm.cmd run check`. It had been dead since the recovery batch because the fixtures degraded, so no UI batch between then and 2026-07-26 was actually validated in a real DOM. Re-check any UI claim from that window against the audit before trusting it.

### After UI Is Exhausted

- Smoke scripts distinguish development-proxy vs manual/XPI readiness for Zotero 9.x; keep registration checks aligned with that split.
- Handoff scripts resolve the current XPI from `manifest.json`; stale other-version packages in `outputs` are reported, never installed.
- Optional original extraction remains isolated; missing Python is quiet-failed before helper progress toast, and diagnostics report helper availability.
- User-facing errors now classify capture / helper / duplicate / byte-cap / storage failures.
- Historical `docs/target-mode-plan.md` stays a short snapshot only; compress on schedule and whenever it grows, never append batch ledgers.
- Next non-UI work should only proceed from concrete user-reported runtime/install gaps or feature requests.
