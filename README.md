# PDF Image Saver

Zotero plugin for clipping figure previews from the open PDF reader and saving a small synced index attachment.

## Features

- Runs independently inside Zotero by using the rendered PDF reader canvas.
- Toolbar button starts box selection on the current page.
- `Auto Raster` tries current-page embedded raster detection when the bundled Zotero PDF.js runtime exposes image coordinates; manual clipping remains the main path.
- Context menu offers low, medium, and high preview quality with estimated size.
- Saves one HTML child attachment containing the preview, compact metadata, and a `zotero://open-pdf` source link.
- Does not save full original image bytes by default, reducing Zotero storage and sync load.
- Auto-detected previews are capped by count, preview bytes, and final synced HTML index size.
- Optional helper can try PyMuPDF original image extraction when Python is available, but the main workflow does not depend on it.

## Runtime Independence

The default save path is fully contained in the Zotero plugin package. It uses Zotero's own JavaScript runtime, the already-rendered PDF reader canvas, and Zotero stored HTML child attachments. No conda environment, Python interpreter, PyMuPDF install, local export directory, or machine-specific path is required for clipping and syncing previews.

The bundled Python file is only an optional helper for explicit original-image extraction. If Python or PyMuPDF is missing, the plugin keeps the preview workflow available and reports the helper as unavailable.

## Preview Quality

- Low: max width 240 px, about 20-80 KB per image.
- Medium: max width 480 px, about 60-220 KB per image.
- High: max width 960 px, about 180-750 KB per image.

Default toolbar action uses Medium.

## Optional Original Extraction

Original embedded image extraction is optional and may require Python plus PyMuPDF. The plugin remains usable when this helper is unavailable.

```powershell
python -m pip install --user PyMuPDF
```

The helper discovery also checks the local conda `zlk` environment first when present.

## Development

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run package:manual
npm.cmd run verify:manual
npm.cmd run install:global
npm.cmd run install:xpi
npm.cmd run runtime:status
npm.cmd run smoke:preflight
npm.cmd run smoke:wait
```

## Manual Installation

Use the manual package command for the handoff build:

```powershell
npm.cmd run package:manual
```

It rebuilds the XPI, validates the payload, and prints the exact XPI path, SHA256, file size, Zotero manual install steps, and post-install verification commands.

Install the printed XPI through Zotero's add-on manager:

1. Zotero: Tools > Add-ons.
2. Gear menu > Install Add-on From File...
3. Select `outputs\pdf-image-saver-0.1.0.xpi`.
4. Confirm the install if Zotero prompts.
5. Restart Zotero if Zotero requests it.

After Zotero starts, run:

```powershell
npm.cmd run verify:manual
npm.cmd run smoke:wait
npm.cmd run smoke:preflight
npm.cmd run runtime:status
```

`verify:manual` is read-only. It summarizes the packaged XPI, Zotero process count, profile registration state, source hints, rescan state, temp children, and the next action.

The global install script writes a Zotero extension proxy file into each detected Zotero profile for development testing. Restart Zotero to load a newly installed proxy.
`install:xpi` is a profile XPI fallback for testing the packaged plugin rather than the development proxy; close Zotero before running it so the installer can switch the source cleanly. On Zotero 9.0.5, manual add-on manager installation is the preferred package handoff until the copied-profile-XPI fallback is verified.
`runtime:status` reports whether the proxy is installed, whether the proxy target manifest is readable, whether expected payload files exist, whether Zotero has registered the add-on in the current session, whether startup cache/UUID hints exist, and whether temp files remain.
If `runtime:status` reports `rescan.needsRescan: true`, close Zotero and run `npm.cmd run install:global` once more. The installer will then clear Zotero's extension scan cache prefs so the proxy is registered on the next Zotero launch.

## Runtime Smoke Checklist

After Zotero has been restarted or the add-on has been reloaded:

- Optional: `npm.cmd run smoke:wait` waits until registration is ready.
- `npm.cmd run smoke:preflight` passes.
- `npm.cmd run runtime:status` shows `registered: true` for `pdf-image-saver@zlk.local`.
- A PDF reader toolbar shows one `Clip Figure` control group.
- A manual clip creates one Zotero stored HTML child attachment.
- The HTML preview opens, shows the preview, source region map, compact index identity, and collapsed metadata containing `source_region`, `source_region_key`, `preview_index_key`, `preview_duplicate_key`, and `annotation_key`.
- Clicking preview or page opens the source PDF page.
- `Auto Raster` disables or warns safely when image coordinates are unavailable.
- `%TEMP%\pdf-image-saver` has no leftover child directories after the save.
