# Generates icon.png (512x512): pixel staircase (bitmap) turning into a smooth Bezier curve (vector).
param([string]$Out = (Join-Path $PSScriptRoot '..\icon.png'))
Add-Type -AssemblyName System.Drawing
$S = 512
$bmp = New-Object System.Drawing.Bitmap $S, $S
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded background with diagonal gradient
$r = 96
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($S - $r, 0, $r, $r, 270, 90)
$path.AddArc($S - $r, $S - $r, $r, $r, 0, 90); $path.AddArc(0, $S - $r, $r, $r, 90, 90); $path.CloseFigure()
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $S, $S), ([System.Drawing.Color]::FromArgb(255, 88, 44, 186)), ([System.Drawing.Color]::FromArgb(255, 20, 150, 220))
$g.FillPath($bg, $path)

# Bitmap staircase (left-bottom), fading pixels
$px = 40
$steps = @(@(2, 9), @(3, 8), @(3, 7), @(4, 6), @(5, 5), @(6, 5))
$i = 0
foreach ($st in $steps) {
  $a = 230 - $i * 25
  $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($a, 255, 255, 255))
  $g.FillRectangle($b, $st[0] * $px - 30, $st[1] * $px - 10, $px - 4, $px - 4)
  $i++
}

# Smooth vector curve with handles and anchor nodes
$p0 = New-Object System.Drawing.PointF 70, 400
$c1 = New-Object System.Drawing.PointF 170, 120
$c2 = New-Object System.Drawing.PointF 330, 470
$p1 = New-Object System.Drawing.PointF 440, 130
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 214, 74)), 22
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
$g.DrawBezier($pen, $p0, $c1, $c2, $p1)
$hp = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 255, 255, 255)), 5
$g.DrawLine($hp, $p0, $c1); $g.DrawLine($hp, $p1, $c2)
$white = [System.Drawing.Brushes]::White
foreach ($c in @($c1, $c2)) { $g.FillEllipse($white, $c.X - 14, $c.Y - 14, 28, 28) }
$node = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 40, 30, 90))
foreach ($p in @($p0, $p1)) { $g.FillRectangle($white, $p.X - 24, $p.Y - 24, 48, 48); $g.FillRectangle($node, $p.X - 14, $p.Y - 14, 28, 28) }

$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"icon written: $Out"
