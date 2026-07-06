$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$statusScript = Join-Path $root "scripts\runtime-status.ps1"

function Invoke-Status {
  $jsonText = & powershell -ExecutionPolicy Bypass -File $statusScript
  if ($LASTEXITCODE -ne 0) {
    throw "runtime-status.ps1 failed with exit code $LASTEXITCODE"
  }
  return ($jsonText | ConvertFrom-Json)
}

$status = Invoke-Status
$failures = New-Object System.Collections.Generic.List[string]
$zoteroProcessCount = if ($null -ne $status.zoteroProcessCount) {
  [int]$status.zoteroProcessCount
}
elseif ($null -eq $status.zoteroProcesses) {
  0
}
else {
  @($status.zoteroProcesses).Count
}

if ($zoteroProcessCount -eq 0) {
  $failures.Add("Zotero is not running. Start Zotero before reader smoke.")
}

foreach ($profile in $status.profiles) {
  if (!$profile.proxy.exists) {
    $failures.Add("Extension proxy missing in profile $($profile.name). Run npm run install:global.")
  }
  elseif ($profile.proxy.hasBOM) {
    $failures.Add("Extension proxy has BOM in profile $($profile.name). Run npm run install:global.")
  }
  elseif ($profile.proxy.target -ne $status.workspace) {
    $failures.Add("Extension proxy target mismatch in profile $($profile.name): $($profile.proxy.target)")
  }

  if ($profile.rescan.needsRescan) {
    $failures.Add("Extension scan cache still needs clearing in profile $($profile.name). Close Zotero and run npm run install:global.")
  }

  if (!$profile.registration.registered) {
    $failures.Add("Plugin is not registered in profile $($profile.name): $($profile.registration.reason)")
    if ($profile.source -and $profile.source.developmentProxy) {
      $devProxy = $profile.source.developmentProxy
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
          $failures.Add("Proxy target manifest strict_max_version is unexpected in profile $($profile.name): $($devProxy.manifest.strictMaxVersion)")
        }
        $missingPayload = @($devProxy.manifest.missingPayload)
        if ($missingPayload.Count) {
          $failures.Add("Proxy target payload missing in profile $($profile.name): $($missingPayload -join ', ')")
        }
      }
    }
    if ($profile.webExtensionUUID -and $profile.webExtensionUUID.present) {
      $failures.Add("Profile has WebExtension UUID for plugin but extensions.json registration is missing in profile $($profile.name).")
    }
    if ($profile.startupCache -and $profile.startupCache.addonStartup.exists -and !$profile.startupCache.containsAddonID) {
      $failures.Add("Zotero startup cache does not contain plugin id in profile $($profile.name).")
    }
  }
  elseif (!$profile.registration.active) {
    $failures.Add("Plugin is registered but inactive in profile $($profile.name).")
  }
}

if ($status.temp.childCount -ne 0) {
  $failures.Add("Temp root has leftover children: $($status.temp.childCount)")
}

if ($failures.Count) {
  foreach ($failure in $failures) {
    Write-Host "preflight fail: $failure"
  }
  exit 1
}

Write-Host "smoke preflight ok"
