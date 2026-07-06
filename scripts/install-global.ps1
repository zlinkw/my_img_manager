$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$addonId = "pdf-image-saver@zlk.local"
$profileRoot = Join-Path $env:APPDATA "Zotero\Zotero\Profiles"
$zoteroRunning = [bool](Get-Process -Name Zotero -ErrorAction SilentlyContinue)

function Enable-ExtensionDirectoryRescan {
  param([string]$ProfilePath)

  $prefsPath = Join-Path $ProfilePath "prefs.js"
  if (!(Test-Path -LiteralPath $prefsPath)) {
    return "prefs.js missing; Zotero will create it on next launch"
  }
  if ($zoteroRunning) {
    return "pending: Zotero is running; close Zotero and rerun install:global once to remove extension scan cache prefs"
  }

  $lines = Get-Content -Encoding UTF8 -LiteralPath $prefsPath
  $filtered = @($lines | Where-Object {
    $_ -notmatch '^\s*user_pref\("extensions\.lastApp(BuildId|Version)"'
  })
  if ($filtered.Count -eq $lines.Count) {
    return "already clear"
  }
  [IO.File]::WriteAllLines($prefsPath, $filtered, [Text.UTF8Encoding]::new($false))
  return "cleared extensions.lastAppBuildId/extensions.lastAppVersion"
}

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
  $rescan = Enable-ExtensionDirectoryRescan -ProfilePath $profile.FullName
  Write-Host "installed proxy $proxyPath -> $root"
  Write-Host "extension rescan: $rescan"
}
