$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
. (Join-Path $PSScriptRoot "current-xpi.ps1")
$addonID = "pdf-image-saver@zlk.local"
$currentXpi = Get-CurrentXpiInfo -Root $root
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

function Format-ProcessDateTime {
  param($Value)
  if ($null -eq $Value) {
    return ""
  }
  try {
    return ([datetime]$Value).ToString("s")
  }
  catch {
    return ""
  }
}

function Get-ProcessPathSafe {
  param($Process)
  try {
    $path = $Process.Path
    if ($null -eq $path) {
      return ""
    }
    return [string]$path
  }
  catch {
    return ""
  }
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

function Get-FileStatus {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path)) {
    return [ordered]@{ exists = $false; path = $Path; bytes = 0; lastWriteTime = "" }
  }
  $item = Get-Item -LiteralPath $Path -Force
  return [ordered]@{
    exists = $true
    path = $item.FullName
    bytes = if ($item.PSIsContainer) { 0 } else { $item.Length }
    lastWriteTime = $item.LastWriteTime.ToString("s")
  }
}

function Test-BinaryFileContainsText {
  param(
    [string]$Path,
    [string]$Needle
  )
  if (!(Test-Path -LiteralPath $Path)) {
    return $false
  }
  $bytes = [IO.File]::ReadAllBytes($Path)
  if (!$bytes.Length) {
    return $false
  }
  return [Text.Encoding]::UTF8.GetString($bytes).Contains($Needle)
}

function Get-WebExtensionUUIDInfo {
  param([string]$ProfilePath)
  $prefsPath = Join-Path $ProfilePath "prefs.js"
  $uuid = ""
  $present = $false
  if (Test-Path -LiteralPath $prefsPath) {
    $line = Select-String -Encoding UTF8 -LiteralPath $prefsPath -Pattern '^\s*user_pref\("extensions\.webextensions\.uuids"' | Select-Object -First 1
    if ($line -and $line.Line -match '\\\"pdf-image-saver@zlk\.local\\\":\\\"([^\\\"]+)\\\"') {
      $present = $true
      $uuid = $Matches[1]
    }
  }
  return [ordered]@{
    present = $present
    uuid = $uuid
  }
}

function Get-DirectoryManifestInfo {
  param([string]$SourcePath)
  $requiredPayload = @(
    "manifest.json",
    "bootstrap.js",
    "prefs.js",
    "preferences.xhtml",
    "content\pdf-image-saver.js",
    "content\preferences.js",
    "content\icons\pdf-image-saver.svg",
    "defaults\preferences\prefs.js"
  )
  $optionalPayload = @(
    "content\helper\pdf_image_extract.py"
  )
  $missingPayload = @()
  foreach ($relativePath in $requiredPayload) {
    if (!(Test-Path -LiteralPath (Join-Path $SourcePath $relativePath))) {
      $missingPayload += $relativePath
    }
  }
  $optionalMissingPayload = @()
  foreach ($relativePath in $optionalPayload) {
    if (!(Test-Path -LiteralPath (Join-Path $SourcePath $relativePath))) {
      $optionalMissingPayload += $relativePath
    }
  }

  $manifestPath = Join-Path $SourcePath "manifest.json"
  $manifestReadable = $false
  $manifestError = ""
  $id = ""
  $version = ""
  $strictMinVersion = ""
  $strictMaxVersion = ""
  $description = ""
  if (Test-Path -LiteralPath $manifestPath) {
    try {
      $manifest = Get-Content -Encoding UTF8 -Raw -LiteralPath $manifestPath | ConvertFrom-Json
      $manifestReadable = $true
      $id = [string]$manifest.applications.zotero.id
      $version = [string]$manifest.version
      $strictMinVersion = [string]$manifest.applications.zotero.strict_min_version
      $strictMaxVersion = [string]$manifest.applications.zotero.strict_max_version
      $description = [string]$manifest.description
    }
    catch {
      $manifestError = $_.Exception.Message
    }
  }
  else {
    $manifestError = "manifest.json missing"
  }

  return [ordered]@{
    exists = [bool](Test-Path -LiteralPath $SourcePath)
    path = $SourcePath
    manifestPath = $manifestPath
    manifestReadable = $manifestReadable
    manifestError = $manifestError
    id = $id
    idMatches = $id -eq $addonID
    version = $version
    strictMinVersion = $strictMinVersion
    strictMaxVersion = $strictMaxVersion
    strictMaxVersionExpected = $strictMaxVersion -eq "9.0.*"
    description = $description
    missingPayload = $missingPayload
    optionalMissingPayload = $optionalMissingPayload
  }
}

