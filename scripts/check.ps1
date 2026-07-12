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
$targetPlanLines = @($targetPlan -split "`r?`n").Count
$targetPlanBytes = [Text.Encoding]::UTF8.GetByteCount($targetPlan)
if ($targetPlan -notmatch "Retired|historical only") {
  throw "Target plan must remain marked retired/historical"
}
if ($targetPlan -notmatch "PROJECT_CONSTRAINTS\.md") {
  throw "Target plan must redirect new work to PROJECT_CONSTRAINTS.md"
}
if ($targetPlan -notmatch "Zotero 9\.0\.5") {
  throw "Target plan snapshot must keep Zotero 9.0.5 runtime baseline"
}
if ($targetPlan -notmatch "strict_max_version:\s*9\.0\.\*") {
  throw "Target plan snapshot must keep strict_max_version 9.0.*"
}
if ($targetPlan -notmatch "manual current-page clip") {
  throw "Target plan snapshot must keep manual clip as main path"
}
if ($targetPlan -notmatch "Optional") {
  throw "Target plan snapshot must keep optional helper isolation"
}
if ($targetPlan -notmatch "Compress|compress|rewrite instead of appending|never append") {
  throw "Target plan must document compression/no-ledger maintenance rule"
}
if ($targetPlan -match "(?m)^- Use local Python and PyMuPDF for original embedded image extraction\.$") {
  throw "Target plan must not present local Python helper as required"
}
if ($targetPlanLines -gt 80) {
  throw "Target plan is too long ($targetPlanLines lines). Compress the historical snapshot before continuing."
}
if ($targetPlanBytes -gt 4096) {
  throw "Target plan is too large ($targetPlanBytes bytes). Compress the historical snapshot before continuing."
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
if ($readme -notmatch "npm\.cmd run package:manual") {
  throw "README must document manual package command"
}
if ($readme -notmatch "npm\.cmd run verify:manual") {
  throw "README must document manual verification command"
}
foreach ($requiredReadmeCommand in @(
  "npm.cmd run check",
  "npm.cmd run build",
  "npm.cmd run package:manual",
  "npm.cmd run verify:manual",
  "npm.cmd run install:global",
  "npm.cmd run install:xpi",
  "npm.cmd run runtime:status",
  "npm.cmd run smoke:preflight",
  "npm.cmd run smoke:wait"
)) {
  if ($readme -notmatch [regex]::Escape($requiredReadmeCommand)) {
    throw "README missing Windows-safe PowerShell command: $requiredReadmeCommand"
  }
}
if ($readme -match '(?m)^\s*npm run\s+' -or $readme -match '`npm run\s+') {
  throw "README PowerShell command guidance must use npm.cmd run"
}
foreach ($requiredReadmeMetadata in @("source_region_key", "preview_index_key", "preview_duplicate_key")) {
  if ($readme -notmatch [regex]::Escape($requiredReadmeMetadata)) {
    throw "README smoke checklist must mention compact metadata key: $requiredReadmeMetadata"
  }
}
if ($readme -notmatch "collapsed metadata") {
  throw "README smoke checklist must mention collapsed metadata UI"
}
if ($readme -notmatch "Install Add-on From File") {
  throw "README must document Zotero manual add-on installation"
}

$packageManualScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\package-manual.ps1
foreach ($requiredPackageCommand in @(
  "npm.cmd run verify:manual",
  "npm.cmd run smoke:wait",
  "npm.cmd run smoke:preflight",
  "npm.cmd run runtime:status"
)) {
  if ($packageManualScript -notmatch [regex]::Escape($requiredPackageCommand)) {
    throw "package-manual.ps1 missing Windows-safe handoff command: $requiredPackageCommand"
  }
}

$verifyManualScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\verify-manual-install.ps1
if ($verifyManualScript -notmatch [regex]::Escape("npm.cmd run smoke:preflight")) {
  throw "verify-manual-install.ps1 must print npm.cmd run smoke:preflight"
}
if ($verifyManualScript -notmatch "Zotero 9\.0\.5") {
  throw "verify-manual-install.ps1 must name Zotero 9.0.5 expected runtime"
}
if ($verifyManualScript -notmatch "Install Add-on From File") {
  throw "verify-manual-install.ps1 must guide manual XPI install"
}
if ($verifyManualScript -notmatch "manual install status: ready") {
  throw "verify-manual-install.ps1 must report ready/pending status"
}
if ($verifyManualScript -notmatch "informational for manual/XPI installs") {
  throw "verify-manual-install.ps1 must treat rescan as informational for manual installs"
}

foreach ($handoffScriptPath in @(
  ".\scripts\package-manual.ps1",
  ".\scripts\verify-manual-install.ps1",
  ".\scripts\install-global.ps1",
  ".\scripts\runtime-status.ps1",
  ".\scripts\smoke-preflight.ps1"
)) {
  $handoffScript = Get-Content -Encoding UTF8 -Raw -LiteralPath $handoffScriptPath
  if ($handoffScript -match '\bnpm run\s+(?:check|build|package:manual|verify:manual|install:global|install:xpi|runtime:status|smoke:preflight|smoke:wait)\b') {
    throw "PowerShell handoff script must use npm.cmd run: $handoffScriptPath"
  }
}

$runtimeStatusScript = Get-Content -Encoding UTF8 -Raw -LiteralPath .\scripts\runtime-status.ps1
if ($runtimeStatusScript -notmatch "optionalMissingPayload") {
  throw "runtime status must report optional missing payload separately"
}
if ($runtimeStatusScript -notmatch 'expectedRuntime\s*=\s*"Zotero 9\.0\.5"') {
  throw "runtime status must report expected Zotero 9.0.5 runtime"
}
if ($runtimeStatusScript -notmatch "summary\s*=\s*\[ordered\]@\{") {
  throw "runtime status must include install summary block"
}
if ($runtimeStatusScript -notmatch "preferredHandoff") {
  throw "runtime status summary must include preferred handoff"
}
if ($runtimeStatusScript -notmatch "readyProfiles") {
  throw "runtime status summary must include ready profile count"
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
if ($preflightScript -notmatch "function\s+Test-XpiInstallValid") {
  throw "smoke preflight must accept a valid XPI install source"
}
if ($preflightScript -notmatch '!\$devProxyValid\s+-and\s+!\$xpiInstallValid\s+-and\s+!\$registered') {
  throw "smoke preflight must not reject a registered manual install only because source hints are incomplete"
}
if ($preflightScript -notmatch "Zotero 9\.0\.5") {
  throw "smoke preflight must name Zotero 9.0.5 as expected runtime"
}
if ($preflightScript -notmatch "strict_max_version") {
  throw "smoke preflight must validate strict_max_version expectations"
}
if ($preflightScript -notmatch 'needsRescan\s+-and\s+\$devProxyValid\s+-and\s+!\$registered') {
  throw "smoke preflight must only hard-fail rescan for unregistered development-proxy installs"
}
if ($preflightScript -notmatch "readyProfiles") {
  throw "smoke preflight must report ready profile count"
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
if ($installScript -notmatch "npm\.cmd run install:xpi") {
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
$toolbarEntry = [regex]::Match($mainJS, "function\s+onRenderToolbar\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+onCreateViewContextMenu")
if (!$toolbarEntry.Success) {
  throw "Reader toolbar render function block not found"
}
if ($toolbarEntry.Value -notmatch "const\s+updateQualityTooltips\s*=\s*\(\)\s*=>\s*\{[\s\S]*button\.title\s*=\s*buildToolbarActionTooltip\(`"Clip HTML`",\s*qualityKey\)[\s\S]*refreshAutoButtonState\(qualityKey\)") {
  throw "Reader toolbar tooltips must be built from selected quality metadata"
}
if ($toolbarEntry.Value -notmatch "select\.addEventListener\(`"change`"[\s\S]*updateQualityTooltips\(\)") {
  throw "Reader toolbar must refresh tooltips when quality selection changes"
}
if ($toolbarEntry.Value -notmatch "select\.addEventListener\(`"change`"[\s\S]*const\s+qualityKey\s*=\s*normalizeQualityKey\(select\.value\)[\s\S]*updateQualityTooltips\(\)[\s\S]*syncAutoRasterAvailability\(qualityKey\)") {
  throw "Reader toolbar quality changes must reapply auto-raster availability state"
}
if ($toolbarEntry.Value -notmatch "updateQualityTooltips\(\)[\s\S]*syncAutoRasterAvailability") {
  throw "Reader toolbar must initialize quality tooltips before auto-raster state update"
}
if ($toolbarEntry.Value -notmatch "if\s*\(\s*toolbarMode\s*!==\s*`"idle`"\s*\)[\s\S]*return;") {
  throw "Reader toolbar busy mode must keep quality and sibling controls locked"
}
if ($mainJS -notmatch "function\s+buildToolbarActionTooltip\s*\(\s*action\s*,\s*qualityKey\s*\)[\s\S]*getQualityLabelWithEstimate\(qualityKey\)") {
  throw "Toolbar tooltip helper must use quality label and estimate"
}
if ($mainJS -notmatch "function\s+getQualityLabelWithEstimate[\s\S]*formatQualityEstimateShort\(normalizedQualityKey\)") {
  throw "Quality tooltip labels must use dense short estimates"
}
if ($mainJS -notmatch "function\s+getQualityLabelWithEstimate\s*\(\s*qualityKey\s*\)[\s\S]*const\s+normalizedQualityKey\s*=\s*normalizeQualityKey\(qualityKey\)[\s\S]*formatQualityEstimateShort\(normalizedQualityKey\)") {
  throw "Toolbar quality label helper must normalize quality and include estimate"
}
if ($mainJS -match "Default:\s*Medium,\s*60-220 KB/image") {
  throw "Reader toolbar tooltip must not hardcode Medium quality"
}
$contextMenuEntry = [regex]::Match($mainJS, "function\s+onCreateViewContextMenu\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+startClipFromActiveReader")
if (!$contextMenuEntry.Success) {
  throw "Reader context menu function block not found"
}
if ($contextMenuEntry.Value -notmatch "const\s+defaultQualityKey\s*=\s*getDefaultQualityKey\(\);\s*\r?\n\s*const\s+defaultQuality\s*=\s*QUALITY\[defaultQualityKey\]") {
  throw "Context menu must compute one normalized default quality"
}
if ($contextMenuEntry.Value -notmatch "function\s+buildContextMenuActions\s*\(\s*reader\s*,\s*params\s*,\s*commands\s*=\s*\{\s*\}\s*\)") {
  throw "Context menu actions must be built by a testable helper"
}
if ($contextMenuEntry.Value -notmatch "Auto \$\{defaultQuality\.label\};\s*\$\{formatQualityEstimateShort\(defaultQualityKey\)\}[\s\S]*qualityKey:\s*defaultQualityKey") {
  throw "Context menu auto-raster action must show and use the default quality estimate"
}
if ($contextMenuEntry.Value -notmatch "Page \$\{defaultQuality\.label\};\s*\$\{formatQualityEstimateShort\(defaultQualityKey\)\}[\s\S]*qualityKey:\s*defaultQualityKey") {
  throw "Context menu page-preview action must show and use the default quality estimate"
}
if ($contextMenuEntry.Value -notmatch "pageOriginalMaxImages\s*=\s*getHelperMaxImages\(`"page`"\)[\s\S]*documentOriginalMaxImages\s*=\s*getHelperMaxImages\(`"document`"\)") {
  throw "Context menu original actions must compute page and document image caps"
}
if ($contextMenuEntry.Value -notmatch "Orig page; max \$\{pageOriginalMaxImages\}[\s\S]*scope:\s*`"page`"[\s\S]*pageIndex:\s*getContextPageIndex\(params\)") {
  throw "Context menu page-original action must show cap and pass page scope"
}
if ($contextMenuEntry.Value -notmatch "Orig doc; max \$\{documentOriginalMaxImages\}[\s\S]*scope:\s*`"document`"") {
  throw "Context menu whole-PDF original action must show cap and pass document scope"
}
if ($contextMenuEntry.Value -match "Save whole page; Medium|qualityKey:\s*`"medium`"") {
  throw "Context menu page-preview action must not hardcode Medium quality"
}
$autoRasterStateEntry = [regex]::Match($mainJS, "async\s+function\s+updateAutoRasterButtonState\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+applyAutoRasterButtonState")
if (!$autoRasterStateEntry.Success) {
  throw "Auto-raster button state updater function block not found"
}
if ($autoRasterStateEntry.Value -notmatch "qualityKey\s*=\s*`"medium`"") {
  throw "Auto-raster state updater must accept a quality key fallback"
}
if ($autoRasterStateEntry.Value -notmatch "applyAutoRasterButtonState\(button,\s*supportsPDFJSImageCoordinates\(pdfPage\),\s*qualityKey\)") {
  throw "Auto-raster state updater must apply both available and unavailable states"
}
$autoRasterApplyEntry = [regex]::Match($mainJS, "function\s+applyAutoRasterButtonState\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+supportsPDFJSImageCoordinates")
if (!$autoRasterApplyEntry.Success) {
  throw "Auto-raster button state apply helper function block not found"
}
if ($autoRasterApplyEntry.Value -notmatch "if\s*\(\s*isAvailable\s*\)[\s\S]*button\.disabled\s*=\s*false[\s\S]*buildToolbarActionTooltip\(`"Auto page`",\s*qualityKey\)") {
  throw "Auto-raster available state must re-enable button and restore quality tooltip"
}
if ($autoRasterApplyEntry.Value -notmatch "button\.disabled\s*=\s*true[\s\S]*Auto n/a; Use clip\.") {
  throw "Auto-raster unavailable state must disable button with fallback tooltip"
}
$imageCoordinateEntry = [regex]::Match($mainJS, "function\s+imageCoordinatesToCandidates\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+updateAutoRasterButtonState")
if (!$imageCoordinateEntry.Success) {
  throw "Auto-raster image-coordinate converter function block not found"
}
if ($imageCoordinateEntry.Value -notmatch "clipSelectionRect\([\s\S]*canvasRect\.left\s*-\s*pageRect\.left[\s\S]*minX\s*\*\s*canvasRect\.width[\s\S]*minY\s*\*\s*canvasRect\.height") {
  throw "Auto-raster image-coordinate converter must map normalized coordinates to page-relative selection rectangles"
}
if ($imageCoordinateEntry.Value -notmatch "selectionRect\.width\s*<\s*12[\s\S]*selectionRect\.height\s*<\s*12[\s\S]*area\s*<\s*minArea") {
  throw "Auto-raster image-coordinate converter must filter tiny candidates"
}
if ($imageCoordinateEntry.Value -notmatch "dedupeImageCandidates\(candidates\)[\s\S]*\.sort\(\(left,\s*right\)\s*=>\s*right\.area\s*-\s*left\.area\)[\s\S]*\.slice\(0,\s*maxCount\)") {
  throw "Auto-raster image-coordinate converter must dedupe, sort largest-first, and cap candidates"
}
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
$helperExtractionEntry = [regex]::Match($mainJS, "async\s+function\s+runHelperExtraction\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+ensureHelperScriptPath")
if (!$helperExtractionEntry.Success) {
  throw "Optional helper extraction function block not found"
}
if ($helperExtractionEntry.Value -notmatch "const\s+pythonCommands\s*=\s*await\s+getPythonCommands\(\);[\s\S]*if\s*\(\s*!pythonCommands\.length\s*\)[\s\S]*output_dir:\s*null[\s\S]*const\s+helperScriptPath\s*=\s*await\s+ensureHelperScriptPath\(\);[\s\S]*const\s+outputDir\s*=\s*await\s+createTempDirectory\(\)") {
  throw "Optional helper must validate Python and bundled helper script before creating temp output"
}
if ($helperExtractionEntry.Value -match "const\s+outputDir\s*=\s*await\s+createTempDirectory\(\);\s*\r?\n\s*const\s+reportPath\s*=\s*PathUtils\.join\(outputDir,\s*`"report\.json`"\);\s*\r?\n\s*const\s+pythonCommands\s*=") {
  throw "Optional helper must not create temp output before Python discovery"
}
$helperMaxCallCount = ([regex]::Matches($mainJS, "getHelperMaxImages\(")).Count
if ($helperMaxCallCount -lt 3) {
  throw "Confirmation text and helper args must call getHelperMaxImages()"
}
if ($mainJS -notmatch "function\s+limitOriginalImagesForImport\s*\(\s*report\s*,\s*scope\s*\)") {
  throw "Original image import must use an import-side image limit helper"
}
if ($mainJS -notmatch "const\s+normalized\s*=\s*normalizeOriginalImagesForImport\(report\)[\s\S]*const\s+deduped\s*=\s*filterDuplicateOriginalImagesForImport\(normalized,\s*attachment,\s*existingOriginalKeys\)[\s\S]*const\s+limited\s*=\s*limitNormalizedOriginalImagesForImport\(deduped,\s*scope\)[\s\S]*const\s+prepared\s*=\s*await\s+filterExistingOriginalImagesForImport\(limited\)") {
  throw "Original image import path must normalize, dedupe, apply max caps, then filter files and bytes"
}
if ($mainJS -match "for\s*\(\s*const\s+image\s+of\s+report\.images\s*\)") {
  throw "Original image import must not iterate raw helper report images"
}
if ($mainJS -notmatch "images:\s*images\.slice\(0,\s*maxImages\)") {
  throw "Original image import limiter must truncate images to maxImages"
}
if ($mainJS -notmatch "const\s+normalized\s*=\s*normalizeOriginalImageForImport\(image,\s*index,\s*report\?\.output_dir\)") {
  throw "Original image import limiter must normalize helper image records"
}
if ($mainJS -notmatch "function\s+filterDuplicateOriginalImagesForImport\s*\(\s*normalized,\s*attachment,\s*existingOriginalKeys\s*\)") {
  throw "Original image import must have a pre-cap duplicate filter"
}
if ($mainJS -notmatch "function\s+limitNormalizedOriginalImagesForImport\s*\(\s*normalized,\s*scope\s*\)") {
  throw "Original image import must cap deduped normalized images"
}
if ($mainJS -notmatch "function\s+normalizeOriginalImageForImport\s*\(\s*image,\s*index,\s*outputDir\s*\)") {
  throw "Original helper image record normalizer missing"
}
if ($mainJS -notmatch "function\s+normalizeHelperFilePath\s*\(\s*value,\s*outputDir\s*\)") {
  throw "Original helper file path normalizer missing"
}
if ($mainJS -notmatch "function\s+isPluginTempChildDirectory\s*\(\s*path\s*\)") {
  throw "Recursive cleanup temp-boundary guard missing"
}
$removeDirectoryEntry = [regex]::Match($mainJS, "async\s+function\s+removeDirectoryIfExists\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+isPluginTempChildDirectory")
if (!$removeDirectoryEntry.Success) {
  throw "Recursive directory cleanup function block not found"
}
if ($removeDirectoryEntry.Value -notmatch "!isPluginTempChildDirectory\(path\)[\s\S]*return[\s\S]*IOUtils\.remove\(path,\s*\{\s*recursive:\s*true,\s*ignoreAbsent:\s*true\s*\}\)") {
  throw "Recursive directory cleanup must guard paths before IOUtils.remove"
}
$tempGuardEntry = [regex]::Match($mainJS, "function\s+isPluginTempChildDirectory\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+removeFileIfExists")
if (!$tempGuardEntry.Success) {
  throw "Recursive cleanup temp-boundary guard function block not found"
}
if ($tempGuardEntry.Value -notmatch "normalizePathForComparison\(path\)[\s\S]*normalizePathForComparison\(PathUtils\.join\(PathUtils\.tempDir,\s*ADDON_REF\)\)[\s\S]*tempRootPrefix[\s\S]*normalizedPath\.startsWith\(tempRootPrefix\)[\s\S]*normalizedPath\.length\s*>\s*tempRootPrefix\.length") {
  throw "Recursive cleanup guard must require a normalized plugin temp child path"
}
if ($mainJS -notmatch "function\s+normalizeImageContentType\s*\(\s*value,\s*extension\s*\)") {
  throw "Original helper content type normalizer missing"
}
if ($mainJS -notmatch "file:\s*image\.filePath") {
  throw "Original image import must use normalized filePath"
}
if ($mainJS -match "file:\s*image\.file_path") {
  throw "Original image import must not use raw helper file_path"
}
if ($mainJS -notmatch "contentType:\s*image\.contentType") {
  throw "Original image import must use normalized contentType"
}
if ($mainJS -match "contentType:\s*image\.content_type") {
  throw "Original image import must not use raw helper content_type"
}
if ($mainJS -notmatch "invalidCount:\s*prepared\.invalidCount") {
  throw "Original image import result must expose malformed helper record count"
}
if ($mainJS -notmatch "overCapCount:\s*prepared\.overCapCount") {
  throw "Original image import result must expose over-cap helper record count"
}
if ($mainJS -notmatch "const\s+prepared\s*=\s*await\s+filterExistingOriginalImagesForImport\(limited\)") {
  throw "Original image import must filter missing helper files before Zotero import"
}
if ($mainJS -notmatch "const\s+importableImages\s*=\s*prepared\.images[\s\S]*for\s*\(\s*const\s+image\s+of\s+importableImages\s*\)") {
  throw "Original image import must iterate existence-filtered images"
}
if ($mainJS -match "for\s*\(\s*const\s+image\s+of\s+limited\.images\s*\)") {
  throw "Original image import must not iterate image records before existence filtering"
}
if ($mainJS -notmatch "function\s+filterExistingOriginalImagesForImport\s*\(\s*limited\s*\)") {
  throw "Original image import missing helper file existence filter"
}
if ($mainJS -notmatch "const\s+status\s*=\s*await\s+getHelperImageFileStatus\(image\.filePath\)") {
  throw "Original image existence filter must check each normalized helper file path"
}
if ($mainJS -notmatch "omittedCount:\s*\(limited\.omittedCount\s*\|\|\s*0\)\s*\+\s*missingCount\s*\+\s*errorCount\s*\+\s*byteCapCount") {
  throw "Original image existence filter must add byte-cap skips to omission count"
}
if ($mainJS -notmatch "missingCount:\s*prepared\.missingCount") {
  throw "Original image import result must expose missing helper file count"
}
if ($mainJS -notmatch "errorCount:\s*prepared\.errorCount") {
  throw "Original image import result must expose helper file existence-check error count"
}
if ($mainJS -notmatch "let\s+importErrorCount\s*=\s*0") {
  throw "Original image import must count per-image Zotero import failures"
}
if ($mainJS -notmatch "importErrorCount\s*\+=\s*1") {
  throw "Original image import must increment per-image Zotero import failures"
}
if ($mainJS -notmatch "importErrorCount:\s*importErrorCount") {
  throw "Original image import result must expose Zotero import failure count"
}
if ($mainJS -notmatch "let\s+indexErrorCount\s*=\s*0") {
  throw "Original image import must track HTML index creation failures separately"
}
if ($mainJS -notmatch "catch\s*\(\s*error\s*\)\s*\{\s*\r?\n\s*indexErrorCount\s*\+=\s*1;\s*\r?\n\s*logError\(error\);") {
  throw "Original image HTML index failures must be caught and logged separately"
}
if ($mainJS -notmatch "indexErrorCount:\s*indexErrorCount") {
  throw "Original image import result must expose HTML index failure count"
}
if ($mainJS -notmatch "importResult\.omittedCount\s*\|\|\s*importResult\.indexErrorCount") {
  throw "Original-image save feedback must warn on HTML index failure even when images import"
}
if ($mainJS -notmatch "omittedCount:\s*prepared\.omittedCount\s*\+\s*duplicateCount\s*\+\s*importErrorCount") {
  throw "Original image import result must add duplicate skips and Zotero import failures to omission count"
}
if ($mainJS -notmatch "\$\{importResult\.importErrorCount\}\s+import fail") {
  throw "Original helper import toast must expose failed Zotero imports separately"
}
if ($mainJS -notmatch "index fail") {
  throw "Original helper import toast must expose HTML index metadata failure"
}
if ($mainJS -notmatch "try\s*\{\s*\r?\n\s*await\s+Zotero\.Attachments\.importFromFile") {
  throw "Original image import must isolate each Zotero import call"
}
if ($mainJS -notmatch "importableImages\.length\s*&&\s*!count\s*&&\s*importErrorCount\s*===\s*importableImages\.length") {
  throw "Original image import must detect all attempted Zotero imports failing"
}
if ($mainJS -notmatch "Storage failed: all\s+\$\{importErrorCount\}\s+orig imports failed") {
  throw "Original image import must throw a clear all-imports-failed error"
}
if ($mainJS -notmatch "const\s+ORIGINAL_MAX_IMAGE_BYTES\s*=\s*25\s*\*\s*1024\s*\*\s*1024") {
  throw "Original image import must define a per-image byte safety cap"
}
if ($mainJS -notmatch "const\s+ORIGINAL_MAX_TOTAL_BYTES\s*=\s*150\s*\*\s*1024\s*\*\s*1024") {
  throw "Original image import must define a total byte safety cap"
}
if ($mainJS -notmatch "IOUtils\.stat\(filePath\)") {
  throw "Original image import must stat helper output files before Zotero import"
}
if ($mainJS -notmatch "byteCount\s*>\s*ORIGINAL_MAX_IMAGE_BYTES\s*\|\|\s*totalBytes\s*\+\s*byteCount\s*>\s*ORIGINAL_MAX_TOTAL_BYTES") {
  throw "Original image import must enforce per-file and total byte caps"
}
if ($mainJS -notmatch "byteCapCount:\s*prepared\.byteCapCount") {
  throw "Original image import result must expose byte-cap skip count"
}
if ($mainJS -notmatch "\$\{importResult\.byteCapCount\}\s+byte cap") {
  throw "Original helper import toast must expose byte-cap skips"
}
if ($mainJS -notmatch "const\s+existingOriginalKeys\s*=\s*await\s+getExistingOriginalImageKeys\(parentItem,\s*attachment\)") {
  throw "Original image import must scan existing original-image keys before import"
}
if ($mainJS -notmatch "keySet\.has\(image\.originalImageKey\)") {
  throw "Original image import must skip duplicate original-image keys"
}
if ($mainJS -notmatch "duplicateCount\s*\+=\s*1") {
  throw "Original image import must count duplicate original-image skips"
}
if ($mainJS -notmatch 'const\s+weakIdentity\s*=\s*xref\s*>\s*0\s*\?\s*`xref\$\{xref\}`\s*:\s*`occurrence\$\{occurrence\}`') {
  throw "Original image weak identity fallback must include occurrence"
}
if ($mainJS -notmatch "async\s+function\s+createOriginalImageIndexAttachment") {
  throw "Original image import must create a synced HTML original-image index helper"
}
if ($mainJS -notmatch "await\s+createOriginalImageIndexAttachment\(\s*\{[\s\S]*images:\s*importedImages") {
  throw "Original image import must create an index for successfully imported originals"
}
if ($mainJS -notmatch "function\s+buildOriginalImageIndexHTML") {
  throw "Original image import missing HTML index builder"
}
if ($mainJS -notmatch 'storage_mode:\s*"original_image_index"') {
  throw "Original image index metadata must use original_image_index storage mode"
}
if ($mainJS -notmatch "Open p\$\{escapeHTML\(String\(image\.page_number\)\)\}") {
  throw "Original image index HTML must expose explicit Open actions with page"
}
if ($mainJS -notmatch "open PDF page links") {
  throw "Original image index HTML must densify open-PDF header text"
}
if ($mainJS -notmatch "original_image_key:\s*originalImageKey") {
  throw "Original image index metadata must include stable original_image_key values"
}
if ($mainJS -notmatch "open_pdf_uri:\s*buildOpenPDFURI\(attachment,\s*image\?\.pageNumber\s*\?\?\s*image\?\.page_number\)") {
  throw "Original image index metadata must include source PDF links"
}
if ($mainJS -notmatch "readOriginalImageIndexMetadataFromAttachment") {
  throw "Original image duplicate scanner must read original-image index metadata"
}
if ($mainJS -notmatch "collectStandaloneOriginalImageKeys\(keys,\s*attachment\)") {
  throw "Original image duplicate scanner must fall back to standalone same-library scanning"
}
if ($mainJS -notmatch "Zotero\.Items\?\.getAll") {
  throw "Standalone original image duplicate scanner must use guarded same-library item scanning"
}
if ($mainJS -notmatch "metadata\.storage_mode\s*===\s*`"original_image_index`"") {
  throw "Original image duplicate scanner must validate original_image_index storage mode"
}
if ($mainJS -notmatch "formatBytes\(ORIGINAL_MAX_IMAGE_BYTES\)[\s\S]*formatBytes\(ORIGINAL_MAX_TOTAL_BYTES\)") {
  throw "Original extraction confirmation must include byte-cap risk text"
}
if ($mainJS -notmatch "if\s*\(\s*!report\.images\?\.length\s*\)\s*\{\s*\r?\n\s*await\s+removeDirectoryIfExists\(report\.output_dir\)") {
  throw "Original-image save entry must clean helper output immediately when helper returns zero images"
}
if ($mainJS -match "\(\s*report\.warnings\s*\|\|\s*\[\]\s*\)\.join") {
  throw "Helper failure formatter must not join raw report warnings"
}
if ($mainJS -notmatch "const\s+details\s*=\s*normalizeHelperWarningMessages\(report\?\.warnings\)\.join") {
  throw "Helper failure formatter must normalize warning details"
}
if ($mainJS -notmatch "const\s+status\s*=\s*normalizeHelperStatusText\(report\?\.status\)") {
  throw "Helper failure formatter must normalize status text"
}
if ($mainJS -match "function\s+formatHelperFailure\s*\(\s*report\s*\)\s*\{[\s\S]{0,700}if\s*\(\s*report\.status\s*===") {
  throw "Helper failure formatter must not branch on raw report.status"
}
if ($mainJS -notmatch "if\s*\(\s*status\s*===\s*`"missing_pymupdf`"\s*\)") {
  throw "Helper failure formatter must branch on normalized missing_pymupdf status"
}
if ($mainJS -notmatch "if\s*\(\s*status\s*===\s*`"no_python`"\s*\)") {
  throw "Helper failure formatter must branch on normalized no_python status"
}
if ($mainJS -notmatch "function\s+normalizeHelperStatusText\s*\(\s*status\s*\)") {
  throw "Helper status normalizer missing"
}
if ($mainJS -notmatch "normalizeMetadataText\(status,\s*`"unknown`",\s*60\)") {
  throw "Helper status normalizer must cap status text"
}
if ($mainJS -match "report\.status\s*\|\|\s*`"unknown`"") {
  throw "Helper failure aggregation must not use raw report.status fallback"
}
if ($mainJS -notmatch "normalizeHelperStatusText\(report\.status\)") {
  throw "Helper candidate failure aggregation must normalize report.status"
}
if ($mainJS -match "\.\.\.\(missingPyMuPDFReport\.warnings\s*\|\|\s*\[\]\)") {
  throw "Missing-PyMuPDF warning aggregation must not spread raw warnings"
}
if ($mainJS -notmatch "\.\.\.normalizeHelperWarningMessages\(missingPyMuPDFReport\.warnings\)") {
  throw "Missing-PyMuPDF warning aggregation must normalize existing warnings"
}
if ($mainJS -match "Unexpected helper schema:\s*\$\{report\.schema_version\}") {
  throw "Helper schema mismatch errors must not interpolate raw schema_version"
}
if ($mainJS -notmatch "Helper failed: bad schema\s*\$\{normalizeHelperSchemaText\(report\.schema_version\)\}") {
  throw "Helper schema mismatch errors must normalize schema_version"
}
if ($mainJS -notmatch "function\s+normalizeHelperSchemaText\s*\(\s*schemaVersion\s*\)") {
  throw "Helper schema normalizer missing"
}
if ($mainJS -notmatch "normalizeMetadataText\(schemaVersion,\s*`"unknown`",\s*80\)") {
  throw "Helper schema normalizer must cap schema text"
}
if ($mainJS -notmatch "function\s+normalizeHelperWarningMessages\s*\(\s*warnings\s*\)") {
  throw "Helper warning normalizer missing"
}
if ($mainJS -notmatch "normalizeMetadataText\(warning,\s*null,\s*180\)") {
  throw "Helper warning normalizer must cap warning text length"
}
if ($mainJS -notmatch "normalized\.length\s*>=\s*4") {
  throw "Helper warning normalizer must cap warning detail count"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*formatHelperFailure") {
  throw "Helper failure formatter must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*formatDiagnosticsReport") {
  throw "Diagnostics formatter must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*getErrorMessage") {
  throw "Error message helper must remain exported for regression tests"
}
if ($mainJS -notmatch "function\s+classifyErrorCategory\s*\(") {
  throw "Error category classifier missing"
}
if ($mainJS -notmatch "function\s+formatUserFacingError\s*\(") {
  throw "User-facing error formatter missing"
}
if ($mainJS -notmatch "showReaderToast\(reader,\s*formatUserFacingError\(error\),\s*`"error`"\)") {
  throw "Reader error toasts must use classified user-facing errors"
}
if ($mainJS -notmatch "Byte cap: index large") {
  throw "Byte-cap preview index failure must stay labeled"
}
if ($mainJS -notmatch "Storage failed: index import failed") {
  throw "Preview index import failures must be labeled as storage errors"
}

if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildToolbarActionTooltip") {
  throw "Toolbar tooltip helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*imageCoordinatesToCandidates") {
  throw "Auto-raster image-coordinate converter must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*applyAutoRasterButtonState") {
  throw "Auto-raster button state helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildContextMenuActions") {
  throw "Reader context menu action helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*onCreateViewContextMenu") {
  throw "Reader context menu handler must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*onRenderToolbar") {
  throw "Reader toolbar render handler must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*saveAutoDetectedPageImagePreviews") {
  throw "Auto-raster save entry must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*saveClipPreviewIndex") {
  throw "Clip-preview save entry must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*saveOriginalImagesFromReader") {
  throw "Original-image save entry must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*confirmAndSaveOriginalImagesFromReader") {
  throw "Original-image confirmation entry must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*savePagePreviewIndex") {
  throw "Page-preview save entry must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*getReaderJobKey") {
  throw "Reader job key helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*getPreviewDuplicateKey") {
  throw "Preview duplicate key helper must remain exported for regression tests"
}
foreach ($requiredIndexExport in @(
  "getPreviewIndexKey",
  "getPreviewIndexFingerprint",
  "getSourceRegionKey",
  "hasExistingPreviewIndexAttachment",
  "isDuplicatePreviewIndexSave"
)) {
  if ($mainJS -notmatch "__test__:\s*\{[\s\S]*$requiredIndexExport") {
    throw "Preview index helper must remain exported for regression tests: $requiredIndexExport"
  }
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*renderCanvasPreview") {
  throw "Canvas preview renderer must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*prepareSelectionOverlayHost") {
  throw "Selection overlay host helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*cleanupSelectionOverlay") {
  throw "Selection overlay cleanup helper must remain exported for regression tests"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*showReaderToast") {
  throw "Reader toast helper must remain exported for regression tests"
}
if ($mainJS -notmatch "omittedCount:\s*\(limited\.omittedCount\s*\|\|\s*0\)\s*\+\s*missingCount\s*\+\s*errorCount") {
  throw "Original image existence filter must add missing and unreadable files to omission count"
}
if ($mainJS -notmatch "function\s+getHelperImageFileStatus\s*\(\s*filePath\s*\)") {
  throw "Original helper file status checker missing"
}
if ($mainJS -notmatch "IOUtils\.exists\(filePath\)") {
  throw "Original helper file existence checker must use IOUtils.exists"
}
if ($mainJS -notmatch "error:\s*true") {
  throw "Original helper file status checker must expose IO errors separately"
}
if ($mainJS -notmatch "\$\{importResult\.errorCount\}\s+unread") {
  throw "Original helper import toast must expose unreadable helper files separately"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*importOriginalImages") {
  throw "Original image import must remain exported for behavior regression tests"
}
if ($mainJS -notmatch "return\s+normalizedFile\.startsWith\(outputPrefix\)\s*\?\s*filePath\s*:\s*null") {
  throw "Original helper file paths must stay under the helper output directory"
}
if ($mainJS -notmatch "if\s*\(\s*!outputPath\s*\)\s*\{\s*\r?\n\s*return\s+null;") {
  throw "Original helper file paths must require a helper output directory"
}
if ($mainJS -notmatch 'part\s*===\s*"\.\."[\s\S]*parts\.pop\(\)') {
  throw "Original helper path comparison must resolve parent-directory segments"
}
if ($mainJS -notmatch 'part\s*===\s*"\."') {
  throw "Original helper path comparison must resolve current-directory segments"
}
if ($mainJS -notmatch 'const\s+uncMatch\s*=\s*rawText\.match\(/') {
  throw "Original helper path comparison must preserve UNC path roots"
}
if ($mainJS -notmatch 'rootPrefix\s*=\s*`//\$\{uncMatch\[1\]\}/\$\{uncMatch\[2\]\}/`') {
  throw "Original helper path comparison must include UNC server and share in the root prefix"
}
if ($mainJS -notmatch "const\s+base\s*=\s*sanitizeTitle\(getSourceTitle\(parentItem,\s*attachment\)\)") {
  throw "Original image title must use normalized source title"
}
if ($mainJS -notmatch "const\s+pageNumber\s*=\s*normalizePageNumber\(image\?\.pageNumber\s*\?\?\s*image\?\.page_number,\s*1\)") {
  throw "Original image title must normalize page number"
}
if ($mainJS -notmatch "const\s+occurrence\s*=\s*normalizePositiveInteger\(image\?\.occurrence,\s*1\)") {
  throw "Original image title must normalize occurrence"
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
if ($mainJS -match "getLibraryPrefix") {
  throw "open-pdf URI builder must not use Zotero API library prefixes"
}
if ($mainJS -notmatch "const\s+page\s*=\s*normalizePageNumber\(pageNumber,\s*1\)") {
  throw "open-pdf URI builder must normalize page numbers"
}
if ($mainJS -notmatch "const\s+itemKey\s*=\s*normalizeItemKey\(attachment\.key,\s*`"UNKNOWN`"\)") {
  throw "open-pdf URI builder must normalize attachment keys"
}
if ($mainJS -match 'items/\$\{attachment\.key\}') {
  throw "open-pdf URI builder must not write raw attachment keys"
}
if ($mainJS -notmatch "annotation=\$\{encodeURIComponent\(normalizedAnnotationKey\)\}") {
  throw "open-pdf URI builder must append encoded annotation parameter"
}
if ($mainJS -match "pdfImageSaverRegion") {
  throw "open-pdf URI builder must not emit unsupported custom Zotero query parameters"
}
if ($mainJS -notmatch "source_region:\s*entry\.sourceRegion") {
  throw "metadata must include source_region"
}
if ($mainJS -notmatch "source_region_key:\s*entry\.sourceRegionKey") {
  throw "metadata must include source_region_key"
}
if ($mainJS -notmatch "preview_duplicate_key:\s*entry\.previewDuplicateKey") {
  throw "metadata must include preview_duplicate_key"
}
if ($mainJS -notmatch "preview_index_key:\s*previewIndexKey") {
  throw "metadata must include preview_index_key"
}
if ($mainJS -notmatch "preview_index_fingerprint:\s*getPreviewIndexFingerprint\(previewIndexKey\)") {
  throw "metadata must include preview_index_fingerprint"
}
if ($mainJS -notmatch "entry\.previewDuplicateKey\s*=\s*getPreviewDuplicateKey\(attachment,\s*entry\)") {
  throw "HTML preview entries must persist normalized duplicate keys"
}
if ($mainJS -notmatch "<details>[\s\S]*<summary>Meta</summary>[\s\S]*<pre>\$\{escapeHTML\(JSON\.stringify\(metadata,\s*null,\s*2\)\)\}</pre>[\s\S]*</details>") {
  throw "HTML preview metadata JSON must be collapsed in a details block"
}
if ($mainJS -match "<details\s+open") {
  throw "HTML preview metadata details must not be open by default"
}
if ($mainJS -notmatch "Index\s+\$\{escapeHTML\(getPreviewIndexFingerprint\(previewIndexKey\)\s*\|\|\s*`"unknown`"\)") {
  throw "HTML preview header must expose compact index fingerprint"
}
if ($mainJS -notmatch "Open p\$\{escapeHTML\(String\(entry\.pageNumber\)\)\}") {
  throw "HTML preview entries must expose a visible source PDF action with page"
}
if ($mainJS -notmatch 'title="\$\{escapeHTML\(entry\.sourceRegionKey\)\}"') {
  throw "HTML preview compact region identity must retain full source key in title"
}
if ($mainJS -notmatch "const\s+regionIdentity\s*=\s*getSourceRegionFingerprint\(entry\.sourceRegionKey\)") {
  throw "HTML preview entries must show compact source region identity"
}
if ($mainJS -notmatch '<details class="entry-details">[\s\S]*<summary>Trace</summary>[\s\S]*<dt>Det</dt>[\s\S]*<dt>Box</dt>[\s\S]*<dt>Key</dt>') {
  throw "HTML preview entry technical fields must be collapsed in per-entry details"
}
if ($mainJS -notmatch 'data-source-region-key="\$\{escapeHTML\(entry\.sourceRegionKey\)\}"') {
  throw "HTML preview links must carry source region keys"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildIndexHTML") {
  throw "buildIndexHTML must remain exported for regression tests"
}
if ($mainJS -notmatch "function\s+normalizePreviewEntries\s*\(\s*entries\s*\)") {
  throw "HTML preview entry-list normalizer missing"
}
if ($mainJS -notmatch "Preview index bad") {
  throw "HTML preview non-array entry lists must fail clearly"
}
if ($mainJS -notmatch "Preview index empty") {
  throw "HTML preview empty entry lists must fail clearly"
}
if ($mainJS -notmatch "const\s+normalizedEntries\s*=\s*normalizePreviewEntries\(entries\)") {
  throw "HTML preview entries must be normalized before field mutation"
}
if ($mainJS -notmatch "const\s+entriesHTML\s*=\s*normalizedEntries\s*\r?\n\s*\.map") {
  throw "HTML preview HTML output must use normalized entries"
}
if ($mainJS -notmatch "entries:\s*normalizedEntries\.map") {
  throw "HTML preview metadata output must use normalized entries"
}
if ($mainJS -match "const\s+entriesHTML\s*=\s*entries\s*\r?\n\s*\.map") {
  throw "HTML preview HTML output must not use raw entries.map"
}
if ($mainJS -match "entries:\s*entries\.map") {
  throw "HTML preview metadata output must not use raw entries.map"
}
if ($mainJS -notmatch "entry\s+&&\s+typeof\s+entry\s+===\s+`"object`"\s+&&\s+!Array\.isArray\(entry\)") {
  throw "HTML preview entry normalizer must convert non-object entries before mutation"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildIndexTitle") {
  throw "buildIndexTitle must remain exported for regression tests"
}
if ($mainJS -notmatch "function\s+buildIndexTitle\s*\(\s*parentItem,\s*attachment,\s*scope,\s*pageIndex,\s*entries\s*=\s*\[\],\s*qualityKey\s*=\s*null,\s*indexKey\s*=\s*null\s*\)") {
  throw "Index title must accept entries, quality, and index key for concise identity"
}

if ($mainJS -notmatch "const\s+qualityLabel\s*=\s*normalizedQuality\s*\?\s*QUALITY\[normalizedQuality\]\.label\s*:\s*null") {
  throw "buildIndexTitle must densify quality labels"
}
if ($mainJS -notmatch 'entryCount\s*\?\s*`\$\{entryCount\}img`') {
  throw "Index title must include image count when available"
}
if ($mainJS -notmatch "getPreviewIndexFingerprint\(normalizedIndexKey\)") {
  throw "Index title must include a short preview index fingerprint"
}
if ($mainJS -notmatch "const\s+sourceTitle\s*=\s*getSourceTitle\(parentItem,\s*attachment\)") {
  throw "HTML preview source title must be normalized"
}
if ($mainJS -notmatch "const\s+normalizedScope\s*=\s*normalizeScope\(scope\)") {
  throw "HTML preview scope must be normalized before metadata output"
}
if ($mainJS -notmatch "scope:\s*normalizedScope") {
  throw "HTML preview metadata must use normalized scope"
}
if ($mainJS -notmatch "function\s+serializeItem\s*\(\s*item\s*\)[\s\S]*key:\s*normalizeMetadataText\(item\.key,\s*null\)[\s\S]*title:\s*normalizeMetadataText\(getItemField\(item,\s*`"title`"\),\s*null\)[\s\S]*date:\s*normalizeMetadataText\(getItemField\(item,\s*`"date`"\),\s*null\)[\s\S]*doi:\s*normalizeMetadataText\(getItemField\(item,\s*`"DOI`"\),\s*null\)") {
  throw "Parent item metadata must normalize key, title, date, and DOI"
}
if ($mainJS -notmatch "function\s+serializeAttachment\s*\(\s*item\s*\)[\s\S]*key:\s*normalizeMetadataText\(item\?\.key,\s*null\)[\s\S]*title:\s*normalizeMetadataText\(getItemField\(item,\s*`"title`"\),\s*null\)[\s\S]*content_type:\s*normalizeMetadataText\(item\?\.attachmentContentType,\s*null\)") {
  throw "Attachment metadata must normalize key, title, and content type"
}
if ($mainJS -notmatch "function\s+normalizeMetadataText\s*\(") {
  throw "Source metadata text normalizer missing"
}
if ($mainJS -notmatch "function\s+normalizeScope\s*\(") {
  throw "Scope normalizer missing"
}
if ($mainJS -notmatch "function\s+normalizePreviewDataURL\s*\(\s*value\s*\)") {
  throw "HTML preview index must validate preview data URLs"
}
if ($mainJS -notmatch "const\s+match\s*=\s*text\.match\(\s*/\^data:image") {
  throw "HTML preview data URL validation must capture the base64 payload"
}
if ($mainJS -notmatch "match\?\.\[1\]\?\.length\s*%\s*4\s*===\s*0") {
  throw "HTML preview data URL validation must reject non-canonical base64 lengths"
}
if ($mainJS -notmatch "entry\.dataURL\s*=\s*normalizePreviewDataURL\(entry\.dataURL\)") {
  throw "HTML preview index must normalize entry data URLs before output"
}
if ($mainJS -match '<img src="\$\{entry\.dataURL\}"') {
  throw "HTML preview image src must not write raw entry.dataURL"
}
if ($mainJS -notmatch '<img src="\$\{escapeHTML\(entry\.dataURL\)\}"') {
  throw "HTML preview image src must escape normalized data URLs"
}
if ($mainJS -notmatch "entry\.quality\s*=\s*normalizeQualityKey\(entry\.quality\)") {
  throw "HTML preview entries must normalize quality before output"
}
if ($mainJS -notmatch "Object\.prototype\.hasOwnProperty\.call\(QUALITY,\s*value\)") {
  throw "Quality normalization must accept only own QUALITY keys"
}
if ($mainJS -notmatch "entry\.qualityEstimate\s*=\s*QUALITY\[entry\.quality\]\.estimate") {
  throw "HTML preview entries must normalize quality estimates"
}
if ($mainJS -notmatch "quality_estimate:\s*entry\.qualityEstimate") {
  throw "HTML preview metadata must include normalized quality_estimate"
}
if ($mainJS -notmatch "entry\.id\s*=\s*normalizePreviewText\(entry\.id,\s*fallbackID\)") {
  throw "HTML preview entries must normalize IDs before metadata output"
}
if ($mainJS -notmatch 'entry\.mode\s*=\s*normalizePreviewText\(entry\.mode,\s*"reader_canvas_preview"\)') {
  throw "HTML preview entries must normalize mode before metadata output"
}
if ($mainJS -notmatch 'entry\.detector\s*=\s*normalizePreviewText\(entry\.detector,\s*"unknown"\)') {
  throw "HTML preview entries must normalize detector before metadata output"
}
if ($mainJS -notmatch "entry\.pageLabel\s*=\s*normalizePreviewText\(entry\.pageLabel,\s*null\)") {
  throw "HTML preview entries must normalize page labels before output"
}
if ($mainJS -notmatch "entry\.byteCount\s*=\s*estimateDataURLBytes\(entry\.dataURL\)") {
  throw "HTML preview byte count must be recomputed from normalized data URL"
}
if ($mainJS -notmatch "entry\.renderedWidth\s*=\s*normalizePositiveInteger\(entry\.renderedWidth,\s*null\)") {
  throw "HTML preview rendered width must be normalized before output"
}
if ($mainJS -notmatch "entry\.renderedHeight\s*=\s*normalizePositiveInteger\(entry\.renderedHeight,\s*null\)") {
  throw "HTML preview rendered height must be normalized before output"
}
if ($mainJS -notmatch "entry\.detectionArea\s*=\s*normalizeUnitNumber\(entry\.detectionArea,\s*null\)") {
  throw "HTML preview detection area must be normalized before metadata output"
}
if ($mainJS -notmatch "function\s+normalizePreviewText\s*\(") {
  throw "HTML preview scalar text normalizer missing"
}
if ($mainJS -notmatch "function\s+normalizePositiveInteger\s*\(") {
  throw "HTML preview positive integer normalizer missing"
}
if ($mainJS -notmatch "number\s+===\s+null\s*\|\|\s*number\s+<\s*1") {
  throw "HTML preview positive integer normalizer must reject dimensions below one pixel"
}
if ($mainJS -notmatch "function\s+normalizeUnitNumber\s*\(") {
  throw "HTML preview unit number normalizer missing"
}
if ($mainJS -notmatch "const\s+padding\s*=\s*base64\.match\(/=\+\$/\)\?\.\[0\]\.length\s*\|\|\s*0") {
  throw "HTML preview byte estimator must count base64 padding"
}
if ($mainJS -notmatch "Math\.floor\(\(base64\.length\s*\*\s*3\)\s*/\s*4\)\s*-\s*padding") {
  throw "HTML preview byte estimator must subtract base64 padding"
}
if ($mainJS -notmatch "function\s+formatPreviewDimensions\s*\(") {
  throw "HTML preview dimension formatter missing"
}
if ($mainJS -notmatch "formatPreviewDimensions\(entry\.renderedWidth,\s*entry\.renderedHeight\)") {
  throw "HTML preview actual size must use normalized dimension formatter"
}
if ($mainJS -notmatch "const\s+pageTarget\s*=\s*normalizeEntryPageTarget\(entry\)") {
  throw "HTML preview entries must normalize page targets before URI and metadata output"
}
if ($mainJS -notmatch "entry\.pageIndex\s*=\s*pageTarget\.pageIndex") {
  throw "HTML preview metadata must use normalized page indexes"
}
if ($mainJS -notmatch "entry\.pageNumber\s*=\s*pageTarget\.pageNumber") {
  throw "HTML preview metadata must use normalized page numbers"
}
if ($mainJS -notmatch "const\s+previewQualityKey\s*=\s*normalizeQualityKey\(qualityKey\)") {
  throw "HTML preview request quality must be normalized before metadata output"
}
if ($mainJS -notmatch "preview_quality:\s*previewQualityKey") {
  throw "HTML preview metadata must use normalized request quality"
}
if ($mainJS -match "preview_quality:\s*qualityKey") {
  throw "HTML preview metadata must not write raw request quality"
}
if ($mainJS -notmatch "function\s+normalizeBBoxNormalized\s*\(\s*bboxNormalized\s*\)") {
  throw "HTML preview index must normalize bbox values"
}
if ($mainJS -notmatch "entry\.bboxNormalized\s*=\s*normalizeBBoxNormalized\(entry\.bboxNormalized\)") {
  throw "HTML preview entries must normalize bbox before output"
}
if ($mainJS -notmatch "entry\.sourceRegion\s*=\s*buildSourceRegion\(entry\.bboxNormalized\)") {
  throw "HTML preview source region must be rebuilt from normalized bbox"
}
if ($mainJS -match "entry\.sourceRegion\s*=\s*entry\.sourceRegion\s*\|\|") {
  throw "HTML preview source region must not preserve stale sourceRegion over normalized bbox"
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
if ($mainJS -notmatch "function\s+normalizePageIndex\s*\(\s*value\s*,\s*fallback\s*=\s*0\s*\)") {
  throw "Page index normalization helper missing"
}
if ($mainJS -notmatch "function\s+normalizePageNumber\s*\(\s*value\s*,\s*fallback\s*=\s*1\s*\)") {
  throw "Page number normalization helper missing"
}
if ($mainJS -notmatch 'if\s*\(\s*typeof\s+value\s*===\s*"number"\s*\)[\s\S]*?Number\.isFinite\(value\)') {
  throw "Page target numeric coercion must explicitly handle finite numbers"
}
if ($mainJS -notmatch 'if\s*\(\s*typeof\s+value\s*!==\s*"string"\s*\)\s*\{\s*\r?\n\s*return\s+null;') {
  throw "Page target numeric coercion must reject non-string non-number values"
}
if ($mainJS -notmatch "const\s+normalizedExplicit\s*=\s*normalizePageIndex\(explicitPageIndex,\s*null\)") {
  throw "Current page lookup must normalize explicit page indexes"
}
if ($mainJS -notmatch "return\s+normalizePageNumber\(pageNumber,\s*1\)\s*-\s*1") {
  throw "Current page lookup must safely normalize viewer page numbers"
}
if ($mainJS -notmatch "async\s+function\s+saveAutoDetectedPageImagePreviews\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)") {
  throw "Auto-raster save entry must default missing options"
}
if ($mainJS -notmatch "async\s+function\s+savePagePreviewIndex\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)") {
  throw "Page-preview save entry must default missing options"
}
if ($mainJS -notmatch "async\s+function\s+saveClipPreviewIndex\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)") {
  throw "Clip-preview save entry must default missing options"
}
if ($mainJS -notmatch "async\s+function\s+saveOriginalImagesFromReader\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)") {
  throw "Original-image save entry must default missing options"
}
if ($mainJS -notmatch "async\s+function\s+confirmAndSaveOriginalImagesFromReader\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)") {
  throw "Original-image confirmation entry must default missing options"
}
$originalConfirmEntry = [regex]::Match($mainJS, "async\s+function\s+confirmAndSaveOriginalImagesFromReader\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+saveOriginalImagesFromReader")
if (!$originalConfirmEntry.Success) {
  throw "Original-image confirmation entry function block not found"
}
if ($originalConfirmEntry.Value -notmatch "const\s+safeOptions\s*=\s*normalizeOptionsObject\(options\)[\s\S]*const\s+scope\s*=\s*normalizeOriginalScope\(safeOptions\.scope\)") {
  throw "Original-image confirmation entry must normalize options before scope"
}
if ($originalConfirmEntry.Value -notmatch "try\s*\{[\s\S]*Services\.prompt\.confirm[\s\S]*saveOriginalImagesFromReader\(reader,\s*\{\s*\.\.\.safeOptions,\s*scope\s*\}\)[\s\S]*\}\s*catch\s*\(\s*error\s*\)") {
  throw "Original-image confirmation entry must guard prompt and save delegation"
}
if ($originalConfirmEntry.Value -cmatch "options\.scope") {
  throw "Original-image confirmation entry must not read raw options.scope"
}
if ($originalConfirmEntry.Value -cmatch "\.\.\.options") {
  throw "Original-image confirmation entry must not spread raw options"
}
if ($mainJS -notmatch "function\s+normalizeOptionsObject\s*\(\s*options\s*\)[\s\S]*typeof\s+options\s*===\s*`"object`"[\s\S]*!Array\.isArray\(options\)[\s\S]*\{\}") {
  throw "Options object normalizer must reject null and arrays"
}
function Assert-SaveEntryNormalizesOptions {
  param(
    [Parameter(Mandatory = $true)]$Entry,
    [Parameter(Mandatory = $true)][string]$Name
  )
  if ($Entry.Value -notmatch "const\s+safeOptions\s*=\s*normalizeOptionsObject\(options\)") {
    throw "$Name save entry must normalize malformed options before reading fields"
  }
  if ($Entry.Value -cmatch "options\.") {
    throw "$Name save entry must not read raw options fields"
  }
  if ($Entry.Value -cmatch "options\?\.") {
    throw "$Name save entry must not optional-chain raw options fields"
  }
  if ($Entry.Value -cmatch "\.\.\.options") {
    throw "$Name save entry must not spread raw options"
  }
  if ($Entry.Value -cmatch '(?s)\{[^}]*(?:pageIndex|qualityKey|scope)[^}]*\}\s*=\s*options\b') {
    throw "$Name save entry must not destructure raw options fields"
  }
  if ($Entry.Value -cmatch 'options\s*\[') {
    throw "$Name save entry must not read raw options fields by bracket access"
  }
}
$clipSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveClipPreviewIndex\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+saveAutoDetectedPageImagePreviews")
if (!$clipSaveEntry.Success) {
  throw "Clip-preview save entry function block not found"
}
Assert-SaveEntryNormalizesOptions $clipSaveEntry "Clip-preview"
if ($clipSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Clip-preview save entry must only clear active jobs added by the current call"
}
if ($clipSaveEntry.Value -notmatch "const\s+qualityKey\s*=\s*normalizeQualityKey\(safeOptions\.qualityKey\)[\s\S]*renderCanvasPreview\(\s*\{\s*\.\.\.safeOptions,\s*pageIndex,\s*qualityKey\s*\}\s*\)[\s\S]*qualityKey,") {
  throw "Clip-preview save entry must normalize quality before rendering and index metadata"
}
$autoSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveAutoDetectedPageImagePreviews\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+savePagePreviewIndex")
if (!$autoSaveEntry.Success) {
  throw "Auto-raster save entry function block not found"
}
Assert-SaveEntryNormalizesOptions $autoSaveEntry "Auto-raster"
if ($autoSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Auto-raster save entry must only clear active jobs added by the current call"
}
if ($autoSaveEntry.Value -notmatch "const\s+qualityKey\s*=\s*normalizeQualityKey\(safeOptions\.qualityKey\)[\s\S]*getCurrentPageIndex\(reader,\s*safeOptions\.pageIndex\)") {
  throw "Auto-raster save entry must normalize malformed options before page and quality lookup"
}
$pageSaveEntry = [regex]::Match($mainJS, "async\s+function\s+savePagePreviewIndex\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+renderCanvasPreview")
if (!$pageSaveEntry.Success) {
  throw "Page-preview save entry function block not found"
}
Assert-SaveEntryNormalizesOptions $pageSaveEntry "Page-preview"
if ($pageSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Page-preview save entry must only clear active jobs added by the current call"
}
if ($pageSaveEntry.Value -notmatch "const\s+qualityKey\s*=\s*normalizeQualityKey\(safeOptions\.qualityKey\)[\s\S]*qualityKey,\s*\r?\n\s*pageLabel[\s\S]*qualityKey,") {
  throw "Page-preview save entry must normalize quality before rendering and index metadata"
}
$renderCanvasPreviewEntry = [regex]::Match($mainJS, "function\s+renderCanvasPreview\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+calculateCanvasCrop")
if (!$renderCanvasPreviewEntry.Success) {
  throw "Canvas preview renderer function block not found"
}
if ($renderCanvasPreviewEntry.Value -notmatch "const\s+normalizedQualityKey\s*=\s*normalizeQualityKey\(qualityKey\)[\s\S]*const\s+quality\s*=\s*QUALITY\[normalizedQualityKey\]") {
  throw "Canvas preview renderer must normalize quality before QUALITY lookup"
}
if ($renderCanvasPreviewEntry.Value -notmatch "imageSmoothingQuality\s*=\s*normalizedQualityKey\s*===\s*`"high`"\s*\?\s*`"high`"\s*:\s*`"medium`"") {
  throw "Canvas preview renderer smoothing must use normalized quality"
}
if ($renderCanvasPreviewEntry.Value -notmatch "quality:\s*normalizedQualityKey") {
  throw "Canvas preview renderer metadata must use normalized quality"
}
if ($renderCanvasPreviewEntry.Value -match "QUALITY\[qualityKey\]\s*\|\|\s*QUALITY\.medium") {
  throw "Canvas preview renderer must not rely on raw quality fallback"
}
$duplicateKeyEntry = [regex]::Match($mainJS, "function\s+getPreviewDuplicateKey\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+getPreviewIndexKey")
if (!$duplicateKeyEntry.Success) {
  throw "Preview duplicate key helper function block not found"
}
if ($duplicateKeyEntry.Value -notmatch "const\s+libraryID\s*=\s*normalizeMetadataText\(attachment\?\.libraryID,\s*`"library`",\s*40\)") {
  throw "Preview duplicate key must normalize library ID"
}
if ($duplicateKeyEntry.Value -notmatch "const\s+itemKey\s*=\s*normalizeItemKey\(attachment\?\.key,\s*`"UNKNOWN`"\)") {
  throw "Preview duplicate key must normalize attachment key"
}
if ($duplicateKeyEntry.Value -notmatch "const\s+pageIndex\s*=\s*normalizePageIndex\(preview\?\.pageIndex,\s*0\)") {
  throw "Preview duplicate key must normalize page index"
}
if ($duplicateKeyEntry.Value -notmatch "const\s+quality\s*=\s*normalizeQualityKey\(preview\?\.quality\)") {
  throw "Preview duplicate key must normalize quality"
}
if ($duplicateKeyEntry.Value -notmatch "const\s+bbox\s*=\s*normalizeBBoxNormalized\(preview\?\.bboxNormalized\)[\s\S]*\.map\(\(value\)\s*=>\s*value\.toFixed\(4\)\)") {
  throw "Preview duplicate key must normalize bbox before formatting"
}
if ($duplicateKeyEntry.Value -match "preview\.bboxNormalized\.map") {
  throw "Preview duplicate key must not map raw bbox"
}
if ($duplicateKeyEntry.Value -cmatch "\$\{attachment\.key\}") {
  throw "Preview duplicate key must not interpolate raw attachment key"
}
if ($mainJS -notmatch 'function\s+getPreviewIndexKey\s*\(\s*attachment,\s*entries,\s*scope,\s*qualityKey\s*\)[\s\S]*hashTextToken\(entryKeys\.join\("\|"\)\)') {
  throw "Preview index key must use a stable compact hash of normalized entry keys"
}
if ($mainJS -notmatch "async\s+function\s+hasExistingPreviewIndexAttachment\s*\(\s*parentItem,\s*indexKey,\s*memoryKeys\s*=\s*\[\],\s*sourceRegionKeys\s*=\s*\[\]\s*\)") {
  throw "Persisted duplicate guard must scan existing child index attachments"
}
if ($mainJS -notmatch "parentItem\.getAttachments\(\)") {
  throw "Persisted duplicate guard must inspect parent child attachments"
}
if ($mainJS -notmatch "readPreviewIndexMetadataFromAttachment\(child\)") {
  throw "Persisted duplicate guard must read preview index metadata from existing index attachments"
}
if ($mainJS -match "!childIndexKey\s*\|\|\s*childIndexKey\s*===\s*normalizedIndexKey") {
  throw "Persisted duplicate guard must not treat unreadable child indexes as duplicates"
}
if ($mainJS -notmatch "function\s+isPreviewIndexAttachmentCandidate\s*\(\s*item\s*\)[\s\S]*attachmentContentType[\s\S]*text/html") {
  throw "Persisted duplicate guard must scan renamed text/html child index attachments"
}
if ($mainJS -notmatch "function\s+getExistingPreviewIndexIdentities\s*\(\s*parentItem\s*\)") {
  throw "Persisted duplicate guard must collect existing index and entry identities"
}
$existingIdentityEntry = [regex]::Match($mainJS, "async\s+function\s+getExistingPreviewIndexIdentities\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+isPreviewIndexAttachmentCandidate")
if (!$existingIdentityEntry.Success) {
  throw "Persisted duplicate identity scanner block not found"
}
if ($existingIdentityEntry.Value -notmatch "catch\s*\(\s*error\s*\)\s*\{[\s\S]*logError\(error\);[\s\S]*return\s+identities;") {
  throw "Persisted duplicate identity scanner must return empty identities on child-list failure"
}
if ($existingIdentityEntry.Value -match "return\s+false;") {
  throw "Persisted duplicate identity scanner must not return booleans"
}
if ($mainJS -notmatch "getPreviewDuplicateKeysFromMetadata\(metadata\)") {
  throw "Persisted duplicate guard must read per-entry duplicate keys from metadata"
}
if ($mainJS -notmatch "getSourceRegionKeysFromMetadata\(metadata\)") {
  throw "Persisted duplicate guard must read per-entry source region keys from metadata"
}
if ($mainJS -notmatch "identities\.sourceRegionKeys\.add\(sourceRegionKey\)") {
  throw "Persisted duplicate guard must store source region keys"
}
if ($mainJS -notmatch "identities\.entryKeys\.has\(memoryKey\)") {
  throw "Persisted duplicate guard must compare requested memory keys with existing entry keys"
}
if ($mainJS -notmatch "identities\.sourceRegionKeys\.has\(sourceRegionKey\)") {
  throw "Persisted duplicate guard must compare requested source region keys with existing entries"
}
if ($mainJS -notmatch "recentIndexSaves\.has\(sourceRegionKey\)") {
  throw "In-session duplicate guard must check source region keys"
}
if ($mainJS -notmatch "existingIndexIdentities\.entryKeys\.has\(duplicateKey\)") {
  throw "Auto-page duplicate filtering must skip persisted per-entry duplicates before saving"
}
if ($mainJS -notmatch "existingIndexIdentities\.sourceRegionKeys\.has\(sourceRegionKey\)") {
  throw "Auto-page duplicate filtering must skip persisted same-region duplicates"
}
if ($mainJS -notmatch "function\s+extractPreviewIndexMetadataFromHTML\s*\(\s*html,\s*options\s*=\s*\{\}\s*\)[\s\S]*JSON\.parse\(unescapeHTMLEntities\(preMatch\[1\]\)\.trim\(\)\)") {
  throw "Persisted duplicate guard must parse escaped metadata JSON from saved HTML"
}
if ($mainJS -notmatch "function\s+isSavedPreviewIndexMetadata\s*\(\s*metadata\s*\)[\s\S]*metadata\.schema_version\s*===\s*HELPER_SCHEMA_VERSION[\s\S]*metadata\.storage_mode\s*===\s*`"reader_preview_index`"[\s\S]*metadata\.plugin\?\.id\s*===\s*config\.id") {
  throw "Persisted duplicate guard must validate plugin schema, storage mode, and plugin id"
}
if ($mainJS -notmatch "allowLegacyFallback:\s*isLegacyPreviewIndexTitleCandidate\(item\)") {
  throw "Persisted duplicate guard legacy fallback must be limited to legacy title candidates"
}
if ($mainJS -notmatch "if\s*\(\s*!options\?\.allowLegacyFallback\s*\)\s*\{\s*\r?\n\s*return\s+null;") {
  throw "Persisted duplicate guard must reject legacy key fallback unless explicitly allowed"
}
if ($mainJS -notmatch "async\s+function\s+isDuplicatePreviewIndexSave\s*\(\s*\{\s*parentItem,\s*indexKey,\s*memoryKeys\s*=\s*\[\],\s*sourceRegionKeys\s*=\s*\[\]\s*\}\s*\)") {
  throw "Duplicate guard must combine in-session and persisted index checks"
}
if ($mainJS -notmatch "async\s+function\s+classifyPreviewDuplicateSkipReason\s*\(\s*\{\s*parentItem,\s*indexKey,\s*memoryKeys\s*=\s*\[\],\s*sourceRegionKeys\s*=\s*\[\]\s*\}\s*\)") {
  throw "Duplicate guard must classify session vs saved skip reasons"
}
if ($mainJS -notmatch "function\s+formatPreviewDuplicateSkipReason\s*\(\s*scope,\s*reason,\s*pageIndex\s*=\s*null\s*\)") {
  throw "Preview duplicate feedback must accept optional page token"
}
if ($mainJS -notmatch "formatPreviewDuplicateSkipReason\(`"clip`",\s*skipReason,\s*pageIndex\)") {
  throw "Clip duplicate feedback must pass page token"
}
if ($mainJS -notmatch "session dup" -or ($mainJS -notmatch "saved-index dup" -and $mainJS -notmatch "saved dup")) {
  throw "Manual preview duplicate feedback must distinguish session memory and synced indexes"
}
if ($mainJS -notmatch "function\s+formatAutoDuplicateSkipReason\s*\(\s*\{[\s\S]*skippedSessionDuplicates\s*=\s*0,[\s\S]*skippedSavedDuplicates\s*=\s*0,[\s\S]*skippedByteLimit\s*=\s*0,[\s\S]*skippedOversized\s*=\s*0,[\s\S]*pageIndex\s*=\s*null,[\s\S]*\}\s*=\s*\{\}\s*\)") {
  throw "Auto-page duplicate feedback formatter missing"
}
if ($mainJS -notmatch "saved-index dups" -and $mainJS -notmatch "saved dups") {
  throw "Auto-page persisted duplicate feedback must mention synced HTML indexes"
}
if ($mainJS -notmatch 'Auto skip\$\{pageToken\}: \$\{duplicateReason\}; \$\{capReason\}\.') {
  throw "Auto-page mixed duplicate and byte-cap feedback must mention both causes"
}
if ($mainJS -notmatch "recentIndexSaves\.set\(getSourceRegionKey\(attachment,\s*entry\),\s*now\)") {
  throw "In-session duplicate memory must store source region keys"
}
foreach ($saveEntry in @($clipSaveEntry, $autoSaveEntry, $pageSaveEntry)) {
  if ($saveEntry.Value -notmatch "getPreviewIndexKey\(attachment") {
    throw "Reader preview save entries must compute stable preview index keys"
  }
  if ($saveEntry.Value -notmatch "classifyPreviewDuplicateSkipReason") {
    throw "Reader preview save entries must classify session vs saved duplicate skips"
  }
  if ($saveEntry.Value -notmatch "rememberPreviewIndexSave") {
    throw "Reader preview save entries must remember stable preview index keys after import"
  }
}
$originalSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveOriginalImagesFromReader\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+importOriginalImages")
if (!$originalSaveEntry.Success) {
  throw "Original-image save entry function block not found"
}
Assert-SaveEntryNormalizesOptions $originalSaveEntry "Original-image"
if ($originalSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Original-image save entry must only clear active jobs added by the current call"
}
if ($mainJS -notmatch 'function\s+getReaderJobKey\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)[\s\S]*const\s+scope\s*=\s*normalizeScope\(options\?\.scope\)[\s\S]*return\s+`\$\{itemID\}:\$\{scope\}:\$\{page\}`') {
  throw "Reader job keys must default missing options and normalize scope"
}
if ($mainJS -notmatch "function\s+normalizeOriginalScope\s*\(\s*value\s*\)") {
  throw "Original-image save scope normalizer missing"
}
if ($originalSaveEntry.Value -notmatch "const\s+scope\s*=\s*normalizeOriginalScope\(safeOptions\.scope\)[\s\S]*getCurrentPageIndex\(reader,\s*safeOptions\.pageIndex\)[\s\S]*getReaderJobKey\(reader,\s*\{\s*scope,\s*pageIndex\s*\}\)") {
  throw "Original-image save entry must normalize scope before job key generation"
}
if ($mainJS -notmatch "const\s+contextPageIndex\s*=\s*normalizePageIndex\(params\?\.pageIndexFromContextMenu,\s*null\)") {
  throw "Context menu page targeting must normalize page-index strings"
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
$selectionOverlayEntry = [regex]::Match($mainJS, "function\s+installSelectionOverlay\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+prepareSelectionOverlayHost")
if (!$selectionOverlayEntry.Success) {
  throw "Selection overlay installer function block not found"
}
if ($selectionOverlayEntry.Value -notmatch "cleanupSelectionOverlay\(existing\)") {
  throw "Selection overlay replacement must clean up the existing overlay host state"
}
if ($selectionOverlayEntry.Value -match "existing\?\.remove\(\)") {
  throw "Selection overlay replacement must not remove existing overlays without host cleanup"
}
if ($selectionOverlayEntry.Value -notmatch "prepareSelectionOverlayHost\(pageElement,\s*overlay\)") {
  throw "Selection overlay installer must record and prepare host positioning"
}
if ($selectionOverlayEntry.Value -notmatch "cleanupSelectionOverlay\(overlay\)") {
  throw "Selection overlay cleanup path must restore host positioning"
}
if ($mainJS -notmatch "function\s+prepareSelectionOverlayHost\s*\(\s*pageElement\s*,\s*overlay\s*\)[\s\S]*data-pdf-image-saver-previous-position[\s\S]*pageElement\.style\.position\s*=\s*`"relative`"") {
  throw "Selection overlay host helper must store previous position and position the host"
}
if ($mainJS -notmatch "function\s+cleanupSelectionOverlay\s*\(\s*overlay\s*\)[\s\S]*overlay\.__pdfImageSaverHost\s*\|\|\s*overlay\.parentElement[\s\S]*host\.style\.position\s*=\s*previousPosition[\s\S]*overlay\.remove\?\.\(\)") {
  throw "Selection overlay cleanup helper must restore host position before removal"
}
$readerToastEntry = [regex]::Match($mainJS, "function\s+showReaderToast\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+showToastInDocument")
if (!$readerToastEntry.Success) {
  throw "Reader toast function block not found"
}
if ($readerToastEntry.Value -notmatch "const\s+toastMessage\s*=\s*normalizeToastMessage\(message\)[\s\S]*const\s+toastLevel\s*=\s*normalizeToastLevel\(level\)") {
  throw "Reader toast must normalize message and level at entry"
}
if ($readerToastEntry.Value -notmatch "if\s*\(\s*!isPDFReader\(reader\)\s*\)\s*\{[\s\S]*showFallbackAlert\(fallbackWindow,\s*toastMessage\)[\s\S]*return;") {
  throw "Reader toast must use immediate fallback when no PDF reader is available"
}
if ($readerToastEntry.Value -notmatch "if\s*\(\s*!isPDFReader\(reader\)\s*\)\s*\{[\s\S]*return;[\s\S]*const\s+immediateContext\s*=\s*getPDFViewerContextCandidate\(reader\)") {
  throw "Reader toast must check missing/non-PDF reader before looking up reader document context"
}
if ($readerToastEntry.Value -notmatch "showToastInDocument\(immediateContext\?\.doc,\s*toastMessage,\s*toastLevel\)[\s\S]*showToastInDocument\(fallbackWindow\?\.document,\s*toastMessage,\s*toastLevel\)") {
  throw "Reader toast must prefer reader document before falling back to the main window document"
}
if ($readerToastEntry.Value -match "showToastInDocument\([^,\r\n]+,\s*message,\s*level\)") {
  throw "Reader toast must not pass raw message or level to document toast"
}
if ($readerToastEntry.Value -match "showFallbackAlert\(fallbackWindow,\s*message\)") {
  throw "Reader toast must not pass raw message to fallback alert"
}
if ($readerToastEntry.Value -match "showToastInDocument\(immediateContext\?\.doc\s*\|\|\s*fallbackWindow\?\.document") {
  throw "Reader toast must not combine reader and main-window document fallback before PDF reader check"
}
if ($readerToastEntry.Value -match "Services\.prompt\.alert") {
  throw "Reader toast should route fallback prompts through showFallbackAlert"
}
if ($mainJS -notmatch "function\s+normalizeToastMessage\s*\(\s*message\s*\)[\s\S]*normalizeMetadataText\(message,\s*`"PDF Img note\.`",\s*280\)") {
  throw "Reader toast message normalizer missing compact fallback"
}
if ($mainJS -notmatch "function\s+normalizeToastLevel\s*\(\s*level\s*\)[\s\S]*\[`"info`",\s*`"success`",\s*`"warning`",\s*`"error`",\s*`"progress`"\]\.includes\(text\)\s*\?\s*text\s*:\s*`"info`"") {
  throw "Reader toast level normalizer must allow only supported levels"
}
if ($mainJS -notmatch "function\s+getToastDuration\s*\(\s*level\s*\)[\s\S]*progress[\s\S]*120000") {
  throw "Reader toast duration helper must keep progress toasts sticky"
}
if ($mainJS -notmatch "OK clip \$\{formatPageToastToken\(pageIndex\)\} \(\$\{getQualityMark\(qualityKey\)\}; \$\{formatQualityEstimateShort\(qualityKey\)\}; \$\{formatBytes\(preview\.byteCount\)\}\)") {
  throw "Clip success toast must include page, quality mark, estimate, and size"
}
if ($mainJS -notmatch "OK page \$\{formatPageToastToken\(pageIndex\)\} \(\$\{getQualityMark\(qualityKey\)\}; \$\{formatQualityEstimateShort\(qualityKey\)\}; \$\{formatBytes\(preview\.byteCount\)\}\)\.") {
  throw "Page success toast must include page, quality mark, estimate, and size"
}
if ($mainJS -notmatch "getQualityMark\(qualityKey\).*formatQualityEstimateShort\(qualityKey\).*formatBytes\(totalBytes\)") {
  throw "Auto success toast must include page, quality mark, estimate, and size"
}
if ($mainJS -notmatch "Save clip \$\{formatPageToastToken\(pageIndex\)\}\.\.\.") {
  throw "Clip save path must show page-scoped progress toast"
}
if ($mainJS -notmatch "Auto detect \$\{formatPageToastToken\(pageIndex\)\}\.\.\.") {
  throw "Auto-detect path must show page-scoped progress toast"
}
if ($mainJS -notmatch "Save page \$\{formatPageToastToken\(pageIndex\)\}\.\.\.") {
  throw "Page save path must show page-scoped progress toast"
}
if ($mainJS -notmatch "Helper \$\{formatOriginalScopeToken\(scope, pageIndex\)\}\.\.\.") {
  throw "Original helper path must show scope-scoped progress toast"
}
if ($mainJS -notmatch "if\s*\(\s*!pythonCommands\.length\s*\)\s*\{[\s\S]*formatHelperFailure\(\{\s*status:\s*`"no_python`"") {
  throw "Original helper path must quiet-fail before progress toast when Python is missing"
}
if ($mainJS -notmatch "report\.optional_helper\s*=") {
  throw "Diagnostics must probe optional helper availability"
}
if ($mainJS -notmatch "function\s+formatOptionalHelperStatus\s*\(") {
  throw "Diagnostics helper status formatter missing"
}
if ($mainJS -notmatch "Helper: opt; \$\{formatOptionalHelperStatus\(safeReport\.optional_helper\)\}") {
  throw "Diagnostics report must include optional helper status line"
}

