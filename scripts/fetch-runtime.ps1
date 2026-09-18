# Stage the self-contained vector runtime into content/runtime so the packaged XPI works on a
# machine that has no Python and no PyMuPDF installed.
#
# The Windows embeddable Python ships without pip, so the PyMuPDF wheel is unpacked straight into
# a site-packages directory and pointed at by python313._pth. Nothing here is committed: the
# directory is gitignored and rebuilt on demand.
param(
  [string]$PythonVersion = "3.13.15",
  [string]$PyMuPDFVersion = "1.28.2"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$runtimeRoot = Join-Path $root "content\runtime"

# Packaging calls this first every time, so an unchanged runtime must be a no-op rather than a
# fresh 30 MB download.
$expectedVersion = "python$PythonVersion-pymupdf$PyMuPDFVersion"
$existingManifest = Join-Path $runtimeRoot "runtime-manifest.json"
if ((Test-Path $existingManifest) -and (Test-Path (Join-Path $runtimeRoot "python\python.exe"))) {
  try {
    $current = Get-Content -Path $existingManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($current.version -eq $expectedVersion) {
      Write-Output ("runtime already staged: " + $expectedVersion)
      Write-Output "runtime staged"
      exit 0
    }
  } catch {
    Write-Output "warning: runtime manifest unreadable, restaging"
  }
}
$pythonRoot = Join-Path $runtimeRoot "python"
$sitePackages = Join-Path $pythonRoot "site-packages"
$staging = Join-Path $env:TEMP ("pdf-image-saver-runtime-" + [guid]::NewGuid().ToString("N"))

function Get-RuntimeFile {
  param([string]$Uri, [string]$Destination)
  if (Test-Path $Destination) {
    Write-Output ("cached: " + (Split-Path -Leaf $Destination))
    return
  }
  Write-Output ("download: " + $Uri)
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing
}

New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
  $pythonZip = Join-Path $staging ("python-$PythonVersion-embed-amd64.zip")
  $wheel = Join-Path $staging "pymupdf.whl"
  $shortVersion = ($PythonVersion -split "\.")[0] + ($PythonVersion -split "\.")[1]

  Get-RuntimeFile -Uri "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip" -Destination $pythonZip

  # The wheel filename is version specific, so ask PyPI where the Windows abi3 build lives rather
  # than guessing a hashed URL that changes with every release.
  $wheelUrl = $null
  try {
    $metadata = Invoke-RestMethod -Uri "https://pypi.org/pypi/pymupdf/$PyMuPDFVersion/json" -UseBasicParsing
    foreach ($file in $metadata.urls) {
      if ($file.filename -like "*win_amd64.whl") {
        $wheelUrl = $file.url
        break
      }
    }
  } catch {
    Write-Output "warning: could not query PyPI for the wheel URL"
  }
  if (-not $wheelUrl) {
    throw "Could not resolve the PyMuPDF Windows wheel URL."
  }
  Get-RuntimeFile -Uri $wheelUrl -Destination $wheel

  Write-Output "staging python"
  if (Test-Path $pythonRoot) { Remove-Item -Recurse -Force $pythonRoot }
  if (Test-Path $sitePackages) { Remove-Item -Recurse -Force $sitePackages }
  New-Item -ItemType Directory -Force -Path $pythonRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $sitePackages | Out-Null
  Expand-Archive -Path $pythonZip -DestinationPath $pythonRoot -Force

  Write-Output "staging pymupdf"
  # A wheel is a zip, but Expand-Archive only accepts the .zip extension, so give it one.
  $wheelZip = Join-Path $staging "pymupdf.zip"
  Copy-Item -Path $wheel -Destination $wheelZip -Force
  $wheelStaging = Join-Path $staging "wheel"
  Expand-Archive -Path $wheelZip -DestinationPath $wheelStaging -Force
  Copy-Item -Path (Join-Path $wheelStaging "*") -Destination $sitePackages -Recurse -Force

  # sys.path for an embeddable interpreter comes from this file, and site-packages is ours.
  $pth = Join-Path $pythonRoot ("python$shortVersion._pth")
  Set-Content -Path $pth -Value @("python$shortVersion.zip", ".", "site-packages") -Encoding ASCII
  Write-Output ("wrote " + $pth)

  # The plugin cannot walk a packaged directory, so ship the exact file list with the version.
  $files = Get-ChildItem -Path $pythonRoot -Recurse -File | ForEach-Object {
    $_.FullName.Substring($runtimeRoot.Length + 1).Replace("\", "/")
  }
  $manifest = @{
    version = "python$PythonVersion-pymupdf$PyMuPDFVersion"
    interpreter = "python/python.exe"
    files = @($files)
  }
  $manifestPath = Join-Path $runtimeRoot "runtime-manifest.json"
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

  $bytes = (Get-ChildItem -Path $pythonRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
  Write-Output ("runtime ready: " + $manifest.version + "; " + $files.Count + " files; " + [math]::Round($bytes / 1MB, 1) + " MB")
  Write-Output "runtime staged"
} finally {
  Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
}