function Get-XPIManifestInfo {
  param([string]$SourcePath)
  $status = Get-FileStatus -Path $SourcePath
  $manifestReadable = $false
  $manifestError = ""
  $id = ""
  $version = ""
  $strictMaxVersion = ""
  if ($status.exists) {
    try {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [System.IO.Compression.ZipFile]::OpenRead($SourcePath)
      try {
        $entry = $archive.GetEntry("manifest.json")
        if (!$entry) {
          $manifestError = "manifest.json missing"
        }
        else {
          $stream = $entry.Open()
          try {
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $true)
            $manifest = $reader.ReadToEnd() | ConvertFrom-Json
            $manifestReadable = $true
            $id = [string]$manifest.applications.zotero.id
            $version = [string]$manifest.version
            $strictMaxVersion = [string]$manifest.applications.zotero.strict_max_version
          }
          finally {
            $stream.Dispose()
          }
        }
      }
      finally {
        $archive.Dispose()
      }
    }
    catch {
      $manifestError = $_.Exception.Message
    }
  }
  return [ordered]@{
    exists = $status.exists
    path = $SourcePath
    bytes = $status.bytes
    lastWriteTime = $status.lastWriteTime
    manifestReadable = $manifestReadable
    manifestError = $manifestError
    id = $id
    idMatches = $id -eq $addonID
    version = $version
    strictMaxVersion = $strictMaxVersion
    strictMaxVersionExpected = $strictMaxVersion -eq "9.0.*"
  }
}