if ($mainJS -notmatch "pdf-image-saver-progress") {
  throw "Reader styles must include progress toast styling"
}

if ($mainJS -notmatch "Clip drag") {
  throw "Clip busy mode must update aria-label"
}
if ($mainJS -notmatch "Auto running") {
  throw "Auto busy mode must update aria-label"
}
if ($mainJS -notmatch "min12") {
  throw "Selection size badge must use stable ascii pixel format with min12 marker"
if ($mainJS -notmatch "const\s+tooSmall\s*=\s*width\s*<\s*12\s*\|\|\s*height\s*<\s*12") {
  throw "Selection size badge must compute min12 threshold from 12px clip floor"
}
}
if ($mainJS -notmatch "pdf-image-saver-selection-size") {
  throw "Clip selection overlay must show live size badge"
}
if ($mainJS -notmatch "sizeBadge.textContent") {
  throw "Clip selection size badge must render pixel dimensions"
}
if ($mainJS -notmatch "onSessionEnd") {
  throw "Clip selection overlay must support onSessionEnd lifecycle callback"
}
if ($mainJS -notmatch "formatQualityEstimateShort") {
  throw "Quality estimates must support dense short labels"
}
if ($mainJS -notmatch "Clip \$\{QUALITY\[key\]\.label\}; \$\{formatQualityEstimateShort\(key\)\}") {
  throw "Context menu clip labels must stay dense"
}
if ($mainJS -notmatch "Auto \$\{defaultQuality\.label\}; \$\{formatQualityEstimateShort\(defaultQualityKey\)\}") {
  throw "Context menu auto labels must stay dense"
}
if ($mainJS -notmatch "Page \$\{defaultQuality\.label\}; \$\{formatQualityEstimateShort\(defaultQualityKey\)\}") {
  throw "Context menu page labels must stay dense"
}
if ($mainJS -notmatch "Orig page; max") {
  throw "Context menu original page labels must stay dense"
}
if ($mainJS -notmatch "Orig doc; max") {
  throw "Context menu original document labels must stay dense"
}
if ($mainJS -notmatch "setToolbarMode\(`"clip`"\)[\s\S]*onSessionEnd\(\)\s*\{[\s\S]*setToolbarMode\(`"idle`"\)") {
  throw "Clip toolbar button must stay in Drag state until selection session ends"
}
if ($mainJS -notmatch "let\s+toolbarMode\s*=\s*`"idle`"") {
  throw "Reader toolbar must track clip/auto busy mode"
}
if ($mainJS -notmatch "select\.disabled\s*=\s*busy") {
  throw "Reader toolbar must disable quality changes while clip/auto is busy"
}
if ($mainJS -notmatch "setToolbarMode\(`"auto`"\)") {
  throw "Auto toolbar path must enter shared busy mode"
}
if ($mainJS -notmatch 'PDF Img Clip"') {
  throw "Tools menu clip label must stay dense"
}
if ($mainJS -notmatch "syncAutoRasterAvailability") {
  throw "Toolbar must sync auto availability without unlocking busy controls"
}
if ($mainJS -notmatch "refreshAutoButtonState") {
  throw "Toolbar must refresh auto button state through shared busy-aware helper"
}
if ($mainJS -notmatch "helperStatus\s*===\s*`"missing_pymupdf`"\s*\|\|\s*helperStatus\s*===\s*`"no_python`"") {
  throw "Helper absence feedback must stay quieter than generic helper failures"
}
$diagnosticsReportEntry = [regex]::Match($mainJS, "function\s+formatDiagnosticsReport\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+normalizeDiagnosticText")
if (!$diagnosticsReportEntry.Success) {
  throw "Diagnostics report formatter function block not found"
}
if ($diagnosticsReportEntry.Value -notmatch "const\s+safeReport\s*=\s*normalizeOptionsObject\(report\)") {
  throw "Diagnostics report formatter must normalize the report container"
}
if ($diagnosticsReportEntry.Value -notmatch "const\s+pdfAttachment\s*=\s*normalizeOptionsObject\(safeReport\.pdf_attachment\)") {
  throw "Diagnostics report formatter must normalize PDF attachment container"
}
if ($diagnosticsReportEntry.Value -notmatch "const\s+warnings\s*=\s*normalizeDiagnosticWarningMessages\(safeReport\.warnings\)") {
  throw "Diagnostics report formatter must normalize warning lines"
}
if ($diagnosticsReportEntry.Value -notmatch "getQualityLabelWithEstimate\(safeReport\.default_quality\)") {
  throw "Diagnostics report formatter must densify default quality"
}

