$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$xpiPath = Join-Path $root "outputs\pdf-image-saver-0.1.0.xpi"

if (!(Test-Path -LiteralPath $xpiPath)) {
  throw "XPI missing: $xpiPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($xpiPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName -replace "\\", "/" })
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
    "defaults/preferences/prefs.js"
  )

  foreach ($path in $required) {
    if ($entries -notcontains $path) {
      throw "XPI missing required payload: $path"
    }
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
    if ($entry.Length -gt 2MB) {
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
