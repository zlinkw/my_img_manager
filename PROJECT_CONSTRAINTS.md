# Project Constraints

This file is the modification contract for PDF Image Saver. Read it before changing code, tests, scripts, docs, or packaging behavior.

## Background Agents

- Background agents are disabled for this project.
- Do not create or restart target-mode, GoalPulse, review-agent, planning-agent, subagent, watcher, daemon, or auto-iteration loops inside this repository.
- Do not create `.agents/`, `.goalpulse/`, `agent-state/`, or similar local agent state directories.
- `docs/target-mode-plan.md` is historical only. It must not be used as an active execution plan.
- New work must be driven by explicit user requests plus this constraint file, not by autonomous background planning.

## Product Scope

- The plugin captures useful figures from the open Zotero PDF reader.
- The primary workflow is manual current-page clipping from the rendered PDF reader canvas.
- `Auto Raster` is optional and must degrade clearly when PDF.js image coordinate access is unavailable.
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

- Improve preference/status UI further with install/source diagnostics when needed; current prefs already surface storage mode, quality, caps, and duplicate-guard state.
- Keep duplicate-skip messaging specific as new save paths are added; clip/page/auto already distinguish session memory, synced HTML indexes, and byte caps.
- Tighten smoke scripts around Zotero 9.0.5 registration and manual add-on install status.
- Keep optional original extraction isolated from the main preview workflow and make helper absence quieter.
- Compact or archive old historical target-mode notes when they slow navigation, while preserving useful failure IDs and lessons.
