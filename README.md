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
npm run check
npm run build
npm run install:global
npm run runtime:status
```

The global install script writes a Zotero extension proxy file into each detected Zotero profile. Restart Zotero to load a newly installed plugin.
`runtime:status` reports whether the proxy is installed, whether Zotero has registered the add-on in the current session, and whether temp files remain.
