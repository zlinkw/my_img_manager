$ErrorActionPreference = "Stop"

function Get-CurrentXpiInfo {
  param([Parameter(Mandatory = $true)][string]$Root)

  $manifestPath = Join-Path $Root "manifest.json"
  if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json missing: $manifestPath"
  }
  $version = [string]((Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json).version)
  if (!$version) {
    throw "manifest.json has no version: $manifestPath"
  }

  $outputDir = Join-Path $Root "outputs"
  $prefix = "pdf-image-saver-$version"
  $recoveryPrefix = "$prefix-recovery-"
  $current = @()
  $stale = @()
  if (Test-Path -LiteralPath $outputDir -PathType Container) {
    foreach ($file in (Get-ChildItem -LiteralPath $outputDir -File -ErrorAction SilentlyContinue)) {
      if ($file.Extension -ne ".xpi") { continue }
      if ($file.BaseName -eq $prefix -or $file.BaseName.StartsWith($recoveryPrefix, [StringComparison]::Ordinal)) {
        $current += $file
      }
      elseif ($file.BaseName.StartsWith("pdf-image-saver-", [StringComparison]::Ordinal)) {
        $stale += $file
      }
    }
  }

  $selected = $current | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $path = if ($selected) { $selected.FullName } else { "" }
  $shaPath = if ($path) { "$path.sha256" } else { "" }

  return [ordered]@{
    version = $version
    path = $path
    exists = [bool]$path
    bytes = if ($selected) { [long]$selected.Length } else { 0 }
    sha256Path = $shaPath
    sha256 = if ($shaPath -and (Test-Path -LiteralPath $shaPath -PathType Leaf)) {
      (Get-Content -Encoding ASCII -Raw -LiteralPath $shaPath).Trim().ToLowerInvariant()
    }
    elseif ($path) {
      (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
    }
    else { "" }
    candidateCount = @($current).Count
    staleNames = @($stale | Sort-Object Name | ForEach-Object { $_.Name })
    outputDir = $outputDir
  }
}

function Get-CurrentXpiPath {
  param([Parameter(Mandatory = $true)][string]$Root)
  return [string](Get-CurrentXpiInfo -Root $Root).path
}

function Assert-CurrentXpiPath {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [string]$Action = "npm.cmd run build"
  )
  $info = Get-CurrentXpiInfo -Root $Root
  if (!$info.exists) {
    $stale = if (@($info.staleNames).Count -gt 0) {
      " Other-version XPIs present and deliberately ignored: " + (@($info.staleNames) -join ", ") + "."
    }
    else { "" }
    throw "No XPI for current version $($info.version) under $($info.outputDir). Run $Action first.$stale"
  }
  return [string]$info.path
}
