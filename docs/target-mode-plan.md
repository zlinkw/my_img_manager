# Target Mode Plan

> Retired: background agents and target-mode execution are disabled for this repository.
> Historical reference only. New modifications must follow `PROJECT_CONSTRAINTS.md`.

## Goal Snapshot

Build a Zotero 9.0.5 compatible plugin that saves compact HTML figure preview indexes from the open PDF reader, with enough metadata to reopen the source page/region. Optional Python/PyMuPDF original extraction remains non-required.

Priority order that shaped the project:

1. Correct capture, page targeting, and provenance metadata.
2. Fast one-click reader workflow.
3. Clear low-risk UI.
4. Low resource use after correctness is stable.

## Current Contract

- Storage: compact Zotero HTML preview-index child attachments.
- Main path: manual current-page clip from the rendered reader canvas.
- Optional: Auto raster when PDF.js image coordinates exist.
- Optional: original embeds via local helper; absence must not block clip.
- Runtime baseline: Zotero 9.0.5 (`strict_max_version: 9.0.*`).
- Do not read/write Zotero internal `zotero.sqlite*`.

## Useful Lessons Preserved

- Reader toolbar must keep clip first; auto/original second.
- Duplicate identity needs both session memory and saved HTML-index checks.
- Preview quality estimates must stay visible in UI.
- Runtime registration is verified by `npm.cmd run runtime:status` / `smoke:preflight`, not by package success alone.
- Manual XPI install is the preferred package handoff on Zotero 9.0.5 until profile-XPI fallback is fully trusted.
- Historical batch logs, failure IDs, and long iteration notes were compacted here to reduce navigation cost.

## Validation Today

Use the active contract and scripts, not this file:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run runtime:status
npm.cmd run verify:manual
npm.cmd run smoke:preflight
```

Package only when explicitly requested.
