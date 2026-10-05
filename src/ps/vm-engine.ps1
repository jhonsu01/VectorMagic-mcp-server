# Vector Magic Desktop Edition automation engine.
# Drives vmde.exe (Qt 4 GUI, no CLI) through UI Automation + posted window messages.
# Input:  -ParamsPath <json>   Output: -ResultPath <json>
# Pure ASCII on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
param(
  [Parameter(Mandatory = $true)][string]$ParamsPath,
  [Parameter(Mandatory = $true)][string]$ResultPath
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'vm-lib.ps1')

# ------------------------------------------------------------------- main ----
$params = Get-Content -Raw -Encoding UTF8 $ParamsPath | ConvertFrom-Json
$result = @{ success = $false; warnings = @() }
$procId = $null
$workDir = $null
try {
  $exe = $params.exePath
  if (-not (Test-Path $exe)) { throw "vmde.exe not found at: $exe" }
  $inPath = $params.inputPath
  if (-not (Test-Path $inPath)) { throw "Input image not found: $inPath" }

  # Isolated work dir: quick-save writes next to the loaded image with the same base name.
  $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("vmmcp-" + [guid]::NewGuid().ToString('N').Substring(0, 12))
  New-Item -ItemType Directory -Path $workDir | Out-Null
  $base = 'vm_input'
  $srcExt = [System.IO.Path]::GetExtension($inPath)
  $workImage = Join-Path $workDir ($base + $srcExt)
  Copy-Item -LiteralPath $inPath -Destination $workImage
  Backup-Reg $workDir

  $fmt = $params.format.ToLower()
  $isBitmap = @('png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff', 'ppm', 'xpm') -contains $fmt

  # Deterministic window geometry + all needed groups expanded + export options.
  Set-Reg 'VmQt' 'is_maximized' 'false'
  Set-Reg 'VmQt' 'size' '@Size(1280 960)'
  Set-Reg 'VmQt' 'pos' '@Point(40 30)'
  Set-Reg 'VmQt' 'skip_trouble_shooting' 'false'
  Set-Reg 'VmQt::MainModel::ToggleGroupBox:classic_quick_save_widget' 'expanded' 'true'
  Set-Reg 'VmQt::MainModel::ToggleGroupBox:bitmap_size_widget' 'expanded' 'true'
  Set-Reg 'VmQt::MainModel::ToggleGroupBox:classic_export_options_widget' 'expanded' 'true'
  Set-Reg 'VmQt::MainModel' 'cake_stack_mode' ([string][int]$params.shapeMode)
  Set-Reg 'VmQt::MainModel' 'shape_stroking_mode' ([string][int]$params.strokeMode)
  Set-Reg 'VmQt::MainModel' 'dxf_mode' ([string][int]$params.dxfMode)
  if ($isBitmap) {
    Set-Reg '' 'bitmap_size_widgetextension' $fmt
  } else {
    Set-Reg '' 'classic_quick_save_widgetextension' $fmt
  }

  Log "launch $exe"
  $proc = Start-Process -FilePath $exe -ArgumentList ('"' + $workImage + '"') -PassThru
  $procId = $proc.Id
  $result['pid'] = $procId

  # Start page. On a fresh process Qt often does not expose the wizard children through
  # UI Automation until the first interaction, so the first click may use client coordinates.
  $deadline = (Get-Date).AddSeconds([int]$params.loadTimeoutSec)
  $win = $null
  while ((Get-Date) -lt $deadline) {
    $win = Get-MainWindow $procId
    if ($win -and $win.Current.Name -like "*$base*") { break }
    if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { throw 'Vector Magic exited during startup.' }
    $dlg = Get-BlockingDialog $procId
    if ($dlg) { throw "Unexpected dialog at startup: [$($dlg.Current.Name)] class=$($dlg.Current.ClassName)" }
    $win = $null
    Start-Sleep -Milliseconds 400
  }
  if (-not $win) { throw 'Vector Magic main window did not appear (image may be unsupported or too large).' }
  # Off-screen by default: clicks are posted messages and snapshots use PrintWindow, so the window
  # does not need to be visible (Qt clamps an off-screen saved position, hence SetWindowPos).
  if (-not $params.showWindow) { Move-OffScreen $win; Log 'moved off-screen' }
  Start-Sleep -Milliseconds 1500
  $win = Invoke-Step $procId { param($w) Click-FullyAutomatic $w } @('review') ([int]$params.vectorizeTimeoutSec)

  # Review page tweaks: detail level and colours re-run the vectorization.
  $groups = @{}
  # Group buttons by sub-block (detail = 3 stacked narrow buttons; colours = 2 stacked)
  $status = Read-StatusBar $win
  Log "status: $status"
  if ($params.detail -and $params.detail -ne 'auto') {
    if ((Test-Detail $status $params.detail) -eq $true) { Log "detail already $($params.detail)" }
    else {
      $ok = $false
      for ($try = 1; $try -le 3 -and -not $ok; $try++) {
        $detailBtns = @(Get-ReviewButtons $win 50 70 | Select-Object -First 3)
        if ($detailBtns.Count -ne 3) { throw "Detail buttons not found ($($detailBtns.Count))." }
        $idx = @{ high = 0; medium = 1; low = 2 }[$params.detail]
        $win = Invoke-Step $procId { param($w) Click-Element $w $detailBtns[$idx] "detail=$($params.detail)" } @('review') ([int]$params.vectorizeTimeoutSec) -RequireBusy
        Start-Sleep -Milliseconds 500
        $new = Read-StatusBar $win
        Log "status: $new"
        $check = Test-Detail $new $params.detail
        $ok = ($check -eq $true) -or ($null -eq $check) -or ($check -eq $false -and $new -ne $status -and $try -ge 2)
        $status = $new
      }
      if (-not $ok) { $result['warnings'] += , "Could not confirm detail level '$($params.detail)' from the status bar." }
    }
  }
  if ($params.colors -eq 'unlimited') {
    $colorBtns = @(Get-ReviewButtons $win 120 160 | Select-Object -First 2)
    if ($colorBtns.Count -lt 1) { throw 'Colour buttons not found.' }
    $win = Invoke-Step $procId { param($w) Click-Element $w $colorBtns[0] 'colors=unlimited' } @('review') ([int]$params.vectorizeTimeoutSec) -RequireBusy
    Start-Sleep -Milliseconds 500
    $new = Read-StatusBar $win
    Log "status: $new"
    if ($new -and $new -eq $status) { $result['warnings'] += , 'Status bar did not change after selecting unlimited colours.' }
    $status = $new
  }
  $result['summary'] = $status

  # Go to export page
  $win = Invoke-Step $procId { param($w) Click-Element $w (Find-Named $w 'wizard_button_0')[0] 'review-done' } @('export') 30
  Start-Sleep -Milliseconds 500

  if ($params.previewPath) {
    Start-Sleep -Milliseconds 400
    $result['previewPath'] = Save-Snapshot $win $params.previewPath -CropName 'vm_main_view'
  }

  $page = (Find-Named $win 'wizard_page')[0]
  $groups = @(Find-Named $page 'toggle_groupbox' | Sort-Object { $_.Current.BoundingRectangle.Y })
  $target = if ($isBitmap) { $groups[1] } else { $groups[0] }
  $saveBtn = @(Find-Named $target 'center_text' | Sort-Object { $_.Current.BoundingRectangle.Y } | Select-Object -Last 1)
  if ($saveBtn.Count -eq 0) { throw 'Save button not found on export page.' }

  if ($isBitmap) {
    # Scale row = the lowest units_textfield ("Scale %") followed by [fit] [x1] [x2] [x4] buttons.
    $scale = [int]$params.bitmapScale
    if ($scale -ne 1) {
      $fields = @(Find-Named $target 'units_textfield' | Sort-Object { $_.Current.BoundingRectangle.Y })
      $row = (Get-Rect $fields[-1]).Y
      $rowBtns = @($target.FindAll('Descendants', $TRUE_COND) | Where-Object {
          $r = $_.Current.BoundingRectangle; [Math]::Abs($r.Y - $row) -lt 3 -and $r.Width -ge 18 -and $r.Width -le 28 -and $r.Height -ge 18 -and $r.Height -le 22
        } | Sort-Object { $_.Current.BoundingRectangle.X })
      $i = @{ 1 = 1; 2 = 2; 4 = 3 }[$scale]
      if ($rowBtns.Count -lt 4) { throw "Scale buttons not found ($($rowBtns.Count))." }
      Click-Element $win $rowBtns[$i] "bitmap-scale x$scale"
      Start-Sleep -Milliseconds 600
    }
  }

  $before = @(Get-ChildItem -LiteralPath $workDir -File | ForEach-Object { $_.Name })
  Click-Element $win $saveBtn[0] 'quick-save'

  $deadline = (Get-Date).AddSeconds([int]$params.saveTimeoutSec)
  $outFile = $null
  while ((Get-Date) -lt $deadline) {
    $dlg = Get-BlockingDialog $procId
    if ($dlg) { throw "Unexpected dialog while saving: [$($dlg.Current.Name)]" }
    $new = @(Get-ChildItem -LiteralPath $workDir -File | Where-Object { $before -notcontains $_.Name })
    if ($new.Count -gt 0) {
      $f = $new[0]
      Start-Sleep -Milliseconds 600
      if ((Get-Item -LiteralPath $f.FullName).Length -eq $f.Length -and $f.Length -gt 0) { $outFile = $f.FullName; break }
    }
    Start-Sleep -Milliseconds 300
  }
  if (-not $outFile) { throw 'Export file was not written in time.' }
  Log "written $outFile"

  $dest = $params.outputPath
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item -LiteralPath $outFile -Destination $dest -Force:([bool]$params.overwrite)
  $result['outputPath'] = $dest
  $result['bytes'] = (Get-Item -LiteralPath $dest).Length
  $result['success'] = $true
}
catch {
  $result['error'] = $_.Exception.Message
  if ($procId) {
    $w = Get-MainWindow $procId
    if ($w -and $params.debugDir) {
      $result['snapshot'] = Save-Snapshot $w (Join-Path $params.debugDir ("vm-error-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png'))
    }
  }
}
finally {
  if ($procId) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p) {
      $p.CloseMainWindow() | Out-Null
      if (-not $p.WaitForExit(8000)) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; Log 'force-killed' }
    }
  }
  Restore-Reg
  if ($workDir -and (Test-Path $workDir)) { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Result $result
}
