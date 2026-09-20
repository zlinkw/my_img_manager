param(
  [ValidateSet("Proxy", "XPI")]
  [string]$InstallMode = "Proxy"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
. (Join-Path $PSScriptRoot "current-xpi.ps1")
$addonId = "pdf-image-saver@zlk.local"
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root "manifest.json") | ConvertFrom-Json
$addonVersion = [string]$manifest.version
$profileRoot = Join-Path $env:APPDATA "Zotero\Zotero\Profiles"
$zoteroRunning = [bool](Get-Process -Name Zotero -ErrorAction SilentlyContinue)

function Enable-ExtensionDirectoryRescan {
  param(
    [string]$ProfilePath,
    [string]$RetryCommand
  )

  $prefsPath = Join-Path $ProfilePath "prefs.js"
  if (!(Test-Path -LiteralPath $prefsPath)) {
    return "prefs.js missing; Zotero will create it on next launch"
  }
  if ($zoteroRunning) {
    return "pending: Zotero is running; close Zotero and rerun $RetryCommand once to remove extension scan cache prefs"
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

function Install-DevelopmentProxy {
  param([string]$ProfilePath)

  $extensionsDir = Join-Path $ProfilePath "extensions"
  $proxyPath = Join-Path $extensionsDir $addonId
  $profileXPIPath = Join-Path $extensionsDir "$addonId.xpi"
  if ((Test-Path -LiteralPath $profileXPIPath) -and !$zoteroRunning) {
    Remove-Item -LiteralPath $profileXPIPath -Force
  }
  elseif (Test-Path -LiteralPath $profileXPIPath) {
    Write-Host "source switch: pending: Zotero is running; close Zotero and rerun npm.cmd run install:global to remove profile XPI fallback before writing proxy"
    return $false
  }
  Set-Content -Encoding ASCII -NoNewline -LiteralPath $proxyPath -Value $root
  Write-Host "installed proxy $proxyPath -> $root"
  return $true
}

function Install-ProfileXPI {
  param([string]$ProfilePath)

  $xpiPath = Assert-CurrentXpiPath -Root $root -Action "npm.cmd run build"
  & pwsh.exe -ExecutionPolicy Bypass -NoProfile -File (Join-Path $PSScriptRoot "check-xpi.ps1") -XpiPath $xpiPath | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "XPI payload check failed; refusing to install into a Zotero profile: $xpiPath"
  }
  $extensionsDir = Join-Path $ProfilePath "extensions"
  $proxyPath = Join-Path $extensionsDir $addonId
  $profileXPIPath = Join-Path $extensionsDir "$addonId.xpi"
  if ($zoteroRunning) {
    Write-Host "source switch: pending: Zotero is running; close Zotero and rerun npm.cmd run install:xpi to copy profile XPI fallback"
    return $false
  }
  if (Test-Path -LiteralPath $proxyPath) {
    Remove-Item -LiteralPath $proxyPath -Force
  }
  Copy-Item -LiteralPath $xpiPath -Destination $profileXPIPath -Force
  & node (Join-Path $PSScriptRoot "register-profile-xpi.mjs") @(
    $ProfilePath,
    $profileXPIPath,
    $addonId,
    $addonVersion
  )
  if ($LASTEXITCODE -ne 0) {
    throw "Profile XPI registration failed with exit code $LASTEXITCODE for $($profile.Name)"
  }
  Install-BundledRuntime -ProfilePath $ProfilePath
  Install-HelperScript -ProfilePath $ProfilePath
  Write-Host "installed xpi $profileXPIPath <- $xpiPath"
  return $true
}

function Install-BundledRuntime {
  param([string]$ProfilePath)

  $sourceRoot = Join-Path $root "content\runtime"
  $manifestPath = Join-Path $sourceRoot "runtime-manifest.json"
  $runtimeManifest = Get-Content -Encoding UTF8 -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  $targetRoot = Join-Path $ProfilePath "pdf-image-saver\runtime"
  $stampPath = Join-Path $targetRoot "runtime-version.txt"
  $interpreterPath = Join-Path $targetRoot ([string]$runtimeManifest.interpreter)
  $stamp = if (Test-Path -LiteralPath $stampPath -PathType Leaf) { (Get-Content -Encoding UTF8 -Raw -LiteralPath $stampPath).Trim() } else { "" }
  if ($stamp -eq [string]$runtimeManifest.version -and (Test-Path -LiteralPath $interpreterPath -PathType Leaf)) {
    Write-Host "bundled runtime ready: $interpreterPath"
    return
  }

  $canonicalSourceRoot = [IO.Path]::GetFullPath($sourceRoot).TrimEnd("\") + "\"
  $canonicalTargetRoot = [IO.Path]::GetFullPath($targetRoot).TrimEnd("\") + "\"
  $copies = foreach ($relative in @($runtimeManifest.files)) {
    $name = [string]$relative
    if (!$name -or [IO.Path]::IsPathRooted($name) -or $name -match '(^|[\\/])\.\.([\\/]|$)') {
      throw "Invalid bundled runtime path: $name"
    }
    $source = [IO.Path]::GetFullPath((Join-Path $sourceRoot $name))
    $target = [IO.Path]::GetFullPath((Join-Path $targetRoot $name))
    if (!$source.StartsWith($canonicalSourceRoot, [StringComparison]::OrdinalIgnoreCase) -or
        !$target.StartsWith($canonicalTargetRoot, [StringComparison]::OrdinalIgnoreCase) -or
        !(Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Bundled runtime payload missing or outside expected directory: $name"
    }
    [pscustomobject]@{ source = $source; target = $target }
  }
  foreach ($copy in $copies) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $copy.target) | Out-Null
    Copy-Item -LiteralPath $copy.source -Destination $copy.target -Force
  }
  & $interpreterPath -X utf8 -c "import pymupdf, vtracer; print(pymupdf.VersionBind, vtracer.__file__)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Bundled PDF/vector runtime verification failed: $interpreterPath" }
  [IO.File]::WriteAllText($stampPath, [string]$runtimeManifest.version, [Text.UTF8Encoding]::new($false))
  Write-Host "bundled runtime installed: $interpreterPath"
}

function Install-HelperScript {
  param([string]$ProfilePath)

  $source = Join-Path $root "content\helper\pdf_image_extract.py"
  $target = Join-Path $ProfilePath "pdf-image-saver\helper\pdf_image_extract.py"
  if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Bundled PDF helper missing: $source" }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash) {
    throw "Bundled PDF helper verification failed: $target"
  }
  Write-Host "bundled helper installed: $target"
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
  $retryCommand = if ($InstallMode -eq "XPI") { "npm.cmd run install:xpi" } else { "npm.cmd run install:global" }
  if ($InstallMode -eq "XPI") {
    $sourceReady = Install-ProfileXPI -ProfilePath $profile.FullName
  }
  else {
    $sourceReady = Install-DevelopmentProxy -ProfilePath $profile.FullName
  }
  $rescan = Enable-ExtensionDirectoryRescan -ProfilePath $profile.FullName -RetryCommand $retryCommand
  Write-Host "extension rescan: $rescan"
  if (!$sourceReady) {
    Write-Host "install source: pending; no source switch was performed for profile $($profile.Name)"
  }
}
