param([string]$VTracerVersion = "0.6.15")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$runtimeRoot = Join-Path $root "content\runtime"
$manifestPath = Join-Path $runtimeRoot "runtime-manifest.json"
$manifest = Get-Content -Encoding UTF8 -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$pythonRoot = Join-Path $runtimeRoot "python"
$interpreter = Join-Path $pythonRoot "python.exe"
$sitePackages = Join-Path $pythonRoot "site-packages"
if (!(Test-Path -LiteralPath $interpreter -PathType Leaf)) { throw "Bundled Python is missing" }

$baseVersion = [string]$manifest.version -replace '-vtracer[^-]+$', ''
$expectedVersion = "$baseVersion-vtracer$VTracerVersion"
if ($manifest.version -match '-vtracer') {
  if ($manifest.version -eq $expectedVersion) {
    & $interpreter -X utf8 -c "import vtracer; print(vtracer.__file__)" | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Output "VTracer already staged"; exit 0 }
  }
  throw "Bundled VTracer version does not match requested version"
}

$metadata = Invoke-RestMethod -Uri "https://pypi.org/pypi/vtracer/$VTracerVersion/json" -UseBasicParsing
$wheel = @($metadata.urls | Where-Object { $_.filename -match '^vtracer-.*-cp313-cp313-win_amd64\.whl$' }) | Select-Object -First 1
if (!$wheel) { throw "VTracer CPython 3.13 Windows wheel not found" }
$wheelPath = Join-Path $env:TEMP ([string]$wheel.filename)
if (!(Test-Path -LiteralPath $wheelPath -PathType Leaf) -or
    (Get-FileHash -Algorithm SHA256 -LiteralPath $wheelPath).Hash -ne [string]$wheel.digests.sha256) {
  Invoke-WebRequest -Uri ([string]$wheel.url) -OutFile $wheelPath -UseBasicParsing
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $wheelPath).Hash -ne [string]$wheel.digests.sha256) {
  throw "VTracer wheel checksum mismatch"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($wheelPath, $sitePackages, $true)
& $interpreter -X utf8 -c "import pymupdf, vtracer; print(vtracer.__file__)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Bundled VTracer import failed" }

$files = Get-ChildItem -LiteralPath $pythonRoot -Recurse -File | ForEach-Object {
  $_.FullName.Substring($runtimeRoot.Length + 1).Replace("\", "/")
}
$updated = @{
  version = $expectedVersion
  interpreter = [string]$manifest.interpreter
  files = @($files)
}
[IO.File]::WriteAllText($manifestPath, ($updated | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
Write-Output ("VTracer staged: " + $updated.version)
