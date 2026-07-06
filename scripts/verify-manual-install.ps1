$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$statusScript = Join-Path $root "scripts\runtime-status.ps1"
$addonID = "pdf-image-saver@zlk.local"

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

Write-Host "manual install verify"
Write-Host "addon: $addonID"
Write-Host "xpi: $($status.xpi.path)"
Write-Host "xpi exists: $($status.xpi.exists)"
Write-Host "sha256: $($status.xpi.sha256)"
Write-Host "zotero process count: $($status.zoteroProcessCount)"
Write-Host "temp children: $($status.temp.childCount)"

foreach ($profile in $status.profiles) {
  $source = Test-ProfileSourceValid -Profile $profile
  $registered = [bool]$profile.registration.registered
  $active = [bool]$profile.registration.active
  if ($registered -and $active) {
    $readyProfiles += 1
  }

  Write-Host ""
  Write-Host "profile: $($profile.name)"
  Write-Host "registered: $registered"
  Write-Host "active: $active"
  Write-Host "registration path: $($profile.registration.path)"
  Write-Host "registration rootURI: $($profile.registration.rootURI)"
  Write-Host "dev proxy source valid: $($source.developmentProxy)"
  Write-Host "profile XPI source valid: $($source.profileXPI)"
  Write-Host "rescan needed: $($profile.rescan.needsRescan)"

  if (!$registered) {
    Write-Host "next: install the XPI through Zotero Tools > Add-ons > gear > Install Add-on From File..."
  }
  elseif (!$active) {
    Write-Host "next: enable the add-on in Zotero Add-ons, then restart Zotero if requested."
  }
  elseif ($profile.rescan.needsRescan) {
    Write-Host "next: registration is active; rescan prefs are informational for this manual install state."
  }
  else {
    Write-Host "next: run npm.cmd run smoke:preflight, then open a PDF reader and test Clip Figure."
  }
}

Write-Host ""
if ($readyProfiles -gt 0) {
  Write-Host "manual install status: ready"
}
else {
  Write-Host "manual install status: pending"
}
