# Target Mode Plan

> Retired / historical only. Background agents and target-mode loops are disabled.
> Active contract: `PROJECT_CONSTRAINTS.md`.
> Maintenance: keep this file short. Compress or rewrite instead of appending batch logs.

## Snapshot

Zotero 9.0.5 plugin that saves compact HTML figure preview indexes from the open PDF reader, with provenance to reopen page/region. Optional Python/PyMuPDF originals are non-required.

Priority that shaped the project:

1. Correct capture and provenance
2. Fast reader workflow
3. Clear low-risk UI
4. Low resource use after correctness

## Contract

- Storage: compact Zotero HTML preview-index child attachments
- Main path: manual current-page clip
- Optional: Auto when PDF.js image coordinates exist
- Optional helper must not block clip
- Runtime: Zotero 9.0.5 (`strict_max_version: 9.0.*`)
- Never read/write Zotero internal `zotero.sqlite*`

## Lessons

- Clip first; auto/original second; dense shared tokens for dups/caps/scope/Use clip
- Duplicate identity needs session memory + saved HTML indexes
- Quality estimates must stay visible
- Registration gate: `npm.cmd run runtime:status` / `smoke:preflight`
- Manual XPI install is preferred package handoff on Zotero 9.0.5

## Validate

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run runtime:status
npm.cmd run verify:manual
npm.cmd run smoke:preflight
```

Package only when explicitly requested.

## Compression Rule

Do not re-expand this file with batch diaries, commit lists, or long failure narratives.
When new durable lessons appear, rewrite the short Snapshot / Contract / Lessons sections in place.
If the file exceeds ~80 lines or ~4 KB, compress before any other docs work.
