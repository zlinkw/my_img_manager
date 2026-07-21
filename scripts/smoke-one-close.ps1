param(
  [int]$StartupDelaySeconds = 8,
  [int]$ExitTimeoutSeconds = 20,
  [Parameter(Mandatory = $true)][string]$ProfilePath
)

$ErrorActionPreference = "Stop"
$zoteroProcesses = @(Get-Process -Name Zotero -ErrorAction SilentlyContinue)
if ($zoteroProcesses.Count) {
  throw "Zotero is already running. Close it before the one-close smoke test."
}

$zoteroExe = @(
  "$env:ProgramFiles\Zotero\zotero.exe",
  "${env:ProgramFiles(x86)}\Zotero\zotero.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (!$zoteroExe) {
  throw "Zotero executable not found."
}

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class ZoteroWindowInfo {
  public IntPtr Handle { get; set; }
  public int ProcessId { get; set; }
  public string Title { get; set; }
  public string ClassName { get; set; }
  public int Width { get; set; }
  public int Height { get; set; }
  public bool Visible { get; set; }
  public int Area { get { return Width * Height; } }
}

public static class ZoteroWindowProbe {
  private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int maxCount);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int maxCount);

  [DllImport("user32.dll")]
  private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hwnd);

  [DllImport("user32.dll")]
  private static extern bool ShowWindow(IntPtr hwnd, int command);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool SetWindowPos(
    IntPtr hwnd,
    IntPtr insertAfter,
    int x,
    int y,
    int width,
    int height,
    uint flags
  );

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

  public static ZoteroWindowInfo[] Find(int[] processIds) {
    var ids = new HashSet<uint>();
    foreach (var processId in processIds) ids.Add((uint)processId);
    var windows = new List<ZoteroWindowInfo>();
    EnumWindows((hwnd, lParam) => {
      uint processId;
      GetWindowThreadProcessId(hwnd, out processId);
      if (!ids.Contains(processId)) return true;
      var title = new StringBuilder(512);
      GetWindowText(hwnd, title, title.Capacity);
      var className = new StringBuilder(256);
      GetClassName(hwnd, className, className.Capacity);
      RECT rect;
      GetWindowRect(hwnd, out rect);
      windows.Add(new ZoteroWindowInfo {
        Handle = hwnd,
        ProcessId = (int)processId,
        Title = title.ToString(),
        ClassName = className.ToString(),
        Width = Math.Max(0, rect.Right - rect.Left),
        Height = Math.Max(0, rect.Bottom - rect.Top),
        Visible = IsWindowVisible(hwnd)
      });
      return true;
    }, IntPtr.Zero);
    return windows.ToArray();
  }

  public static bool RequestClose(IntPtr hwnd) {
    return PostMessage(hwnd, 0x0010, IntPtr.Zero, IntPtr.Zero);
  }

  public static bool Hide(IntPtr hwnd) {
    return ShowWindow(hwnd, 0);
  }

  public static bool MoveOffscreen(IntPtr hwnd) {
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_NOACTIVATE = 0x0010;
    return SetWindowPos(hwnd, IntPtr.Zero, -32000, -32000, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
  }

  public static void ShowWithoutActivation(IntPtr hwnd) {
    ShowWindow(hwnd, 8);
  }
}
"@

function Get-CurrentZoteroProcesses {
  return @(Get-Process -Name Zotero -ErrorAction SilentlyContinue)
}

function Get-ZoteroWindows {
  param($Processes)
  $ids = @($Processes | ForEach-Object { $_.Id })
  if (!$ids.Count) {
    return @()
  }
  return @([ZoteroWindowProbe]::Find([int[]]$ids))
}

function Park-ZoteroWindows {
  param($Processes)
  foreach ($window in @(Get-ZoteroWindows -Processes $Processes)) {
    if ($window.Visible) {
      [void][ZoteroWindowProbe]::MoveOffscreen($window.Handle)
    }
  }
}

function Prepare-ZoteroMainWindowForClose {
  param($Window)
  if (!$Window) {
    return $false
  }
  if (!$Window.Visible) {
    [ZoteroWindowProbe]::ShowWithoutActivation($Window.Handle)
  }
  return [ZoteroWindowProbe]::MoveOffscreen($Window.Handle)
}

function Get-XULStoreSnapshots {
  $paths = @(Join-Path $ProfilePath "xulstore.json")
  return @($paths | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object {
    [pscustomobject]@{
      path = $_
      bytes = [IO.File]::ReadAllBytes($_)
    }
  })
}

function Restore-XULStoreSnapshots {
  param($Snapshots)
  foreach ($snapshot in @($Snapshots)) {
    [IO.File]::WriteAllBytes($snapshot.path, $snapshot.bytes)
  }
}

function Stop-TestZoteroProcesses {
  $processes = Get-CurrentZoteroProcesses
  if (!$processes.Count) {
    return
  }
  foreach ($window in @(Get-ZoteroWindows -Processes $processes)) {
    [void][ZoteroWindowProbe]::Hide($window.Handle)
    [void][ZoteroWindowProbe]::RequestClose($window.Handle)
  }
  $graceDeadline = (Get-Date).AddSeconds(3)
  do {
    Start-Sleep -Milliseconds 200
    $processes = Get-CurrentZoteroProcesses
  } while ($processes.Count -and (Get-Date) -lt $graceDeadline)
  if ($processes.Count) {
    $processes | Stop-Process -Force
    $processes | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
  }
}

