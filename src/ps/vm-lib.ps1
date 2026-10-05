# Shared helpers for the Vector Magic automation engine (dot-sourced). Pure ASCII.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class VmWin {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
}
"@

$AE = [System.Windows.Automation.AutomationElement]
$TRUE_COND = [System.Windows.Automation.Condition]::TrueCondition
$REG_ROOT = 'HKCU:\Software\Vector Magic\Vector Magic Desktop Edition'
$log = New-Object System.Collections.Generic.List[string]
function Log([string]$m) { $log.Add(('{0:HH:mm:ss.fff} {1}' -f (Get-Date), $m)) }

function Write-Result($obj) {
  $obj['log'] = $log.ToArray()
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText($ResultPath, $json, (New-Object System.Text.UTF8Encoding $false))
}

# ---------------------------------------------------------------- registry ---
$REG_NATIVE = 'HKCU\Software\Vector Magic\Vector Magic Desktop Edition'
$script:regBackupFile = $null
# reg.exe via Start-Process: in PS 5.1, '2>&1' on a native exe + ErrorAction Stop turns its stderr into a terminating error.
function Invoke-Reg([string[]]$argv) {
  $p = Start-Process -FilePath 'reg.exe' -ArgumentList $argv -Wait -PassThru -WindowStyle Hidden
  return $p.ExitCode
}
function Backup-Reg([string]$dir) {
  $script:regBackupFile = Join-Path $dir 'vm-settings-backup.reg'
  if ((Invoke-Reg @('export', ('"' + $REG_NATIVE + '"'), ('"' + $script:regBackupFile + '"'), '/y')) -ne 0) { $script:regBackupFile = $null; Log 'no existing settings to back up' }
}
function Set-Reg([string]$sub, [string]$name, [string]$value) {
  $key = if ($sub) { "$REG_ROOT\$sub" } else { $REG_ROOT }
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Set-ItemProperty -Path $key -Name $name -Value $value -Type String
}
# Restores the user's Vector Magic settings exactly (also drops MRU entries pointing at our temp dir).
function Restore-Reg {
  if (-not $script:regBackupFile -or -not (Test-Path $script:regBackupFile)) { return }
  Invoke-Reg @('delete', ('"' + $REG_NATIVE + '"'), '/f') | Out-Null
  if ((Invoke-Reg @('import', ('"' + $script:regBackupFile + '"'))) -ne 0) { Log 'WARNING: settings restore failed' }
}

