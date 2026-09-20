$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$statusScript = Join-Path $root "scripts\runtime-status.ps1"
$expectedRuntime = "Zotero 10.x"
$expectedStrictMaxVersion = "11.*"

function Invoke-Status {
  $jsonText = & pwsh.exe -ExecutionPolicy Bypass -NoProfile -File $statusScript
  if ($LASTEXITCODE -ne 0) {
    throw "runtime-status.ps1 failed with exit code $LASTEXITCODE"
  }
  return ($jsonText | ConvertFrom-Json)
}

function Test-DevProxyValid {
  param($Profile)
  $devProxy = if ($Profile.source) { $Profile.source.developmentProxy } else { $null }
  $devMissingPayload = if ($devProxy -and $devProxy.manifest -and $null -ne $devProxy.manifest.missingPayload) {
    @($devProxy.manifest.missingPayload)
  }
  else {
    @()
  }
  return [bool](
    $devProxy -and
    $devProxy.exists -and
    $devProxy.targetExists -and
    $devProxy.targetIsDirectory -and
    !$devProxy.hasBOM -and
    $Profile.proxy.target -eq $status.workspace -and
    $devProxy.manifest -and
    $devProxy.manifest.manifestReadable -and
    $devProxy.manifest.idMatches -and
    $devProxy.manifest.strictMaxVersionExpected -and
    ($devMissingPayload.Count -eq 0)
  )
}

function Test-XpiInstallValid {
  param($Profile)
  $xpiInstall = if ($Profile.source) { $Profile.source.xpiInstall } else { $null }
  return [bool](
    $xpiInstall -and
    $xpiInstall.exists -and
    $xpiInstall.manifestReadable -and
    $xpiInstall.idMatches -and
    $xpiInstall.strictMaxVersionExpected
  )
}

$status = Invoke-Status
$failures = New-Object System.Collections.Generic.List[string]
$readyProfiles = 0
$zoteroProcessCount = if ($null -ne $status.zoteroProcessCount) {
  [int]$status.zoteroProcessCount
}
elseif ($null -eq $status.zoteroProcesses) {
  0
}
else {
  @($status.zoteroProcesses).Count
}

Write-Host "smoke preflight"
Write-Host "expected runtime: $expectedRuntime"
Write-Host "expected strict_max_version: $expectedStrictMaxVersion"
Write-Host "addon: $($status.addonID)"
Write-Host "zotero process count: $zoteroProcessCount"
Write-Host "preferred handoff: $($status.summary.preferredHandoff)"

if ($zoteroProcessCount -eq 0) {
  $failures.Add("Zotero is not running. Start $expectedRuntime before reader smoke.")
}

