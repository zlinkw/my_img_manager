$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$addonId = "pdf-image-saver@zlk.local"
$profileRoot = Join-Path $env:APPDATA "Zotero\Zotero\Profiles"

if (!(Test-Path -LiteralPath $profileRoot)) {
  throw "Zotero profile root not found: $profileRoot"
}

$profiles = Get-ChildItem -LiteralPath $profileRoot -Directory
if (!$profiles) {
  throw "No Zotero profiles found under $profileRoot"
}

foreach ($profile in $profiles) {
  $extensionsDir = Join-Path $profile.FullName "extensions"
  New-Item -ItemType Directory -Force -Path $extensionsDir | Out-Null
  $proxyPath = Join-Path $extensionsDir $addonId
  Set-Content -Encoding ASCII -NoNewline -LiteralPath $proxyPath -Value $root
  Write-Host "installed proxy $proxyPath -> $root"
}