function Get-ExtensionSourceInfo {
  param(
    [string]$ProfilePath,
    $ProxyInfo
  )
  $xpiPath = Join-Path $ProfilePath "extensions\$addonID.xpi"
  $proxyTargetManifest = if ($ProxyInfo.exists -and (Test-Path -LiteralPath $ProxyInfo.target -PathType Container)) {
    Get-DirectoryManifestInfo -SourcePath $ProxyInfo.target
  }
  else {
    [ordered]@{
      exists = $false
      path = $ProxyInfo.target
      manifestPath = ""
      manifestReadable = $false
      manifestError = if ($ProxyInfo.exists) { "proxy target is not an existing directory" } else { "proxy file missing" }
      id = ""
      idMatches = $false
      version = ""
      strictMinVersion = ""
      strictMaxVersion = ""
      strictMaxVersionExpected = $false
      description = ""
      missingPayload = @()
      optionalMissingPayload = @()
    }
  }
  return [ordered]@{
    developmentProxy = [ordered]@{
      exists = $ProxyInfo.exists
      target = $ProxyInfo.target
      targetExists = [bool]($ProxyInfo.exists -and (Test-Path -LiteralPath $ProxyInfo.target))
      targetIsDirectory = [bool]($ProxyInfo.exists -and (Test-Path -LiteralPath $ProxyInfo.target -PathType Container))
      hasBOM = $ProxyInfo.hasBOM
      manifest = $proxyTargetManifest
    }
    xpiInstall = Get-XPIManifestInfo -SourcePath $xpiPath
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

function Get-ExtensionRescanInfo {
  param([string]$ProfilePath)
  $prefsPath = Join-Path $ProfilePath "prefs.js"
  $lastAppPrefs = @()
  if (Test-Path -LiteralPath $prefsPath) {
    $lastAppPrefs = @(Select-String -Encoding UTF8 -LiteralPath $prefsPath -Pattern '^\s*user_pref\("extensions\.lastApp(BuildId|Version)"' | ForEach-Object {
      $_.Line.Trim()
    })
  }
  return [ordered]@{
    prefsPath = $prefsPath
    lastAppPrefsPresent = [bool]$lastAppPrefs.Count
    lastAppPrefs = $lastAppPrefs
    needsRescan = [bool]$lastAppPrefs.Count
    action = if ($lastAppPrefs.Count) {
      "Close Zotero and rerun npm.cmd run install:global once so install script can clear extension scan cache prefs."
    }
    else {
      "Extension scan cache prefs are clear for next Zotero launch."
    }
  }
}

$profiles = @()
if (Test-Path -LiteralPath $profileRoot) {
  foreach ($profile in Get-ChildItem -LiteralPath $profileRoot -Directory) {
    $proxyInfo = Get-ProxyInfo -ProfilePath $profile.FullName
    $addonStartupPath = Join-Path $profile.FullName "addonStartup.json.lz4"
    $profiles += [ordered]@{
      name = $profile.Name
      path = $profile.FullName
      proxy = $proxyInfo
      registration = Get-ExtensionRegistration -ProfilePath $profile.FullName
      rescan = Get-ExtensionRescanInfo -ProfilePath $profile.FullName
      source = Get-ExtensionSourceInfo -ProfilePath $profile.FullName -ProxyInfo $proxyInfo
      webExtensionUUID = Get-WebExtensionUUIDInfo -ProfilePath $profile.FullName
      startupCache = [ordered]@{
        addonStartup = Get-FileStatus -Path $addonStartupPath
        rawBytesContainAddonID = Test-BinaryFileContainsText -Path $addonStartupPath -Needle $addonID
        note = "Weak hint only; addonStartup.json.lz4 is compressed and is not parsed here."
      }
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

$zoteroProcesses = @(Get-Process -Name Zotero -ErrorAction SilentlyContinue | ForEach-Object {
  [ordered]@{ id = $_.Id; startTime = Format-ProcessDateTime $_.StartTime; path = Get-ProcessPathSafe $_ }
})

$readyProfiles = @($profiles | Where-Object { $_.registration.registered -and $_.registration.active }).Count
$registeredProfiles = @($profiles | Where-Object { $_.registration.registered }).Count
$rescanProfiles = @($profiles | Where-Object { $_.rescan.needsRescan }).Count
$proxyReadyProfiles = @($profiles | Where-Object {
  $_.source.developmentProxy.exists -and
  $_.source.developmentProxy.targetExists -and
  $_.source.developmentProxy.targetIsDirectory -and
  !$_.source.developmentProxy.hasBOM -and
  $_.source.developmentProxy.manifest -and
  $_.source.developmentProxy.manifest.manifestReadable -and
  $_.source.developmentProxy.manifest.idMatches -and
  $_.source.developmentProxy.manifest.strictMaxVersionExpected -and
  @($_.source.developmentProxy.manifest.missingPayload).Count -eq 0
}).Count
$xpiReadyProfiles = @($profiles | Where-Object {
  $_.source.xpiInstall.exists -and
  $_.source.xpiInstall.manifestReadable -and
  $_.source.xpiInstall.idMatches -and
  $_.source.xpiInstall.strictMaxVersionExpected
}).Count

$status = [ordered]@{
  addonID = $addonID
  workspace = $root
  expectedRuntime = "Zotero 9.0.5"
  expectedStrictMaxVersion = "9.0.*"
  zoteroProcessCount = $zoteroProcesses.Count
  zoteroProcesses = $zoteroProcesses
  summary = [ordered]@{
    profileCount = @($profiles).Count
    registeredProfiles = $registeredProfiles
    readyProfiles = $readyProfiles
    proxyReadyProfiles = $proxyReadyProfiles
    xpiReadyProfiles = $xpiReadyProfiles
    rescanProfiles = $rescanProfiles
    installReady = [bool]($readyProfiles -gt 0)
    preferredHandoff = if ($readyProfiles -gt 0) {
      "registered"
    }
    elseif ($xpiReadyProfiles -gt 0 -or $currentXpi.exists) {
      "manual-xpi"
    }
    elseif ($proxyReadyProfiles -gt 0) {
      "development-proxy"
    }
    else {
      "none"
    }
  }
  xpi = [ordered]@{
    version = $currentXpi.version
    path = $currentXpi.path
    exists = $currentXpi.exists
    bytes = $currentXpi.bytes
    sha256 = $currentXpi.sha256
    candidateCount = $currentXpi.candidateCount
    staleNames = @($currentXpi.staleNames)
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
