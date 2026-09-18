$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$statusScript = Join-Path $root "scripts\runtime-status.ps1"
$addonID = "pdf-image-saver@zlk.local"
$expectedRuntime = "Zotero 10.x"
$expectedStrictMaxVersion = "11.*"

function Invoke-Status {
  $jsonText = & powershell -ExecutionPolicy Bypass -File $statusScript
  if ($LASTEXITCODE -ne 0) {
    throw "runtime-status.ps1 failed with exit code $LASTEXITCODE"
  }
  return ($jsonText | ConvertFrom-Json)
}

function Test-ProfileSourceValid {
  param($Profile)
  $devProxy = if ($Profile.source) { $Profile.source.developmentProxy } else { $null }
  $xpiInstall = if ($Profile.source) { $Profile.source.xpiInstall } else { $null }
  $missingPayload = if ($devProxy -and $devProxy.manifest -and $null -ne $devProxy.manifest.missingPayload) {
    @($devProxy.manifest.missingPayload)
  }
  else {
    @()
  }
  $devProxyValid = [bool](
    $devProxy -and
    $devProxy.exists -and
    $devProxy.targetExists -and
    $devProxy.targetIsDirectory -and
    !$devProxy.hasBOM -and
    $devProxy.manifest -and
    $devProxy.manifest.manifestReadable -and
    $devProxy.manifest.idMatches -and
    $devProxy.manifest.strictMaxVersionExpected -and
    ($missingPayload.Count -eq 0)
  )
  $xpiInstallValid = [bool](
    $xpiInstall -and
    $xpiInstall.exists -and
    $xpiInstall.manifestReadable -and
    $xpiInstall.idMatches -and
    $xpiInstall.strictMaxVersionExpected
  )
  return [ordered]@{
    developmentProxy = $devProxyValid
    profileXPI = $xpiInstallValid
  }
}

$status = Invoke-Status
$readyProfiles = 0
$registeredProfiles = 0

$xpiHint = if ($status.xpi.exists) { $status.xpi.path } else { "(not built; run npm.cmd run package:manual)" }

Write-Host "manual install verify"
Write-Host "expected runtime: $expectedRuntime"
Write-Host "expected strict_max_version: $expectedStrictMaxVersion"
Write-Host "addon: $addonID"
Write-Host "xpi version: $($status.xpi.version)"
Write-Host "xpi: $xpiHint"
Write-Host "xpi exists: $($status.xpi.exists)"
Write-Host "sha256: $($status.xpi.sha256)"
if (@($status.xpi.staleNames).Count -gt 0) {
  Write-Host "ignored other-version XPIs: $(@($status.xpi.staleNames) -join ', ')"
}
Write-Host "zotero process count: $($status.zoteroProcessCount)"
Write-Host "temp children: $($status.temp.childCount)"
Write-Host "preferred handoff: $($status.summary.preferredHandoff)"
Write-Host "summary ready profiles: $($status.summary.readyProfiles)"

foreach ($profile in $status.profiles) {
  $source = Test-ProfileSourceValid -Profile $profile
  $registered = [bool]$profile.registration.registered
  $active = [bool]$profile.registration.active
  if ($registered) {
    $registeredProfiles += 1
  }
  if ($registered -and $active) {
    $readyProfiles += 1
  }

  $mode = if ($source.developmentProxy) {
    "development-proxy"
  }
  elseif ($source.profileXPI) {
    "profile-xpi"
  }
  elseif ($registered) {
    "registered-only"
  }
  else {
    "none"
  }

  Write-Host ""
  Write-Host "profile: $($profile.name)"
  Write-Host "install mode: $mode"
  Write-Host "registered: $registered"
  Write-Host "active: $active"
  Write-Host "registration path: $($profile.registration.path)"
  Write-Host "registration rootURI: $($profile.registration.rootURI)"
  Write-Host "dev proxy source valid: $($source.developmentProxy)"
  Write-Host "profile XPI source valid: $($source.profileXPI)"
  Write-Host "rescan needed: $($profile.rescan.needsRescan)"

  if (!$registered) {
    Write-Host "next: on $expectedRuntime use Tools > Add-ons > gear > Install Add-on From File... and select $xpiHint"
  }
  elseif (!$active) {
    Write-Host "next: enable the add-on in Zotero Add-ons, then restart Zotero if requested."
  }
  elseif ($profile.rescan.needsRescan -and $source.developmentProxy -and !$source.profileXPI) {
    Write-Host "next: registration is active; for development-proxy installs only, rescan prefs can be cleared by closing Zotero and running npm.cmd run install:global."
  }
  elseif ($profile.rescan.needsRescan) {
    Write-Host "next: registration is active; rescan prefs are informational for manual/XPI installs on $expectedRuntime."
  }
  else {
    Write-Host "next: run npm.cmd run smoke:preflight, then open a PDF reader and test Clip."
  }
}

Write-Host ""
Write-Host "registered profiles: $registeredProfiles"
Write-Host "ready profiles: $readyProfiles"
if ($readyProfiles -gt 0) {
  Write-Host "manual install status: ready"
}
else {
  Write-Host "manual install status: pending"
}
