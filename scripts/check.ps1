$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @()
  )
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

Invoke-Native "node" @("--check", ".\bootstrap.js")
Invoke-Native "node" @("--check", ".\content\pdf-image-saver.js")
Invoke-Native "node" @("--check", ".\content\preferences.js")
Invoke-Native "node" @("--check", ".\tests\open-pdf-uri.test.js")
Invoke-Native "node" @(".\tests\open-pdf-uri.test.js")

[xml](Get-Content -Encoding UTF8 -Raw -LiteralPath .\preferences.xhtml) | Out-Null
$prefsXML = [xml](Get-Content -Encoding UTF8 -Raw -LiteralPath .\preferences.xhtml)

$manifest = Get-Content -Encoding UTF8 -Raw -LiteralPath .\manifest.json | ConvertFrom-Json
if ($manifest.applications.zotero.id -ne "pdf-image-saver@zlk.local") {
  throw "Unexpected plugin id"
}
if ($manifest.applications.zotero.strict_max_version -ne "9.0.*") {
  throw "Zotero strict_max_version must be 9.0.*"
}
if ($manifest.description -notmatch "preview indexes") {
  throw "Manifest description must describe preview index default workflow"
}

$targetPlan = Get-Content -Encoding UTF8 -Raw -LiteralPath .\docs\target-mode-plan.md
if ($targetPlan -notmatch 'Target Zotero range: `7\.0` to `9\.0\.\*`') {
  throw "Target plan must document Zotero range 7.0 to 9.0.*"
}
if ($targetPlan -notmatch "Use Zotero reader rendered canvas for default preview index extraction") {
  throw "Target plan must document reader canvas default extraction"
}
if ($targetPlan -match "(?m)^- Use local Python and PyMuPDF for original embedded image extraction\.$") {
  throw "Target plan must not present local Python helper as required"
}

$package = Get-Content -Encoding UTF8 -Raw -LiteralPath .\package.json | ConvertFrom-Json
if (!$package.scripts.'runtime:status') {
  throw "runtime:status script missing"
}
if (!$package.scripts.'smoke:preflight') {
  throw "smoke:preflight script missing"
}
if (!$package.scripts.'smoke:wait') {
  throw "smoke:wait script missing"
}
if (!(Test-Path -LiteralPath .\scripts\runtime-status.ps1)) {
  throw "runtime-status.ps1 missing"
}
if (!(Test-Path -LiteralPath .\scripts\smoke-preflight.ps1)) {
  throw "smoke-preflight.ps1 missing"
}
if (!(Test-Path -LiteralPath .\scripts\smoke-wait.ps1)) {
  throw "smoke-wait.ps1 missing"
}
if (!(Test-Path -LiteralPath .\scripts\check-xpi.ps1)) {
  throw "check-xpi.ps1 missing"
}

if (!(Test-Path -LiteralPath .\prefs.js)) {
  throw "Root prefs.js missing"
}

$mainJS = Get-Content -Encoding UTF8 -Raw -LiteralPath .\content\pdf-image-saver.js
if ($mainJS -notmatch "(?m)^\s*const\s+HARD_MAX_AUTO_PREVIEW_BYTES_MB\s*=\s*8\s*;") {
  throw "Auto preview hard cap changed unexpectedly"
}
if ($mainJS -notmatch "(?m)^\s*const\s+HARD_MAX_INDEX_BYTES_MB\s*=\s*12\s*;") {
  throw "Index hard cap changed unexpectedly"
}
if ($mainJS -notmatch "function\s+buildOpenPDFURI\s*\(\s*attachment\s*,\s*pageNumber\s*,\s*annotationKey\s*\)") {
  throw "open-pdf URI builder must accept annotationKey"
}
if ($mainJS -notmatch "annotation=\$\{encodeURIComponent\(normalizedAnnotationKey\)\}") {
  throw "open-pdf URI builder must append encoded annotation parameter"
}
if ($mainJS -notmatch "source_region:\s*entry\.sourceRegion") {
  throw "metadata must include source_region"
}
if ($mainJS -notmatch "annotation_key:\s*entry\.annotationKey") {
  throw "metadata must include annotation_key"
}
if ($mainJS -notmatch "class=`"source-map`"") {
  throw "HTML index must include compact source region map"
}
if ($mainJS -match "Zotero\.Annotations\.saveFromJSON") {
  throw "Plugin must not create Zotero annotations by default"
}

$autoMax = $prefsXML.SelectSingleNode("//*[@id='pdf-image-saver-auto-max-preview-mb']")
if (!$autoMax -or $autoMax.max -ne "8") {
  throw "Auto preview UI max must be 8 MB"
}
$indexMax = $prefsXML.SelectSingleNode("//*[@id='pdf-image-saver-max-index-mb']")
if (!$indexMax -or $indexMax.max -ne "12") {
  throw "HTML index UI max must be 12 MB"
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
  Invoke-Native "python" @(".\content\helper\pdf_image_extract.py", "--help") | Out-Null
}
else {
  Write-Warning "Python not found; optional helper syntax check skipped."
}

if (Test-Path -LiteralPath .\outputs\pdf-image-saver-0.1.0.xpi) {
  Invoke-Native "powershell" @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\check-xpi.ps1")
}

Write-Host "check ok"
