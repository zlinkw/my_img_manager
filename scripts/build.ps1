param(
  [switch]$Release
)

$ErrorActionPreference = "Stop"
$releaseOutput = [bool]$Release
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$outputDir = Join-Path $root "outputs"
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root "manifest.json") | ConvertFrom-Json
$version = [string]$manifest.version
$stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$buildRoot = Join-Path ([IO.Path]::GetTempPath()) "pdf-image-saver-build"
$buildDir = Join-Path $buildRoot "$version-$stamp\pdf-image-saver"
$xpiPath = Join-Path $outputDir "pdf-image-saver-$version-recovery-$stamp.xpi"
if ($releaseOutput) {
  $xpiPath = ("{0}\pdf-image-saver-{1}.xpi" -f $outputDir, $version)
}

Set-Location $root
function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @()
  )
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

Invoke-Native "pwsh.exe" @("-ExecutionPolicy", "Bypass", "-NoProfile", "-File", ".\scripts\check.ps1")

New-Item -ItemType Directory -Force -Path $buildDir, $outputDir | Out-Null

$paths = @(
  "manifest.json",
  "bootstrap.js",
  "prefs.js",
  "preferences.xhtml",
  "README.md",
  "content",
  "defaults"
)
foreach ($path in $paths) {
  Copy-Item -LiteralPath (Join-Path $root $path) -Destination $buildDir -Recurse -Force
}

$zipPath = Join-Path (Split-Path -Parent $buildDir) "pdf-image-saver-$version-recovery-$stamp.zip"

Add-Type -AssemblyName System.IO.Compression
$buildDirPrefix = [IO.Path]::GetFullPath($buildDir).TrimEnd("\") + "\"
$zipStream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $archive = [IO.Compression.ZipArchive]::new($zipStream, [IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    Get-ChildItem -LiteralPath $buildDir -Recurse -File |
      Where-Object { $_.FullName.Substring($buildDirPrefix.Length).Replace("\", "/") -ne "content/vendor/vendor-bundle.json" } |
      Sort-Object FullName |
      ForEach-Object {
        $entryName = $_.FullName.Substring($buildDirPrefix.Length).Replace("\", "/")
        $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
        $sourceStream = [IO.File]::OpenRead($_.FullName)
        try {
          $entryStream = $entry.Open()
          try {
            $sourceStream.CopyTo($entryStream)
          }
          finally {
            $entryStream.Dispose()
          }
        }
        finally {
          $sourceStream.Dispose()
        }
      }
  }
  finally {
    $archive.Dispose()
  }
}
finally {
  $zipStream.Dispose()
}
Move-Item -LiteralPath $zipPath -Destination $xpiPath -Force

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $hashBytes = $sha256.ComputeHash([System.IO.File]::ReadAllBytes($xpiPath))
  $hash = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
}
finally {
  $sha256.Dispose()
}
$hash | Set-Content -Encoding ASCII -LiteralPath "$xpiPath.sha256"

Invoke-Native "pwsh.exe" @("-ExecutionPolicy", "Bypass", "-NoProfile", "-File", ".\scripts\check-xpi.ps1", "-XpiPath", $xpiPath)

Write-Host "built $xpiPath"
