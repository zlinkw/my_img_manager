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

$bootstrapJS = Get-Content -Encoding UTF8 -Raw -LiteralPath .\bootstrap.js
if ($bootstrapJS -notmatch "await\s+registerPreferencePane\(id,\s*rootURI\)") {
  throw "bootstrap startup must await preference pane registration helper"
}
if ($bootstrapJS -notmatch "async\s+function\s+registerPreferencePane") {
  throw "bootstrap must define registerPreferencePane helper"
}
if ($bootstrapJS -notmatch "catch\s*\(error\)[\s\S]*Zotero\.logError\(error\)") {
  throw "preference pane registration helper must catch and log registration errors"
}

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
$failureSections = [regex]::Matches($targetPlan, '(?ms)^###\s+(FAIL-\d{8}-\d{3})\s*(.*?)(?=^#{1,6}\s+|\z)')
foreach ($section in $failureSections) {
  $failureID = $section.Groups[1].Value
  $body = $section.Groups[2].Value
  if ($body -match '(?m)^-\s+Status:\s+open\s*$' -and $body -match '(?m)^-\s+Closure:') {
    throw "Target plan failure $failureID is open but contains closure evidence"
  }
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
if (!$package.scripts.'install:xpi') {
  throw "install:xpi script missing"
}
if (!$package.scripts.'package:manual') {
  throw "package:manual script missing"
}
if (!$package.scripts.'verify:manual') {
  throw "verify:manual script missing"
}
if ($package.scripts.'package:manual' -ne "powershell -ExecutionPolicy Bypass -File scripts/package-manual.ps1") {
  throw "package:manual script must call scripts/package-manual.ps1"
}
if ($package.scripts.'verify:manual' -ne "powershell -ExecutionPolicy Bypass -File scripts/verify-manual-install.ps1") {
  throw "verify:manual script must call scripts/verify-manual-install.ps1"
}
if ($package.scripts.'install:xpi' -ne "powershell -ExecutionPolicy Bypass -File scripts/install-global.ps1 -InstallMode XPI") {
  throw "install:xpi script must call install-global.ps1 -InstallMode XPI"
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
if (!(Test-Path -LiteralPath .\scripts\package-manual.ps1)) {
  throw "package-manual.ps1 missing"
}
if (!(Test-Path -LiteralPath .\scripts\verify-manual-install.ps1)) {
  throw "verify-manual-install.ps1 missing"
}

$readme = Get-Content -Encoding UTF8 -Raw -LiteralPath .\README.md
if ($readme -notmatch "npm run package:manual") {
  throw "README must document manual package command"
}
if ($readme -notmatch "npm run verify:manual") {
  throw "README must document manual verification command"
}
if ($readme -notmatch "Install Add-on From File") {
  throw "README must document Zotero manual add-on installation"
}

$runtimeStatusScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\runtime-status.ps1
if ($runtimeStatusScript -notmatch "optionalMissingPayload") {
  throw "runtime status must report optional missing payload separately"
}
if ($runtimeStatusScript -notmatch "rawBytesContainAddonID") {
  throw "startup cache add-on id scan must be labeled as a raw-byte hint"
}
if ($runtimeStatusScript -match "(?m)^\s*containsAddonID\s*=") {
  throw "startup cache add-on id scan must not imply parsed cache semantics"
}
if ($runtimeStatusScript -match "StartTime\.ToString") {
  throw "runtime status must not call ToString() directly on Zotero process StartTime"
}
if ($runtimeStatusScript -notmatch "function\s+Format-ProcessDateTime") {
  throw "runtime status must use a null-safe process date formatter"
}
if ($runtimeStatusScript -notmatch "function\s+Get-ProcessPathSafe") {
  throw "runtime status must use a safe process path helper"
}

$preflightScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\smoke-preflight.ps1
if ($preflightScript -notmatch "xpiInstallValid") {
  throw "smoke preflight must accept a valid XPI install source"
}
if ($preflightScript -notmatch '!\$devProxyValid\s+-and\s+!\$xpiInstallValid\s+-and\s+!\$registered') {
  throw "smoke preflight must not reject a registered manual install only because source hints are incomplete"
}
if ($preflightScript -match "startupCache.*\.containsAddonID") {
  throw "smoke preflight must not hard-fail on raw startup cache add-on id hints"
}

$installScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\install-global.ps1
if ($installScript -notmatch 'ValidateSet\("Proxy",\s*"XPI"\)') {
  throw "install-global.ps1 must expose Proxy and XPI install modes"
}
if ($installScript -notmatch "Install-ProfileXPI") {
  throw "install-global.ps1 must support profile XPI fallback"
}
if ($installScript -notmatch "npm run install:xpi") {
  throw "install-global.ps1 must print the XPI fallback command when Zotero is running"
}
if ($installScript -notmatch 'before writing proxy"[^\r\n]*\r?\n\s*return\s+\$false') {
  throw "Proxy mode must refuse live source switching before writing proxy"
}
if ($installScript -notmatch "RetryCommand") {
  throw "install-global.ps1 must use mode-specific retry command guidance"
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
if ($mainJS -notmatch "(?m)^\s*const\s+HARD_MAX_PAGE_IMAGES\s*=\s*500\s*;") {
  throw "Optional helper page image hard cap changed unexpectedly"
}
if ($mainJS -notmatch "(?m)^\s*const\s+HARD_MAX_DOCUMENT_IMAGES\s*=\s*2000\s*;") {
  throw "Optional helper document image hard cap changed unexpectedly"
}
if ($mainJS -notmatch "(?m)^\s*const\s+HARD_MAX_HELPER_TIMEOUT_SECONDS\s*=\s*600\s*;") {
  throw "Optional helper timeout hard cap changed unexpectedly"
}
if ($mainJS -notmatch "function\s+getHelperMaxImages\s*\(\s*scope\s*\)") {
  throw "Optional helper max images must use a hard-clamped getter"
}
if ($mainJS -notmatch "function\s+getHelperTimeoutSeconds\s*\(") {
  throw "Optional helper timeout must use a hard-clamped getter"
}
if ($mainJS -notmatch "await\s+removeFileIfExists\(reportPath\);\s*\r?\n\s*const\s+exitCode\s*=\s*await\s+runProcess") {
  throw "Optional helper must remove stale report before each Python candidate"
}
if ($mainJS -notmatch "exit_code:\s*exitCode") {
  throw "Optional helper report metadata must record process exit code"
}
if ($mainJS -notmatch "return\s+process\.exitValue;") {
  throw "runProcess must return helper process exit code"
}
$helperMaxCallCount = ([regex]::Matches($mainJS, "getHelperMaxImages\(")).Count
if ($helperMaxCallCount -lt 3) {
  throw "Confirmation text and helper args must call getHelperMaxImages()"
}
if ($mainJS -notmatch "function\s+limitOriginalImagesForImport\s*\(\s*report\s*,\s*scope\s*\)") {
  throw "Original image import must use an import-side image limit helper"
}
if ($mainJS -notmatch "const\s+limited\s*=\s*limitOriginalImagesForImport\(report,\s*scope\)") {
  throw "Original image import path must call the import-side image limit helper"
}
if ($mainJS -match "for\s*\(\s*const\s+image\s+of\s+report\.images\s*\)") {
  throw "Original image import must not iterate raw helper report images"
}
if ($mainJS -notmatch "images:\s*images\.slice\(0,\s*maxImages\)") {
  throw "Original image import limiter must truncate images to maxImages"
}
$mainWithoutHelperMaxGetter = [regex]::Replace(
  $mainJS,
  "function\s+getHelperMaxImages\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+getHelperTimeoutSeconds",
  "function getHelperTimeoutSeconds"
)
if ($mainWithoutHelperMaxGetter -match 'getIntegerPref\("max(Page|Document)Images"') {
  throw "Optional helper max image prefs must not be read outside getHelperMaxImages()"
}
if ($mainJS -match 'getIntegerPref\("helperTimeoutSeconds",\s*DEFAULT_HELPER_TIMEOUT_SECONDS\)\)\s*\*\s*1000') {
  throw "runProcess must not read raw helper timeout prefs directly"
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
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildIndexHTML") {
  throw "buildIndexHTML must remain exported for regression tests"
}
if ($mainJS -match "getSelectedItems") {
  throw "Active reader selection must not use selected library items as reader tab IDs"
}
if ($mainJS -match "readers\.find\(\(reader\)\s*=>\s*isPDFReader\(reader\)\)") {
  throw "Active reader selection must not fall back to the first PDF reader"
}
if ($mainJS -match '!\s*reader\.type\s*\|\|\s*reader\.type\s*===\s*"pdf"') {
  throw "PDF reader detection must not treat missing reader.type as PDF"
}
if ($mainJS -notmatch 'function\s+getReaderType\s*\(\s*reader\s*\)') {
  throw "PDF reader detection must use an explicit reader type helper"
}
if ($mainJS -notmatch 'reader\?\._item\?\.attachmentReaderType') {
  throw "PDF reader type helper must support attachment reader type fallback"
}
if ($mainJS -notmatch 'function\s+isPDFReader\s*\(\s*reader\s*\)\s*\{\s*return\s+getReaderType\(reader\)\s*===\s*"pdf";\s*\}') {
  throw "PDF reader detection must require an explicit PDF reader type"
}
if ($mainJS -notmatch "reader\?\._iframeWindow\s*\|\|\s*reader\?\._iframe\?\.contentWindow") {
  throw "PDF viewer context lookup must check direct reader iframe window"
}
if ($mainJS -notmatch "annotation_key:\s*entry\.annotationKey") {
  throw "metadata must include annotation_key"
}
if ($mainJS -notmatch "_unregisterEventListenerByPluginID\(config\.id\)") {
  throw "Reader listener cleanup must use plugin-ID scoped unregister when available"
}
if ($mainJS -notmatch "\.filter\(\(listener\)\s*=>\s*listener\.pluginID\s*!==\s*config\.id\)") {
  throw "Reader listener cleanup fallback must filter by plugin ID"
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
