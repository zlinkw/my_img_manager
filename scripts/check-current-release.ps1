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

# The plan file is a snapshot, not a batch ledger. Enforce the documented cap so appended
# batch entries are caught here instead of being noticed only after it has grown for months.
$planPath = ".\docs\target-mode-plan.md"
$planBytes = (Get-Item -LiteralPath $planPath).Length
$planLines = [IO.File]::ReadAllLines((Resolve-Path $planPath)).Length
if ($planBytes -gt 4096 -or $planLines -gt 80) {
  throw "docs/target-mode-plan.md must stay a short snapshot (<=4096 bytes, <=80 lines); it is $planBytes bytes / $planLines lines. Compress it in place instead of appending a batch ledger."
}

# Every user-facing error must read as Chinese. Coverage itself is proven at runtime by the
# throw sweep in tests/current-release.test.js, which also understands the dynamic patterns;
# this static pass only guards the literal translation table.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads .ps1 as ANSI when there is no BOM.
$knownStart = $source.IndexOf('const known = {')
if ($knownStart -lt 0) { throw "User-facing error translation table missing" }
$knownText = $source.Substring($knownStart, $source.IndexOf('};', $knownStart) - $knownStart)
$knownPairs = @([regex]::Matches($knownText, '"([^"]+)":\s*"([^"]*)"'))
if ($knownPairs.Count -lt 30) { throw "User-facing error translation table looks truncated: $($knownPairs.Count) entries" }
$cjkPattern = "[" + [char]0x3400 + "-" + [char]0x9FFF + "]"
foreach ($pair in $knownPairs) {
  if ($pair.Groups[2].Value -notmatch $cjkPattern) {
    throw "User-facing error translation is not Chinese: $($pair.Groups[1].Value)"
  }
}

$scriptFiles = @(Get-ChildItem -LiteralPath ".\scripts" -File -Filter "*.ps1" | Sort-Object Name)
foreach ($scriptFile in $scriptFiles) {
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($scriptFile.FullName, [ref]$null, [ref]$parseErrors) | Out-Null
  if (@($parseErrors).Count -gt 0) {
    throw "PowerShell syntax error in $($scriptFile.Name): $($parseErrors[0].Message)"
  }
}

# Handoff artifacts must be resolved from manifest.json through scripts/current-xpi.ps1.
# A literal outputs XPI filename pins the handoff to one build and silently rots on every version bump.
foreach ($scriptFile in $scriptFiles) {
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $scriptFile.FullName
  foreach ($pinned in [regex]::Matches($text, 'pdf-image-saver-\d+\.\d+\.\d+[^"''\s]*\.xpi')) {
    throw "Hardcoded handoff XPI name in scripts\$($scriptFile.Name): $($pinned.Value). Use Get-CurrentXpiInfo/Assert-CurrentXpiPath from scripts\current-xpi.ps1."
  }
}

. (Join-Path $PSScriptRoot "current-xpi.ps1")
$currentXpi = Get-CurrentXpiInfo -Root $root
if ($currentXpi.version -ne $manifest.version) { throw "current-xpi.ps1 resolved version $($currentXpi.version); manifest says $($manifest.version)" }
if (@($currentXpi.staleNames).Count -gt 0) {
  Write-Host "note: outputs holds other-version XPIs that no script will use: $(@($currentXpi.staleNames) -join ', ')"
}

# Zotero-only protocol gate from the PPT repo. Skipped, never failed, when that repo is absent.
$pptRoot = "D:\GitRepo\my_ppt_app"
$pptGate = Join-Path $pptRoot "scripts\validate-zotero-image-library.mjs"
if (Test-Path -LiteralPath $pptGate -PathType Leaf) {
  Push-Location $pptRoot
  try {
    Invoke-Native "node" @($pptGate)
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Host "ppt image library gate skipped: $pptRoot not present"
}

# Headless Chromium UI audit: the release gate for reader menus, clip overlay, review dialog,
# preference pane, current-paper index and the full gallery. Skips itself when no browser exists.
Invoke-Native "node" @(".\scripts\audit-index-buttons.mjs", "--skip-without-browser")

Write-Host "current release check ok"