# --------------------------------------------------------------- ui helpers --
function Get-MainWindow([int]$procId) {
  $c = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $procId)
  foreach ($w in $AE::RootElement.FindAll('Children', $c)) {
    if ($w.Current.ClassName -eq 'QWidget' -and $w.Current.Name -like '*Vector Magic*') { return $w }
  }
  return $null
}
function Get-OtherWindows([int]$procId) {
  $c = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $procId)
  @($AE::RootElement.FindAll('Children', $c) | Where-Object { -not ($_.Current.ClassName -eq 'QWidget' -and $_.Current.Name -like '*Vector Magic*') -and $_.Current.ClassName -ne 'SysShadow' })
}
function Find-Named($root, [string]$name) {
  $c = New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, $name)
  @($root.FindAll('Descendants', $c) | Where-Object { $_.Current.BoundingRectangle.Width -gt 0 -and -not $_.Current.IsOffscreen })
}
function Get-Rect($el) { $el.Current.BoundingRectangle }
function Post-Click($hwndEl, [double]$sx, [double]$sy) {
  $hwnd = [IntPtr]$hwndEl.Current.NativeWindowHandle
  $pt = New-Object VmWin+POINT; $pt.X = [int]$sx; $pt.Y = [int]$sy
  [VmWin]::ScreenToClient($hwnd, [ref]$pt) | Out-Null
  $lp = [IntPtr](($pt.Y -shl 16) -bor ($pt.X -band 0xFFFF))
  [VmWin]::PostMessage($hwnd, 0x0200, [IntPtr]0, $lp) | Out-Null
  [VmWin]::PostMessage($hwnd, 0x0201, [IntPtr]1, $lp) | Out-Null
  Start-Sleep -Milliseconds 80
  [VmWin]::PostMessage($hwnd, 0x0202, [IntPtr]0, $lp) | Out-Null
}
# Click in CLIENT coordinates of the top-level window (no UI Automation needed).
function Post-ClientClick($hwndEl, [int]$cx, [int]$cy) {
  $hwnd = [IntPtr]$hwndEl.Current.NativeWindowHandle
  $lp = [IntPtr](($cy -shl 16) -bor ($cx -band 0xFFFF))
  [VmWin]::PostMessage($hwnd, 0x0200, [IntPtr]0, $lp) | Out-Null
  [VmWin]::PostMessage($hwnd, 0x0201, [IntPtr]1, $lp) | Out-Null
  Start-Sleep -Milliseconds 80
  [VmWin]::PostMessage($hwnd, 0x0202, [IntPtr]0, $lp) | Out-Null
}
function Get-ClientSize($win) {
  $r = New-Object VmWin+RECT; [VmWin]::GetClientRect([IntPtr]$win.Current.NativeWindowHandle, [ref]$r) | Out-Null
  return @{ W = $r.R - $r.L; H = $r.B - $r.T }
}
# Move the window off-screen without activating it (SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE).
function Move-OffScreen($win) {
  [VmWin]::SetWindowPos([IntPtr]$win.Current.NativeWindowHandle, [IntPtr]::Zero, -6000, 30, 0, 0, 0x0001 -bor 0x0004 -bor 0x0010) | Out-Null
}
# The wizard sidebar is a fixed 357 px column on the right edge of the client area (v1.15).
$SIDEBAR_W = 357
function Click-FullyAutomatic($win) {
  $sb = Find-Named $win 'wizard_button_0'
  if ($sb.Count -gt 0) { Click-Element $win $sb[0] 'fully-automatic'; return }
  $cs = Get-ClientSize $win
  $cx = $cs.W - $SIDEBAR_W + 171; $cy = 99
  Log "fully-automatic via client fallback at $cx,$cy (client $($cs.W)x$($cs.H))"
  Post-ClientClick $win $cx $cy
}
function Click-Element($win, $el, [string]$label) {
  $r = Get-Rect $el
  Log "click $label at $([int]($r.X + $r.Width / 2)),$([int]($r.Y + $r.Height / 2))"
  Post-Click $win ($r.X + $r.Width / 2) ($r.Y + $r.Height / 2)
}
# PrintWindow capture (works off-screen). With -CropName, crop to that widget (e.g. vm_main_view).
function Save-Snapshot($win, [string]$path, [string]$CropName) {
  try {
    $h = [IntPtr]$win.Current.NativeWindowHandle
    $r = New-Object VmWin+RECT; [VmWin]::GetWindowRect($h, [ref]$r) | Out-Null
    $bmp = New-Object System.Drawing.Bitmap ([Math]::Max(1, $r.R - $r.L)), ([Math]::Max(1, $r.B - $r.T))
    $g = [System.Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc()
    [VmWin]::PrintWindow($h, $hdc, 2) | Out-Null
    $g.ReleaseHdc($hdc); $g.Dispose()
    if ($CropName) {
      $el = Find-Named $win $CropName
      if ($el.Count -gt 0) {
        $er = Get-Rect $el[0]
        $x = [Math]::Max(0, [int]($er.X - $r.L)); $y = [Math]::Max(0, [int]($er.Y - $r.T))
        $w = [Math]::Min($bmp.Width - $x, [int]$er.Width - 17); $hh = [Math]::Min($bmp.Height - $y, [int]$er.Height - 17)  # minus scrollbars
        if ($w -gt 10 -and $hh -gt 10) {
          $c = $bmp.Clone((New-Object System.Drawing.Rectangle($x, $y, $w, $hh)), $bmp.PixelFormat); $bmp.Dispose(); $bmp = $c
        }
      }
    }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    return $path
  } catch { Log "snapshot failed: $_"; return $null }
}

# Page detection by widget structure (language independent).
function Get-Page($win) {
  if ($win.Current.Name -match '^\s*\d+%') { return 'busy' }          # "37% - file.png - Vector Magic"
  $page = Find-Named $win 'wizard_page'
  if ($page.Count -eq 0) { return 'unknown' }
  $p = $page[0]
  $wb0 = @(Find-Named $p 'wizard_button_0').Count
  $wb1 = @(Find-Named $p 'wizard_button_1').Count
  $wb2 = @(Find-Named $p 'wizard_button_2').Count
  $toggles = @(Find-Named $p 'toggle_groupbox').Count
  $custom = @(Find-Named $p 'custom_groupbox').Count
  # Signatures measured on v1.15:
  #   start  : wizard_button_0/1/2 (Fully automatic / Basic / Advanced)
  #   review : custom_groupbox (detail/colours) + wizard_button_0 (Review done), no toggle groups
  #   export : >= 3 toggle_groupbox (Quick save / Bitmap export / Export options) + wizard_button_1 (Save as)
  if ($toggles -ge 3) { return 'export' }
  if ($custom -ge 1 -and $wb0 -eq 1 -and $toggles -eq 0) { return 'review' }
  if ($wb0 -eq 1 -and $wb1 -eq 1 -and $wb2 -eq 1) { return 'start' }
  $wb = $wb0 + $wb1 + $wb2
  return "other(wb=$wb,toggles=$toggles,custom=$custom)"
}
# Run $action, then wait for one of $want pages. If the page has not changed (nor started
# processing) after $retryAfterSec, the click was probably swallowed: retry it.
function Invoke-Step($procId, [scriptblock]$action, [string[]]$want, [int]$timeoutSec, [switch]$RequireBusy, [int]$retries = 3, [int]$retryAfterSec = 6) {
  for ($i = 1; $i -le $retries; $i++) {
    & $action (Get-MainWindow $procId)
    $deadline = (Get-Date).AddSeconds($retryAfterSec)
    while ((Get-Date) -lt $deadline) {
      Assert-NoDialog $procId
      $win = Get-MainWindow $procId
      if ($win) {
        $pg = Get-Page $win
        if (-not $RequireBusy -and $want -contains $pg) { Log "page=$pg"; return $win }
        if ($pg -eq 'busy') { Log 'page=busy'; return Wait-Page $procId $want $timeoutSec }
      }
      Start-Sleep -Milliseconds 400
    }
    Log "no page change after click, retry $i"
    if ($RequireBusy) { break }  # re-running is not idempotent-safe to spam; verify via status bar instead
  }
  if ($RequireBusy) {
    $win = Get-MainWindow $procId
    if ($win -and ($want -contains (Get-Page $win))) { Log 'processing not observed (fast image?), continuing'; return $win }
  }
  throw "Timeout waiting for page [$($want -join ',')] after $retries clicks"
}
function Assert-NoDialog($procId) {
  if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { throw 'Vector Magic exited unexpectedly.' }
  $dlg = Get-OtherWindows $procId | Where-Object { $_.Current.ClassName -ne 'QPopup' }
  if ($dlg.Count -gt 0) { throw "Unexpected dialog: [$($dlg[0].Current.Name)] class=$($dlg[0].Current.ClassName)" }
}
function Wait-Page($procId, [string[]]$want, [int]$timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  $last = ''
  while ((Get-Date) -lt $deadline) {
    Assert-NoDialog $procId
    $win = Get-MainWindow $procId
    if ($win) {
      $pg = Get-Page $win
      if ($pg -ne $last) { Log "page=$pg"; $last = $pg }
      if ($want -contains $pg) { return $win }
    }
    Start-Sleep -Milliseconds 400
  }
  throw "Timeout waiting for page [$($want -join ',')] (last=$last)"
}
# Buttons inside a groupbox sorted top->bottom
function Get-GroupButtons($groupbox) {
  @($groupbox.FindAll('Descendants', $TRUE_COND) | Where-Object {
      $r = $_.Current.BoundingRectangle; $r.Width -gt 0 -and $r.Height -ge 18 -and $r.Height -le 26
    } | Sort-Object { $_.Current.BoundingRectangle.Y }, { $_.Current.BoundingRectangle.X })
}


# ------------------------------------------------------------------- OCR -----
# The status bar text ("400x400 (0.2 megapixel) Basic:Smooth artwork, Low, 6 colors") is not
# exposed through UI Automation, so it is read with the built-in Windows OCR (Windows.Media.Ocr).
$script:ocrReady = $false
function Initialize-Ocr {
  if ($script:ocrReady) { return $true }
  try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
    $script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    $script:ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $script:ocrReady = $null -ne $script:ocrEngine
  } catch { Log "OCR unavailable: $_"; $script:ocrReady = $false }
  return $script:ocrReady
}
function Await-WinRt($op, [Type]$t) { $task = $script:asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
function Read-StatusBar($win) {
  if (-not (Initialize-Ocr)) { return $null }
  $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'vmmcp-sb-' + [guid]::NewGuid().ToString('N') + '.png')
  try {
    $h = [IntPtr]$win.Current.NativeWindowHandle
    $wr = New-Object VmWin+RECT; [VmWin]::GetWindowRect($h, [ref]$wr) | Out-Null
    $full = New-Object System.Drawing.Bitmap ($wr.R - $wr.L), ($wr.B - $wr.T)
    $g = [System.Drawing.Graphics]::FromImage($full); $hdc = $g.GetHdc(); [VmWin]::PrintWindow($h, $hdc, 2) | Out-Null; $g.ReleaseHdc($hdc); $g.Dispose()
    $sbEl = (Find-Named $win 'status_bar')
    if ($sbEl.Count -gt 0) { $sr = Get-Rect $sbEl[0]; $y = [int]($sr.Y - $wr.T); $hgt = [int]$sr.Height } else { $hgt = 22; $y = $full.Height - $hgt - 8 }
    $w = [Math]::Min(760, $full.Width)
    $crop = $full.Clone((New-Object System.Drawing.Rectangle(0, $y, $w, $hgt)), $full.PixelFormat)
    $big = New-Object System.Drawing.Bitmap ($w * 3), ($hgt * 3)
    $g2 = [System.Drawing.Graphics]::FromImage($big); $g2.InterpolationMode = 'HighQualityBicubic'; $g2.DrawImage($crop, 0, 0, $big.Width, $big.Height); $g2.Dispose()
    $big.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png); $big.Dispose(); $crop.Dispose(); $full.Dispose()
    $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await-WinRt ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await-WinRt ($script:ocrEngine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    $stream.Dispose()
    return ($res.Text -replace '\s+', ' ').Trim()
  } catch { Log "OCR failed: $_"; return $null }
  finally { Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue }
}
# Localised detail words as shown in the status bar (es, en, de, fr, it). OCR drops letters
# ("Medo" for "Medio"), so only the first 3 letters of each comma-separated part are compared.
$DETAIL_WORDS = @{
  high   = @('Alto', 'High', 'Hoch', 'Haut', 'Elevato')
  medium = @('Medio', 'Medium', 'Mittel', 'Moyen')
  low    = @('Bajo', 'Low', 'Niedrig', 'Bas', 'Basso')
}
function Test-Detail([string]$status, [string]$detail) {
  if (-not $status) { return $null }
  $parts = @($status -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -ge 3 })
  foreach ($w in $DETAIL_WORDS[$detail]) {
    $prefix = $w.Substring(0, 3)
    foreach ($p in $parts) { if ($p.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $true } }
  }
  return $false
}
