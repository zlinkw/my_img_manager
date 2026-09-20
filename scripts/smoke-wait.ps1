param(
  [int]$TimeoutSeconds = 300,
  [int]$IntervalSeconds = 5
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$preflight = Join-Path $root "scripts\smoke-preflight.ps1"
$deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
$lastOutput = ""

do {
  $output = & pwsh.exe -ExecutionPolicy Bypass -NoProfile -File $preflight 2>&1
  $exitCode = $LASTEXITCODE
  $lastOutput = ($output | Out-String).Trim()
  if ($exitCode -eq 0) {
    Write-Host $lastOutput
    exit 0
  }
  if ((Get-Date) -ge $deadline) {
    break
  }
  Start-Sleep -Seconds ([Math]::Max(1, $IntervalSeconds))
} while ($true)

Write-Host "smoke wait timed out after $TimeoutSeconds seconds"
if ($lastOutput) {
  Write-Host $lastOutput
}
exit 1
