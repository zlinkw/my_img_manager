$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$buildScript = Join-Path $root "scripts\build.ps1"
$xpiPath = Join-Path $root "outputs\pdf-image-saver-0.1.0.xpi"
$shaPath = Join-Path $root "outputs\pdf-image-saver-0.1.0.sha256"

Set-Location $root

& powershell -ExecutionPolicy Bypass -File $buildScript
if ($LASTEXITCODE -ne 0) {
  throw "build.ps1 failed with exit code $LASTEXITCODE"
}

if (!(Test-Path -LiteralPath $xpiPath)) {
  throw "XPI missing after build: $xpiPath"
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $xpiPath).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $xpiPath).Length
$writtenHash = if (Test-Path -LiteralPath $shaPath) {
  (Get-Content -Encoding ASCII -Raw -LiteralPath $shaPath).Trim().ToLowerInvariant()
}
else {
  ""
}
if ($writtenHash -and $writtenHash -ne $hash) {
  throw "SHA256 sidecar mismatch: $shaPath"
}

Write-Host "manual package ok"
Write-Host "xpi: $xpiPath"
Write-Host "sha256: $hash"
Write-Host "bytes: $size"
Write-Host ""
Write-Host "manual Zotero install:"
Write-Host "1. Zotero: Tools > Add-ons."
Write-Host "2. Gear menu > Install Add-on From File..."
Write-Host "3. Select the XPI path above."
Write-Host "4. Allow/confirm the install if Zotero prompts."
Write-Host "5. Restart Zotero if Zotero requests it."
Write-Host ""
Write-Host "after install verification:"
Write-Host "npm.cmd run verify:manual"
Write-Host "npm.cmd run smoke:wait"
Write-Host "npm.cmd run smoke:preflight"
Write-Host "npm.cmd run runtime:status"
