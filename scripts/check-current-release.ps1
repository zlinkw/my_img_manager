$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root

function Invoke-Native {
  param([Parameter(Mandatory = $true)][string]$FilePath, [string[]]$ArgumentList = @())
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) { throw "$FilePath failed with exit code $LASTEXITCODE" }
}

Invoke-Native "node" @("--check", ".\bootstrap.js")
Invoke-Native "node" @("--check", ".\content\pdf-image-saver.js")
Invoke-Native "node" @("--check", ".\content\preferences.js")
Invoke-Native "node" @("--check", ".\scripts\audit-index-buttons.mjs")
Invoke-Native "node" @(".\tests\current-release.test.js")

[xml](Get-Content -Raw -Encoding UTF8 -LiteralPath ".\preferences.xhtml") | Out-Null
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath ".\manifest.json" | ConvertFrom-Json
$package = Get-Content -Raw -Encoding UTF8 -LiteralPath ".\package.json" | ConvertFrom-Json
if ($package.version -ne $manifest.version) { throw "package.json version must match manifest.json" }
if ($manifest.applications.zotero.id -ne "pdf-image-saver@zlk.local") { throw "Unexpected plugin id" }
if ($manifest.applications.zotero.strict_max_version -ne "9.*") { throw "strict_max_version must be 9.*" }
if ($manifest.version -ne "0.1.128") { throw "Recovery candidate version must be 0.1.128" }

$source = Get-Content -Raw -Encoding UTF8 -LiteralPath ".\content\pdf-image-saver.js"
foreach ($forbidden in @("pdf-image-saver-auto-button", "saveAutoDetectedPageImagePreviews", "imageCoordinatesToCandidates")) {
  if ($source.Contains($forbidden)) { throw "Automatic capture residue: $forbidden" }
}
foreach ($required in @("publishPreviewEntriesToSharedLibrary", "refreshLibrary", 'GLOBAL_LIBRARY_VIEW_VERSION = "37"', "paper-image-library-view")) {
  if (!$source.Contains($required)) { throw "Missing release contract: $required" }
}

foreach ($doc in @(".\PROJECT_CONSTRAINTS.md", ".\docs\IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md", ".\docs\IMAGE_LIBRARY_SHARING_PROTOCOL.md", ".\docs\target-mode-plan.md")) {
  if (!(Test-Path -LiteralPath $doc -PathType Leaf)) { throw "Required release document missing: $doc" }
}

Write-Host "current release check ok"