if ($diagnosticsReportEntry.Value -notmatch "Store: HTML; sync PDF") {
  throw "Diagnostics report must surface dense storage mode"
}
if ($diagnosticsReportEntry.Value -notmatch "Dups: \$\{formatDiagnosticDups\(safeReport\.duplicate_guard\)\}") {
  throw "Diagnostics report formatter must surface dups status"
}
if ($mainJS -notmatch "function\s+formatDiagnosticDups\s*\(") {
  throw "Diagnostics dups densifier missing"
}
if ($mainJS -notmatch "on; sess\+saved") {
  throw "Diagnostics dups densifier must keep sess+saved token"
}
if ($mainJS -notmatch "duplicate_guard:\s*getBoolPref\(\`"duplicateGuard`",\s*true\)") {
  throw "Runtime diagnostics must capture duplicate guard preference"
}
if ($diagnosticsReportEntry.Value -notmatch "normalizeItemKey\(pdfAttachment\.key,\s*`"UNKNOWN`"\)") {
  throw "Diagnostics report formatter must normalize PDF key"
}
if ($diagnosticsReportEntry.Value -notmatch "normalizePageNumber\(safeReport\.page_number,\s*1\)") {
  throw "Diagnostics report formatter must normalize page number"
}
if ($diagnosticsReportEntry.Value -cmatch "report\.warnings\.map") {
  throw "Diagnostics report formatter must not map raw warnings"
}
if ($diagnosticsReportEntry.Value -cmatch "report\.pdf_attachment") {
  throw "Diagnostics report formatter must not read raw PDF attachment fields"
}
if ($mainJS -notmatch "function\s+normalizeDiagnosticText\s*\(\s*value[\s\S]*normalizeMetadataText\(value,\s*fallback,\s*maxLength\)") {
  throw "Diagnostics text normalizer must use metadata text normalization"
}
if ($mainJS -notmatch "function\s+normalizeDiagnosticWarningMessages\s*\(\s*warnings\s*\)[\s\S]*normalizeDiagnosticText\(warning,\s*null,\s*220\)[\s\S]*normalized\.length\s*>=\s*6") {
  throw "Diagnostics warnings must be scalar, length-limited, and count-limited"
}
if ($mainJS -notmatch "function\s+formatDiagnosticBoolean\s*\(\s*value\s*\)[\s\S]*value\s*===\s*true\s*\?\s*`"on`"\s*:\s*value\s*===\s*false\s*\?\s*`"off`"\s*:\s*`"unknown`"") {
  throw "Diagnostics booleans must format to on, off, or unknown"
}
$errorMessageEntry = [regex]::Match($mainJS, "function\s+getErrorMessage\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+normalizeErrorMessageText")
if (!$errorMessageEntry.Success) {
  throw "Error message helper function block not found"
}
if ($errorMessageEntry.Value -notmatch "normalizeErrorMessageText\(error\.message\)") {
  throw "Error message helper must normalize Error.message"
}
if ($errorMessageEntry.Value -notmatch "typeof\s+error\s*===\s*`"string`"[\s\S]*typeof\s+error\s*===\s*`"number`"") {
  throw "Error message helper must preserve scalar string and numeric errors"
}
if ($errorMessageEntry.Value -notmatch "return\s+`"Unknown err\.`"") {
  throw "Error message helper must fall back to a compact unknown error"
}
if ($errorMessageEntry.Value -match "String\(error\)") {
  throw "Error message helper must not stringify arbitrary thrown values"
}
if ($mainJS -notmatch "function\s+normalizeErrorMessageText\s*\(\s*value\s*\)[\s\S]*normalizeMetadataText\(value,\s*null,\s*320\)") {
  throw "Error message text normalizer must use capped metadata text normalization"
}
if ($mainJS -notmatch "text\s*===\s*`"undefined`"[\s\S]*text\s*===\s*`"null`"[\s\S]*text\s*===\s*`"\[object Object\]`"") {
  throw "Error message text normalizer must reject noisy stringified values"
}
if ($mainJS -notmatch "function\s+showToastInDocument\s*\(\s*doc\s*,\s*message\s*,\s*level\s*\)[\s\S]*return\s+false;[\s\S]*return\s+true;") {
  throw "Reader toast document renderer must return whether toast display succeeded"
}
if ($mainJS -notmatch "\.pdf-image-saver-toolbar-button[\s\S]*width:\s*60px[\s\S]*min-width:\s*60px") {
  throw "Reader toolbar buttons must keep stable width during busy labels"
}
if ($mainJS -notmatch "\.pdf-image-saver-quality[\s\S]*width:\s*132px[\s\S]*min-width:\s*132px") {
  throw "Reader toolbar quality select must keep stable width"
}

$prefsJS = Get-Content -Encoding UTF8 -Raw -LiteralPath .\content\preferences.js
if ($prefsJS -notmatch "pdf-image-saver-max-page-images" -or $prefsJS -notmatch "getHelperPageMax") {
  throw "Preference status must track helper page/doc/timeout/python controls"
}
if ($prefsJS -notmatch "Helper: opt; min \$\{helperMinArea\}; page") {
  throw "Preference status must show dense helper caps"
}
if ($prefsJS -notmatch "Auto: min \$\{autoMinArea\}") {
  throw "Preference status must show dense auto min/caps"
}
if ($prefsJS -notmatch "getAutoMinArea") {
  throw "Preference status must expose Auto min area"
}
if ($prefsJS -notmatch "getHelperMinArea") {
  throw "Preference status must expose Helper min area"
}
if ($mainJS -notmatch "const\s+toast\s*=\s*existing\s*\|\|\s*doc\.createElement\(`"div`"\)") {
  throw "Reader toast must reuse existing toast element when updating"
}
if ($mainJS -notmatch "if\s*\(\s*!existing\s*\)\s*\{[\s\S]*doc\.body\.appendChild\(toast\)") {
  throw "Reader toast must append only when creating a new toast element"
}

