param([string]$XpiPath = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
. (Join-Path $PSScriptRoot "current-xpi.ps1")

if (!$XpiPath) {
  $XpiPath = Assert-CurrentXpiPath -Root $root -Action "npm.cmd run build"
}

if (!(Test-Path -LiteralPath $XpiPath -PathType Leaf)) {
  throw "XPI missing: $XpiPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($XpiPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName })
  foreach ($entry in $entries) {
    if ($entry.Contains("\")) {
      throw "XPI entry uses Windows path separator: $entry"
    }
  }

  $required = @(
    "manifest.json",
    "bootstrap.js",
    "prefs.js",
    "preferences.xhtml",
    "README.md",
    "content/pdf-image-saver.js",
    "content/preferences.js",
    "content/helper/pdf_image_extract.py",
    "content/icons/pdf-image-saver.svg",
    "content/vendor/openseadragon.min.js",
    "content/vendor/fabric.min.js",
    "defaults/preferences/prefs.js"
  )

  foreach ($path in $required) {
    if ($entries -notcontains $path) {
      throw "XPI missing required payload: $path"
    }
  }

  $runtimeEntry = $archive.GetEntry("content/pdf-image-saver.js")
  if (!$runtimeEntry -or $runtimeEntry.Length -eq 0) {
    throw "XPI runtime entry is missing or empty: content/pdf-image-saver.js"
  }
  $runtimeStream = $runtimeEntry.Open()
  try {
    if ($runtimeStream.ReadByte() -lt 0) {
      throw "XPI runtime entry is unreadable: content/pdf-image-saver.js"
    }
  }
  finally {
    $runtimeStream.Dispose()
  }

  $blockedPrefixes = @("work/", "outputs/", "tests/", ".git/", "scripts/")
  foreach ($entry in $entries) {
    foreach ($prefix in $blockedPrefixes) {
      if ($entry.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "XPI includes development-only payload: $entry"
      }
    }
  }

  $machinePathPatterns = @(
    "(?i)[A-Z]:[\\/]+Users[\\/]+",
    "(?i)[A-Z]:[\\/]+.*[\\/]Documents[\\/]Codex[\\/]"
  )
  foreach ($entry in $archive.Entries) {
    # The self-contained vector runtime is a packaged interpreter plus PyMuPDF, so its files are
    # legitimately large; everything else still has to stay small.
    $isRuntime = $entry.FullName.StartsWith("content/runtime/", [StringComparison]::OrdinalIgnoreCase)
    if ((-not $isRuntime) -and ($entry.Length -gt 2MB)) {
      throw "Unexpected large XPI entry: $($entry.FullName)"
    }
    if ($entry.Length -eq 0) {
      continue
    }
    $stream = $entry.Open()
    try {
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $true)
      $text = $reader.ReadToEnd()
      foreach ($pattern in $machinePathPatterns) {
        if ($text -match $pattern) {
          throw "XPI contains machine-specific path in $($entry.FullName): $pattern"
        }
      }
    }
    finally {
      $stream.Dispose()
    }
  }
}
finally {
  $archive.Dispose()
}

Write-Host "xpi payload ok"
