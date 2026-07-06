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
if ($mainJS -notmatch "images:\s*normalizedImages\.slice\(0,\s*maxImages\)") {
  throw "Original image import limiter must truncate images to maxImages"
}
if ($mainJS -notmatch "const\s+normalized\s*=\s*normalizeOriginalImageForImport\(image,\s*index,\s*report\?\.output_dir\)") {
  throw "Original image import limiter must normalize helper image records"
}
if ($mainJS -notmatch "function\s+normalizeOriginalImageForImport\s*\(\s*image,\s*index,\s*outputDir\s*\)") {
  throw "Original helper image record normalizer missing"
}
if ($mainJS -notmatch "function\s+normalizeHelperFilePath\s*\(\s*value,\s*outputDir\s*\)") {
  throw "Original helper file path normalizer missing"
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
if ($mainJS -notmatch "for\s*\(\s*const\s+image\s+of\s+prepared\.images\s*\)") {
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
if ($mainJS -notmatch "omittedCount:\s*prepared\.omittedCount\s*\+\s*importErrorCount") {
  throw "Original image import result must add Zotero import failures to omission count"
}
if ($mainJS -notmatch "skipped\s+\$\{importResult\.importErrorCount\}\s+failed Zotero import") {
  throw "Original helper import toast must expose failed Zotero imports separately"
}
if ($mainJS -notmatch "try\s*\{\s*\r?\n\s*await\s+Zotero\.Attachments\.importFromFile") {
  throw "Original image import must isolate each Zotero import call"
}
if ($mainJS -notmatch "prepared\.images\.length\s*&&\s*!count\s*&&\s*importErrorCount\s*===\s*prepared\.images\.length") {
  throw "Original image import must detect all attempted Zotero imports failing"
}
if ($mainJS -notmatch "All\s+\$\{importErrorCount\}\s+Zotero original image imports failed") {
  throw "Original image import must throw a clear all-imports-failed error"
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
if ($mainJS -notmatch "Unexpected helper schema:\s*\$\{normalizeHelperSchemaText\(report\.schema_version\)\}") {
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
if ($mainJS -notmatch "skipped\s+\$\{importResult\.errorCount\}\s+unreadable helper file") {
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
if ($mainJS -notmatch "source_region:\s*entry\.sourceRegion") {
  throw "metadata must include source_region"
}
if ($mainJS -notmatch "__test__:\s*\{[\s\S]*buildIndexHTML") {
  throw "buildIndexHTML must remain exported for regression tests"
}
if ($mainJS -notmatch "function\s+normalizePreviewEntries\s*\(\s*entries\s*\)") {
  throw "HTML preview entry-list normalizer missing"
}
if ($mainJS -notmatch "Preview index entries must be an array") {
  throw "HTML preview non-array entry lists must fail clearly"
}
if ($mainJS -notmatch "Preview index must include at least one entry") {
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
$clipSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveClipPreviewIndex\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+saveAutoDetectedPageImagePreviews")
if (!$clipSaveEntry.Success) {
  throw "Clip-preview save entry function block not found"
}
if ($clipSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Clip-preview save entry must only clear active jobs added by the current call"
}
if ($clipSaveEntry.Value -notmatch "const\s+qualityKey\s*=\s*normalizeQualityKey\(options\.qualityKey\)[\s\S]*renderCanvasPreview\(\s*\{\s*\.\.\.options,\s*pageIndex,\s*qualityKey\s*\}\s*\)[\s\S]*qualityKey,") {
  throw "Clip-preview save entry must normalize quality before rendering and index metadata"
}
$autoSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveAutoDetectedPageImagePreviews\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+savePagePreviewIndex")
if (!$autoSaveEntry.Success) {
  throw "Auto-raster save entry function block not found"
}
if ($autoSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Auto-raster save entry must only clear active jobs added by the current call"
}
$pageSaveEntry = [regex]::Match($mainJS, "async\s+function\s+savePagePreviewIndex\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*function\s+renderCanvasPreview")
if (!$pageSaveEntry.Success) {
  throw "Page-preview save entry function block not found"
}
if ($pageSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Page-preview save entry must only clear active jobs added by the current call"
}
if ($pageSaveEntry.Value -notmatch "const\s+qualityKey\s*=\s*normalizeQualityKey\(options\.qualityKey\)[\s\S]*qualityKey,\s*\r?\n\s*pageLabel[\s\S]*qualityKey,") {
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
$originalSaveEntry = [regex]::Match($mainJS, "async\s+function\s+saveOriginalImagesFromReader\s*\([\s\S]*?\n\s*\}\r?\n\r?\n\s*async\s+function\s+importOriginalImages")
if (!$originalSaveEntry.Success) {
  throw "Original-image save entry function block not found"
}
if ($originalSaveEntry.Value -notmatch "let\s+jobAdded\s*=\s*false[\s\S]*activeJobs\.add\(jobKey\)[\s\S]*jobAdded\s*=\s*true[\s\S]*if\s*\(\s*jobAdded\s*\)\s*\{\s*\r?\n\s*activeJobs\.delete\(jobKey\)") {
  throw "Original-image save entry must only clear active jobs added by the current call"
}
if ($mainJS -notmatch 'function\s+getReaderJobKey\s*\(\s*reader\s*,\s*options\s*=\s*\{\}\s*\)[\s\S]*const\s+scope\s*=\s*normalizeScope\(options\?\.scope\)[\s\S]*return\s+`\$\{itemID\}:\$\{scope\}:\$\{page\}`') {
  throw "Reader job keys must default missing options and normalize scope"
}
if ($mainJS -notmatch "function\s+normalizeOriginalScope\s*\(\s*value\s*\)") {
  throw "Original-image save scope normalizer missing"
}
if ($originalSaveEntry.Value -notmatch "const\s+scope\s*=\s*normalizeOriginalScope\(options\.scope\)[\s\S]*getReaderJobKey\(reader,\s*\{\s*scope,\s*pageIndex\s*\}\)") {
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
if ($mainJS -notmatch "function\s+normalizeToastMessage\s*\(\s*message\s*\)[\s\S]*normalizeMetadataText\(message,\s*`"PDF Image Saver notification\.`",\s*280\)") {
  throw "Reader toast message normalizer missing compact fallback"
}
if ($mainJS -notmatch "function\s+normalizeToastLevel\s*\(\s*level\s*\)[\s\S]*\[`"info`",\s*`"success`",\s*`"warning`",\s*`"error`"\]\.includes\(text\)\s*\?\s*text\s*:\s*`"info`"") {
  throw "Reader toast level normalizer must allow only supported levels"
}
if ($mainJS -notmatch "function\s+showToastInDocument\s*\(\s*doc\s*,\s*message\s*,\s*level\s*\)[\s\S]*return\s+false;[\s\S]*doc\.body\.appendChild\(toast\)[\s\S]*return\s+true;") {
  throw "Reader toast document renderer must return whether toast display succeeded"
}
if ($mainJS -notmatch "function\s+showFallbackAlert\s*\(\s*fallbackWindow\s*,\s*message\s*\)[\s\S]*Services\.prompt\.alert\(fallbackWindow,\s*`"PDF Image Saver`",\s*message\)") {
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
