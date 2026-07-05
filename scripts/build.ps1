$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$outputDir = Join-Path $root "outputs"
$buildRoot = Join-Path $root "work\build"
$buildDir = Join-Path $buildRoot "pdf-image-saver"
$xpiPath = Join-Path $outputDir "pdf-image-saver-0.1.0.xpi"

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

Invoke-Native "powershell" @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\check.ps1")

if (Test-Path -LiteralPath $buildDir) {
  Remove-Item -LiteralPath $buildDir -Recurse -Force
}
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

if (Test-Path -LiteralPath $xpiPath) {
  Remove-Item -LiteralPath $xpiPath -Force
}

$zipPath = Join-Path $outputDir "pdf-image-saver-0.1.0.zip"
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Push-Location $buildDir
Compress-Archive -Path * -DestinationPath $zipPath -Force
Pop-Location
Move-Item -LiteralPath $zipPath -Destination $xpiPath -Force

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $xpiPath
$hash.Hash.ToLowerInvariant() | Set-Content -Encoding ASCII -LiteralPath (Join-Path $outputDir "pdf-image-saver-0.1.0.sha256")

Invoke-Native "powershell" @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\check-xpi.ps1")

Write-Host "built $xpiPath"