foreach ($profile in $status.profiles) {
  $devProxy = if ($profile.source) { $profile.source.developmentProxy } else { $null }
  $xpiInstall = if ($profile.source) { $profile.source.xpiInstall } else { $null }
  $devProxyValid = Test-DevProxyValid -Profile $profile
  $xpiInstallValid = Test-XpiInstallValid -Profile $profile
  $registered = [bool]($profile.registration -and $profile.registration.registered)
  $active = [bool]($profile.registration -and $profile.registration.active)
  $installMode = if ($devProxyValid) {
    "development-proxy"
  }
  elseif ($xpiInstallValid) {
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
  Write-Host "install mode: $installMode"
  Write-Host "registered: $registered"
  Write-Host "active: $active"
  Write-Host "rescan needed: $($profile.rescan.needsRescan)"

  if (!$devProxyValid -and !$xpiInstallValid -and !$registered) {
    $failures.Add("No valid extension source in profile $($profile.name). Prefer Zotero Tools > Add-ons manual XPI install on $expectedRuntime, or run npm.cmd run install:global for development proxy.")
    if (!$profile.proxy.exists -and !($xpiInstall -and $xpiInstall.exists)) {
      $failures.Add("Extension proxy and XPI source are both missing in profile $($profile.name).")
    }
    elseif ($profile.proxy.exists) {
      if ($profile.proxy.hasBOM) {
        $failures.Add("Extension proxy has BOM in profile $($profile.name). Run npm.cmd run install:global.")
      }
      elseif ($profile.proxy.target -ne $status.workspace) {
        $failures.Add("Extension proxy target mismatch in profile $($profile.name): $($profile.proxy.target)")
      }
    }
  }

  # Rescan cache only blocks development-proxy installs. Manual/XPI registration can stay usable with lastApp prefs present.
  if ($profile.rescan.needsRescan -and $devProxyValid -and !$registered) {
    $failures.Add("Development proxy still needs extension scan-cache clear in profile $($profile.name). Close Zotero and run npm.cmd run install:global.")
  }
  elseif ($profile.rescan.needsRescan -and $registered) {
    Write-Host "rescan note: lastApp prefs present; treated as informational because registration is already present."
  }

  if (!$registered) {
    $failures.Add("Plugin is not registered in profile $($profile.name): $($profile.registration.reason)")
    if ($devProxy) {
      if (!$devProxy.exists) {
        $failures.Add("Development proxy source is missing in profile $($profile.name).")
      }
      elseif (!$devProxy.targetExists) {
        $failures.Add("Development proxy target is missing in profile $($profile.name): $($devProxy.target)")
      }
      elseif (!$devProxy.targetIsDirectory) {
        $failures.Add("Development proxy target is not a directory in profile $($profile.name): $($devProxy.target)")
      }
      elseif ($devProxy.manifest) {
        if (!$devProxy.manifest.manifestReadable) {
          $failures.Add("Proxy target manifest is unreadable in profile $($profile.name): $($devProxy.manifest.manifestError)")
        }
        elseif (!$devProxy.manifest.idMatches) {
          $failures.Add("Proxy target manifest id mismatch in profile $($profile.name): $($devProxy.manifest.id)")
        }
        elseif (!$devProxy.manifest.strictMaxVersionExpected) {
          $failures.Add("Proxy target manifest strict_max_version is unexpected in profile $($profile.name): $($devProxy.manifest.strictMaxVersion). Expected $expectedStrictMaxVersion for $expectedRuntime.")
        }
        $missingPayload = if ($null -ne $devProxy.manifest.missingPayload) { @($devProxy.manifest.missingPayload) } else { @() }
        if ($missingPayload.Count) {
          $failures.Add("Proxy target payload missing in profile $($profile.name): $($missingPayload -join ', ')")
        }
      }
    }
    if ($xpiInstall -and $xpiInstall.exists -and !$xpiInstall.strictMaxVersionExpected) {
      $failures.Add("Profile XPI strict_max_version is unexpected in profile $($profile.name): $($xpiInstall.strictMaxVersion). Expected $expectedStrictMaxVersion for $expectedRuntime.")
    }
    if ($profile.webExtensionUUID -and $profile.webExtensionUUID.present) {
      $failures.Add("Profile has WebExtension UUID for plugin but extensions.json registration is missing in profile $($profile.name).")
    }
  }
  elseif (!$active) {
    $failures.Add("Plugin is registered but inactive in profile $($profile.name). Enable it in Zotero Add-ons.")
  }
  else {
    $readyProfiles += 1
  }
}

if ($status.temp.childCount -ne 0) {
  $failures.Add("Temp root has leftover children: $($status.temp.childCount)")
}

if ($readyProfiles -eq 0) {
  $failures.Add("No ready $expectedRuntime profile has registered+active pdf-image-saver@zlk.local.")
}

Write-Host ""
Write-Host "ready profiles: $readyProfiles"

if ($failures.Count) {
  foreach ($failure in $failures) {
    Write-Host "preflight fail: $failure"
  }
  exit 1
}

Write-Host "smoke preflight ok"
