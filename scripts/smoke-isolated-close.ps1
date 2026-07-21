param(
  [int]$StartupDelaySeconds = 8,
  [int]$ExitTimeoutSeconds = 25,
  [string[]]$AdditionalExtensionPaths = @()
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$tempRoot = Join-Path $env:TEMP ("pdf-image-saver-isolated-" + [guid]::NewGuid().ToString("N"))
$profilePath = Join-Path $tempRoot "profile"
$dataPath = Join-Path $tempRoot "data"
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $profilePath "extensions"), $dataPath | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "outputs\pdf-image-saver-$((Get-Content -Encoding UTF8 -Raw (Join-Path $root "manifest.json") | ConvertFrom-Json).version).xpi") -Destination (Join-Path $profilePath "extensions\pdf-image-saver@zlk.local.xpi")
  foreach ($extensionPath in $AdditionalExtensionPaths) {
    if (!(Test-Path -LiteralPath $extensionPath -PathType Leaf)) {
      throw "Additional extension not found: $extensionPath"
    }
    Copy-Item -LiteralPath $extensionPath -Destination (Join-Path (Join-Path $profilePath "extensions") ([IO.Path]::GetFileName($extensionPath)))
  }
  $escapedDataPath = $dataPath.Replace('\', '\\')
  @(
    'user_pref("extensions.zotero.useDataDir", true);'
    ('user_pref("extensions.zotero.dataDir", "{0}");' -f $escapedDataPath)
    'user_pref("extensions.zotero.firstRun2", false);'
    'user_pref("extensions.checkUpdateSecurity", false);'
  ) | Set-Content -Encoding ASCII -LiteralPath (Join-Path $profilePath "prefs.js")
  $offscreenStore = [ordered]@{
    "chrome://zotero/content/zoteroPane.xhtml" = [ordered]@{
      "main-window" = [ordered]@{
        screenX = "-32000"
        screenY = "-32000"
        width = "1015"
        height = "607"
        sizemode = "normal"
      }
    }
  } | ConvertTo-Json -Depth 4
  [IO.File]::WriteAllText((Join-Path $profilePath "xulstore.json"), $offscreenStore, [Text.UTF8Encoding]::new($false))
  & powershell -ExecutionPolicy Bypass -File (Join-Path $root "scripts\smoke-one-close.ps1") -ProfilePath $profilePath -StartupDelaySeconds $StartupDelaySeconds -ExitTimeoutSeconds $ExitTimeoutSeconds
  if ($LASTEXITCODE -ne 0) { throw "isolated close smoke failed with exit code $LASTEXITCODE" }
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Write-Host "isolated smoke artifacts retained for recoverable inspection: $tempRoot"
  }
}
