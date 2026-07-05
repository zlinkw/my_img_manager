$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$addonID = "pdf-image-saver@zlk.local"
$xpiPath = Join-Path $root "outputs\pdf-image-saver-0.1.0.xpi"
$shaPath = Join-Path $root "outputs\pdf-image-saver-0.1.0.sha256"
$profileRoot = Join-Path $env:APPDATA "Zotero\Zotero\Profiles"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) "pdf-image-saver"

function Get-DirectorySize {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    return 0
  }
  $sum = 0
  Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (!$_.PSIsContainer) {
      $sum += $_.Length
    }
  }
  return $sum
}

function Get-ProxyInfo {
  param([string]$ProfilePath)
  $proxy = Join-Path $ProfilePath "extensions\$addonID"
  $bytes = @()
  if (Test-Path -LiteralPath $proxy) {
    $bytes = [IO.File]::ReadAllBytes($proxy)
  }
  $prefix = if ($bytes.Length -ge 3) {
    (($bytes[0..2] | ForEach-Object { $_.ToString("X2") }) -join "-")
  }
  else {
    ""
  }
  return [ordered]@{
    exists = [bool](Test-Path -LiteralPath $proxy)
    path = $proxy
    target = if (Test-Path -LiteralPath $proxy) { (Get-Content -Encoding ASCII -LiteralPath $proxy -Raw).Trim() } else { "" }
    firstBytes = $prefix
    hasBOM = $prefix -eq "EF-BB-BF"
  }
}

function Get-ExtensionRegistration {
  param([string]$ProfilePath)
  $extensionsJSON = Join-Path $ProfilePath "extensions.json"
  if (!(Test-Path -LiteralPath $extensionsJSON)) {
    return [ordered]@{ registered = $false; active = $false; path = ""; rootURI = ""; reason = "extensions.json missing" }
  }
  $raw = Get-Content -Encoding UTF8 -Raw -LiteralPath $extensionsJSON
  $json = $raw | ConvertFrom-Json
  $addon = $json.addons | Where-Object { $_.id -eq $addonID } | Select-Object -First 1
  if (!$addon) {
    return [ordered]@{ registered = $false; active = $false; path = ""; rootURI = ""; reason = "not registered in current Zotero session" }
  }
  return [ordered]@{
    registered = $true
    active = [bool]$addon.active
    path = [string]$addon.path
    rootURI = [string]$addon.rootURI
    reason = ""
  }
}

$profiles = @()
if (Test-Path -LiteralPath $profileRoot) {
  foreach ($profile in Get-ChildItem -LiteralPath $profileRoot -Directory) {
    $profiles += [ordered]@{
      name = $profile.Name
      path = $profile.FullName
      proxy = Get-ProxyInfo -ProfilePath $profile.FullName
      registration = Get-ExtensionRegistration -ProfilePath $profile.FullName
    }
  }
}

$tempChildren = @()
if (Test-Path -LiteralPath $tempRoot) {
  $tempChildren = Get-ChildItem -LiteralPath $tempRoot -Force | ForEach-Object {
    [ordered]@{
      path = $_.FullName
      mode = $_.Mode
      lastWriteTime = $_.LastWriteTime.ToString("s")
      bytes = if ($_.PSIsContainer) { Get-DirectorySize -Path $_.FullName } else { $_.Length }
    }
  }
}

$status = [ordered]@{
  addonID = $addonID
  workspace = $root
  zoteroProcesses = @(Get-Process -Name Zotero -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ id = $_.Id; startTime = $_.StartTime.ToString("s"); path = $_.Path }
  })
  xpi = [ordered]@{
    path = $xpiPath
    exists = [bool](Test-Path -LiteralPath $xpiPath)
    sha256 = if (Test-Path -LiteralPath $shaPath) { (Get-Content -Encoding ASCII -LiteralPath $shaPath -Raw).Trim() } elseif (Test-Path -LiteralPath $xpiPath) { (Get-FileHash -Algorithm SHA256 -LiteralPath $xpiPath).Hash.ToLowerInvariant() } else { "" }
  }
  profiles = $profiles
  temp = [ordered]@{
    path = $tempRoot
    exists = [bool](Test-Path -LiteralPath $tempRoot)
    childCount = @($tempChildren).Count
    bytes = Get-DirectorySize -Path $tempRoot
    children = $tempChildren
  }
}

$status | ConvertTo-Json -Depth 8