$xulStoreSnapshots = @(Get-XULStoreSnapshots)
try {
$startedAt = Get-Date
$sawStartupProgressWindow = $false
$startOptions = @{ FilePath = $zoteroExe; WindowStyle = "Hidden" }
if (!(Test-Path -LiteralPath $ProfilePath)) {
  New-Item -ItemType Directory -Path $ProfilePath -Force | Out-Null
}
$startOptions.ArgumentList = @("-no-remote", "-profile", (Resolve-Path -LiteralPath $ProfilePath).Path)
Start-Process @startOptions | Out-Null
$windowDeadline = (Get-Date).AddSeconds(25)
$mainWindow = $null
do {
  $processes = Get-CurrentZoteroProcesses
  $startupWindows = @(Get-ZoteroWindows -Processes $processes)
  if ($startupWindows | Where-Object { $_.Title -eq "进度" -or $_.Title -like "*Better BibTeX*" }) {
    $sawStartupProgressWindow = $true
  }
  Park-ZoteroWindows -Processes $processes
  $mainWindow = $startupWindows | Sort-Object Area -Descending | Select-Object -First 1
  if ($mainWindow) {
    break
  }
  Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $windowDeadline)

if (!$mainWindow) {
  Stop-TestZoteroProcesses
  throw "Zotero started without a top-level window."
}

$startupSettleDeadline = (Get-Date).AddSeconds([Math]::Max(1, $StartupDelaySeconds))
do {
  $startupProcesses = Get-CurrentZoteroProcesses
  $startupWindows = @(Get-ZoteroWindows -Processes $startupProcesses)
  if ($startupWindows | Where-Object { $_.Title -eq "进度" -or $_.Title -like "*Better BibTeX*" }) {
    $sawStartupProgressWindow = $true
  }
  Park-ZoteroWindows -Processes $startupProcesses
  Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $startupSettleDeadline)
$processesBeforeClose = Get-CurrentZoteroProcesses
$windowsBeforeClose = @(Get-ZoteroWindows -Processes $processesBeforeClose)
$mainWindow = $windowsBeforeClose | Sort-Object Area -Descending | Select-Object -First 1
if (!$mainWindow -or !(Prepare-ZoteroMainWindowForClose -Window $mainWindow) -or ![ZoteroWindowProbe]::RequestClose($mainWindow.Handle)) {
  Stop-TestZoteroProcesses
  throw "Could not send one WM_CLOSE request to the Zotero main window."
}

$closeStartedAt = Get-Date
$exitDeadline = $closeStartedAt.AddSeconds([Math]::Max(5, $ExitTimeoutSeconds))
$postCloseVisibleWindows = @()
do {
  $remaining = Get-CurrentZoteroProcesses
  foreach ($window in @(Get-ZoteroWindows -Processes $remaining)) {
    if (!$window.Visible -or $window.Handle -eq $mainWindow.Handle) {
      continue
    }
    $signature = "$($window.Title)|$($window.Width)|$($window.Height)"
    if (!($postCloseVisibleWindows | Where-Object { $_.signature -eq $signature })) {
      $postCloseVisibleWindows += [pscustomobject]@{
        signature = $signature
        title = $window.Title
        className = $window.ClassName
        width = $window.Width
        height = $window.Height
        firstSeenMilliseconds = [Math]::Round(((Get-Date) - $closeStartedAt).TotalMilliseconds)
      }
    }
  }
  Park-ZoteroWindows -Processes $remaining
  if (!$remaining.Count) {
    [ordered]@{
      ok = $true
      startupSeconds = [Math]::Round(($closeStartedAt - $startedAt).TotalSeconds, 2)
      exitSeconds = [Math]::Round(((Get-Date) - $closeStartedAt).TotalSeconds, 2)
      requestedWindow = [ordered]@{
        title = $mainWindow.Title
        width = $mainWindow.Width
        height = $mainWindow.Height
      }
      topLevelWindowCount = $windowsBeforeClose.Count
      sawStartupProgressWindow = $sawStartupProgressWindow
      postCloseVisibleWindows = $postCloseVisibleWindows
    } | ConvertTo-Json -Depth 4
    return
  }
  Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $exitDeadline)

$remainingWindows = @(Get-ZoteroWindows -Processes $remaining)
foreach ($window in $remainingWindows) {
  [void][ZoteroWindowProbe]::Hide($window.Handle)
  [void][ZoteroWindowProbe]::RequestClose($window.Handle)
}
$remainingDetails = $remainingWindows | ConvertTo-Json -Compress
Stop-TestZoteroProcesses
throw "Zotero remained running after one close request. Startup progress seen: $sawStartupProgressWindow. Remaining windows: $remainingDetails"
}
finally {
  Restore-XULStoreSnapshots -Snapshots $xulStoreSnapshots
}