if ($mainJS -notmatch "function\s+showFallbackAlert\s*\(\s*fallbackWindow\s*,\s*message\s*\)[\s\S]*Services\.prompt\.alert\(fallbackWindow,\s*`"PDF Img`",\s*message\)") {
  throw "Reader toast fallback alert helper missing"
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

if ($mainJS -notmatch "function\s+formatPreviewDetectorLabel\s*\(") {
  throw "Preview index detector label densifier missing"
}
if ($mainJS -notmatch "formatPreviewDetectorLabel\(entry\.detector\)") {
  throw "Preview index Trace must densify detector labels"
}
if ($mainJS -notmatch "getQualityLabelWithEstimate\(previewQualityKey\)") {
  throw "Preview index header must densify quality label/estimate"
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


if ($mainJS -notmatch "Temp: \$\{getErrorMessage\(error\)\}") {
  throw "Diagnostics temp warning prefix must stay dense"
}
if ($mainJS -notmatch "Helper: \$\{getErrorMessage\(error\)\}") {
  throw "Diagnostics helper warning prefix must stay dense"
}
if ($mainJS -match "Temp check:") {
  throw "Diagnostics must not use legacy Temp check: prefix"
}
if ($mainJS -match "Helper probe:") {
  throw "Diagnostics must not use legacy Helper probe: prefix"
}


if ($mainJS -notmatch "function\s+formatPreviewScopeLabel\s*\(") {
  throw "Preview scope label densifier missing"
}
if ($mainJS -notmatch "HTML; sync; \$\{escapeHTML\(formatPreviewScopeLabel\(normalizedScope\)\)\}") {
  throw "Preview index header must densify scope labels"
}
if ($mainJS -notmatch "Orig \$\{escapeHTML\(formatPreviewScopeLabel\(normalizedScope\)\)\}; helper") {
  throw "Original index header must densify scope labels"
}


if ($mainJS -notmatch "scopeLabel,\s*\r?\n\s*target,") {
  throw "buildIndexTitle must include densified scope before page target"
}
if ($mainJS -notmatch "img index \$\{escapeHTML\(formatPreviewScopeLabel\(normalizedScope\)\)\}") {
  throw "Preview HTML document title must densify scope"
}


if ($mainJS -notmatch "orig \$\{formatPreviewScopeLabel\(normalizeOriginalScope\(scope\)\)\}") {
  throw "Original index attachment title must densify scope labels"
}
if ($mainJS -notmatch "orig \$\{escapeHTML\(formatPreviewScopeLabel\(normalizedScope\)\)\}") {
  throw "Original HTML document title must densify scope labels"
}


if ($mainJS -notmatch "Use clip\.") {
  throw "Original confirmation must reuse dense Use clip guidance"
}
if ($mainJS -match "Prefer clip") {
  throw "Original confirmation must not use legacy Prefer clip wording"
}


if ($mainJS -notmatch "auto_min_area:\s*clamp\(getNumberPref\(\`"minAutoImageArea`"") {
  throw "Runtime diagnostics must capture auto min area"
}
if ($mainJS -notmatch "helper_min_area:\s*clamp\(getNumberPref\(\`"minImageArea`"") {
  throw "Runtime diagnostics must capture helper min area"
}
if ($mainJS -notmatch "Auto: min \$\{formatDiagnosticArea\(safeReport\.auto_min_area\)\}") {
  throw "Diagnostics report must densify auto min area"
}
if ($mainJS -notmatch "Helper: opt; \$\{formatOptionalHelperStatus\(safeReport\.optional_helper\)\}; min \$\{formatDiagnosticArea\(safeReport\.helper_min_area\)\}") {
  throw "Diagnostics report must densify helper min area"
}
if ($mainJS -notmatch "function\s+formatDiagnosticArea\s*\(") {
  throw "Diagnostics area densifier missing"
}


if ($mainJS -notmatch "helper_page_max:\s*getHelperMaxImages\(\`"page`"\)") {
  throw "Runtime diagnostics must capture helper page max"
}
if ($mainJS -notmatch "helper_doc_max:\s*getHelperMaxImages\(\`"document`"\)") {
  throw "Runtime diagnostics must capture helper doc max"
}
if ($mainJS -notmatch "helper_timeout_s:\s*getHelperTimeoutSeconds\(\)") {
  throw "Runtime diagnostics must capture helper timeout"
}
if ($mainJS -notmatch "page \$\{normalizeNonNegativeInteger\(safeReport\.helper_page_max,\s*0\)\}; doc \$\{normalizeNonNegativeInteger\(safeReport\.helper_doc_max,\s*0\)\}; \$\{normalizeNonNegativeInteger\(safeReport\.helper_timeout_s,\s*0\)\}s") {
  throw "Diagnostics report must densify helper page/doc/timeout caps"
}


if ($mainJS -notmatch "auto_max_images:\s*clamp\(getIntegerPref\(\`"autoDetectMaxImages`"") {
  throw "Runtime diagnostics must capture auto max images"
}
if ($mainJS -notmatch "\$\{normalizeNonNegativeInteger\(safeReport\.auto_max_images,\s*0\)\} max") {
  throw "Diagnostics report must densify auto max images"
}


