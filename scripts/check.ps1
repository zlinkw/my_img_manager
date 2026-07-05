$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root

node --check .\bootstrap.js
node --check .\content\pdf-image-saver.js
node --check .\content\preferences.js

[xml](Get-Content -Encoding UTF8 -Raw -LiteralPath .\preferences.xhtml) | Out-Null

$manifest = Get-Content -Encoding UTF8 -Raw -LiteralPath .\manifest.json | ConvertFrom-Json
if ($manifest.applications.zotero.id -ne "pdf-image-saver@zlk.local") {
  throw "Unexpected plugin id"
}

if (!(Test-Path -LiteralPath .\prefs.js)) {
  throw "Root prefs.js missing"
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
  python .\content\helper\pdf_image_extract.py --help | Out-Null
}
else {
  Write-Warning "Python not found; optional helper syntax check skipped."
}

Write-Host "check ok"
