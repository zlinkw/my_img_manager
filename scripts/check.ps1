$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
& powershell -ExecutionPolicy Bypass -File (Join-Path $root "scripts\check-current-release.ps1")
if ($LASTEXITCODE -ne 0) {
  throw "check-current-release.ps1 failed with exit code $LASTEXITCODE"
}
