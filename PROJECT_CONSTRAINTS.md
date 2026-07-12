# Project Constraints

This file is the modification contract for PDF Image Saver. Read it before changing code, tests, scripts, docs, or packaging behavior.

## Background Agents

- Background agents are disabled for this project.
- Do not create or restart target-mode, GoalPulse, review-agent, planning-agent, subagent, watcher, daemon, or auto-iteration loops inside this repository.
- Do not create `.agents/`, `.goalpulse/`, `agent-state/`, or similar local agent state directories.
- `docs/target-mode-plan.md` is historical only. It must not be used as an active execution plan.
- Compress `docs/target-mode-plan.md` on a schedule and whenever it grows past a short snapshot: rewrite in place, never append batch ledgers.
- Keep `docs/target-mode-plan.md` under roughly 80 lines / 4 KB. If longer, compress before other documentation work.
- New work must be driven by explicit user requests plus this constraint file, not by autonomous background planning.

## Product Scope

- The plugin captures useful figures from the open Zotero PDF reader.
- The primary workflow is manual current-page clipping from the rendered PDF reader canvas.
- `Auto` is optional and must degrade clearly when PDF.js image coordinate access is n/a.
- Optional original image extraction must not be required for normal clipping.
- Zotero 9.0.5 compatibility is the current runtime baseline.

## Storage Contract

- Current repository behavior stores compact Zotero HTML index attachments.
- Do not silently switch storage architecture, sync target, DB schema, or attachment behavior without updating README, tests, and smoke checklist together.
- Do not read or write Zotero internal `zotero.sqlite`, `zotero.sqlite-wal`, or `zotero.sqlite-shm`.
- Preview payloads must stay bounded by quality, candidate count, preview byte cap, and HTML index size cap.
- Saved metadata must preserve source provenance: PDF attachment key, page number, bbox/source region, duplicate keys, annotation key when available, and `zotero://open-pdf` source link.

## UI Contract

- Reader toolbar actions must stay obvious and low-risk: clip current page first, optional auto/original actions second.
- Quality choices must show expected storage impact.
- Error messages must explain whether the failure is capture, helper, duplicate, byte cap, or Zotero storage related.
- Avoid adding UI that previews or manages large image libraries unless the storage contract is deliberately changed.

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
- For install handoff changes, run `npm.cmd run build` and package only when explicitly requested.
- Do not use bare `npm run` in Windows instructions; use `npm.cmd run`.

## Optimization Backlog

### UI First

- Dense reader toolbar, menus, overlays, toasts, diagnostics, prefs, and HTML indexes landed.
- Keep fixed category prefixes and shared tokens: `Capture failed:` / `Helper:` / `Storage failed:` / `Byte cap:` / `Auto/Clip/Page skip`; `saved/session dups`; `byte/item/over cap`; quality labels with estimates; detector `manual`/`auto`; scope `clip/page/auto/doc`; fallback `Use clip.`.
- Prefs status and diagnostics already share Store/Q/dups/caps/auto-helper mins+max, helper page/doc/timeout/py mode; indexes share Open actions and densified headers/titles.
- Keep stable toolbar widths/aria and single toast element.
- Inventable densify churn is exhausted. Further UI only for concrete clarity gaps or user-reported runtime wording.

### After UI Is Exhausted

- Smoke scripts now distinguish development-proxy vs manual/XPI readiness for Zotero 9.0.5; keep registration checks aligned with that split.
- Optional original extraction remains isolated; missing Python is quiet-failed before helper progress toast, and diagnostics report helper availability.
- User-facing errors now classify capture / helper / duplicate / byte-cap / storage failures.
- Historical `docs/target-mode-plan.md` stays a short snapshot only; compress on schedule and whenever it grows, never append batch ledgers.
- Next non-UI work should only proceed from concrete user-reported runtime/install gaps or feature requests.