if ($mainJS -notmatch "helper_python_mode:\s*getStringPref\(\`"pythonPath`"") {
  throw "Runtime diagnostics must capture helper python path mode"
}
if ($mainJS -notmatch "function\s+formatHelperPythonMode\s*\(") {
  throw "Diagnostics python mode densifier missing"
}
if ($mainJS -notmatch "\$\{formatHelperPythonMode\(safeReport\.helper_python_mode\)\}") {
  throw "Diagnostics report must densify helper python path mode"
}


if ($mainJS -notmatch "Auto: min \$\{formatDiagnosticArea\(safeReport\.auto_min_area\)\}; \$\{normalizeNonNegativeInteger\(safeReport\.auto_max_images,\s*0\)\} max; \$\{normalizeDiagnosticText\(safeReport\.auto_cap,\s*`"unknown`",\s*80\)\}") {
  throw "Diagnostics auto caps must densify as preference-style Auto line"
}
if ($mainJS -notmatch "Index: \$\{normalizeDiagnosticText\(safeReport\.max_index,\s*`"unknown`",\s*80\)\}") {
  throw "Diagnostics index cap must densify as preference-style Index line"
}


if ($mainJS -notmatch "Plugin: \$\{normalizeDiagnosticText\(safeReport\.plugin") {
  throw "Diagnostics plugin line must use labeled Plugin: prefix"
}
if ($mainJS -notmatch "Run: \$\{formatDiagnosticBoolean\(safeReport\.started\)\}") {
  throw "Diagnostics runtime line must use labeled Run: prefix"
}
if ($mainJS -notmatch "Temp: \$\{normalizeNonNegativeInteger\(safeReport\.temp_leftovers") {
  throw "Diagnostics temp line must use labeled Temp: prefix"
}
if ($mainJS -notmatch "PDF: \$\{normalizeItemKey\(pdfAttachment\.key") {
  throw "Diagnostics PDF line must use labeled PDF: prefix"
}
if ($mainJS -notmatch "Page: \$\{pageNumber\}") {
  throw "Diagnostics page line must use labeled Page: prefix"
}
if ($mainJS -notmatch "Open: \$\{normalizeDiagnosticText\(safeReport\.open_pdf_uri") {
  throw "Diagnostics open line must use labeled Open: prefix"
}


if ($mainJS -notmatch 'title", "Click/Esc dismiss"') {
  throw "Reader toast must advertise click/Esc dismiss"
}
if ($mainJS -notmatch "toast\.onclick\s*=") {
  throw "Reader toast must support click-to-dismiss"
}
if ($mainJS -notmatch "cursor: pointer;") {
  throw "Reader toast style must signal click-to-dismiss"
}

if ($mainJS -notmatch "function\s+buildSourceRegionMapHTML\s*\(\s*region\s*,\s*openURI") {
  throw "Source region map builder must accept open URI"
}
if ($mainJS -notmatch 'class="source-map-link"') {
  throw "Source region map must render clickable open link"
}
if ($mainJS -notmatch 'Q \$\{qualityToken\}') {
  throw "Clip overlay hint must include quality token"
}
if ($mainJS -notmatch 'title", "Click/Esc dismiss"') {
  throw "Reader toast must advertise click/Esc dismiss"
}
if ($mainJS -notmatch 'key === .Escape') {
  throw "Reader toast must dismiss on Escape"
}

if ($mainJS -notmatch 'aria-busy') {
  throw "Toolbar busy mode must expose aria-busy"
}
if ($mainJS -notmatch 'Auto n/a') {
  throw "Auto unavailable state must expose dense aria-label"
}
if ($mainJS -notmatch 'pdf-image-saver-selection-overlay') {
  throw "Toast Escape must coordinate with clip overlay"
}
if ($mainJS -notmatch 'focus-visible') {
  throw "Index open targets must include keyboard focus style"
}

if ($mainJS -notmatch 'data-mode') {
  throw "Toolbar busy mode must expose data-mode"
}
if ($mainJS -notmatch 'Q lock \(clip\)') {
  throw "Busy quality select must explain clip lock"
}
if ($mainJS -notmatch 'is-min') {
  throw "Selection size badge must mark min size visually"
}
if ($mainJS -notmatch 'pdf-image-saver-quality:disabled') {
  throw "Quality select disabled state must be styled"
}

if ($mainJS -notmatch 'Esc/RMB') {
  throw "Clip overlay cancel hints must include Esc/RMB"
}
if ($mainJS -notmatch 'contextmenu') {
  throw "Clip overlay must cancel on contextmenu"
}
if ($mainJS -notmatch 'aria-live') {
  throw "Reader toast must set aria-live"
}
if ($mainJS -notmatch 'Preview p\$\{escapeHTML\(String\(entry\.pageNumber\)\)\}') {
  throw "Preview image alt must include page number"
}
if ($mainJS -notmatch 'totalPreviewBytes') {
  throw "Preview index header must include total preview bytes"
}
if ((Get-Content -Raw "preferences.xhtml") -notmatch 'title="Preview quality"') {
  throw "Preference short labels must expose title tooltips"
}

if ($mainJS -notmatch 'function\s+getQualityMark') {
  throw "Selection size badge must densify quality mark helper"
}
if ($mainJS -notmatch 'entry-badge') {
  throw "Preview index entries must expose entry badge"
}
if ($mainJS -notmatch 'data-level') {
  throw "Reader toast must expose data-level"
}
if ($mainJS -notmatch 'aria-busy') {
  throw "Progress toast must set aria-busy"
}

if ($mainJS -notmatch '<div><dt>Det</dt><dd>\$\{escapeHTML\(formatPreviewDetectorLabel\(entry\.detector\)\)\}</dd></div>') {
  throw "Preview entry summary must surface detector"
}
if ($mainJS -notmatch '<th>#</th>') {
  throw "Original index must expose numbered rows"
}
if ($mainJS -notmatch 'getQualityMark\(qualityKey\)') {
  throw "Success toasts must include quality mark"
}

Write-Host "check ok"
