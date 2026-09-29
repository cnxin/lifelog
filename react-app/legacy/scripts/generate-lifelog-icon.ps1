$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot

$blueTop = [System.Drawing.ColorTranslator]::FromHtml("#4A9FE0")
$blueBottom = [System.Drawing.ColorTranslator]::FromHtml("#3578C0")
$white = [System.Drawing.Color]::White

function Convert-Point($x, $y, $size, $wordScale) {
  $baseScale = $size / 512.0
  $scaledX = 256.0 + (($x - 256.0) * $wordScale)
  $scaledY = 256.0 + (($y - 256.0) * $wordScale)
  return [System.Drawing.PointF]::new([single]($scaledX * $baseScale), [single]($scaledY * $baseScale))
}

function Add-Quadratic($path, $p0, $control, $p2) {
  $c1 = [System.Drawing.PointF]::new(
    [single]($p0.X + (2.0 / 3.0) * ($control.X - $p0.X)),
    [single]($p0.Y + (2.0 / 3.0) * ($control.Y - $p0.Y))
  )
  $c2 = [System.Drawing.PointF]::new(
    [single]($p2.X + (2.0 / 3.0) * ($control.X - $p2.X)),
    [single]($p2.Y + (2.0 / 3.0) * ($control.Y - $p2.Y))
  )
  $path.AddBezier($p0, $c1, $c2, $p2)
}

function New-RoundedRectPath($x, $y, $width, $height, $radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $radius * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $width - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $width - $d, $y + $height - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $height - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-LifeWordmark($graphics, $size, $wordScale) {
  $baseScale = $size / 512.0
  $strokeScale = $baseScale * $wordScale

  $pen42 = [System.Drawing.Pen]::new($white, [single](42 * $strokeScale))
  $pen42.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen42.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen42.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $pen38 = [System.Drawing.Pen]::new($white, [single](38 * $strokeScale))
  $pen38.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen38.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen38.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $pen36 = [System.Drawing.Pen]::new($white, [single](36 * $strokeScale))
  $pen36.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen36.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $brush = [System.Drawing.SolidBrush]::new($white)

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $p0 = Convert-Point 88 142 $size $wordScale
  $p1 = Convert-Point 88 338 $size $wordScale
  $path.StartFigure()
  $path.AddLine($p0, $p1)
  $p2 = Convert-Point 112 362 $size $wordScale
  Add-Quadratic $path $p1 (Convert-Point 88 362 $size $wordScale) $p2
  $path.AddLine($p2, (Convert-Point 128 362 $size $wordScale))
  $graphics.DrawPath($pen42, $path)
  $path.Dispose()

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddLine((Convert-Point 190 222 $size $wordScale), (Convert-Point 190 362 $size $wordScale))
  $graphics.DrawPath($pen42, $path)
  $path.Dispose()

  $dot = Convert-Point 190 168 $size $wordScale
  $dotRadius = 26 * $strokeScale
  $graphics.FillEllipse($brush, [single]($dot.X - $dotRadius), [single]($dot.Y - $dotRadius), [single]($dotRadius * 2), [single]($dotRadius * 2))

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $p0 = Convert-Point 294 172 $size $wordScale
  $path.StartFigure()
  $p1 = Convert-Point 278 142 $size $wordScale
  Add-Quadratic $path $p0 (Convert-Point 294 148 $size $wordScale) $p1
  $p2 = Convert-Point 252 148 $size $wordScale
  Add-Quadratic $path $p1 (Convert-Point 262 138 $size $wordScale) $p2
  $p3 = Convert-Point 242 178 $size $wordScale
  Add-Quadratic $path $p2 (Convert-Point 242 158 $size $wordScale) $p3
  $path.AddLine($p3, (Convert-Point 242 362 $size $wordScale))
  $graphics.DrawPath($pen42, $path)
  $path.Dispose()

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddLine((Convert-Point 210 228 $size $wordScale), (Convert-Point 292 228 $size $wordScale))
  $graphics.DrawPath($pen36, $path)
  $path.Dispose()

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $p0 = Convert-Point 334 290 $size $wordScale
  $path.StartFigure()
  $p1 = Convert-Point 412 290 $size $wordScale
  $path.AddLine($p0, $p1)
  $p2 = Convert-Point 426 272 $size $wordScale
  Add-Quadratic $path $p1 (Convert-Point 426 290 $size $wordScale) $p2
  $p3 = Convert-Point 390 224 $size $wordScale
  Add-Quadratic $path $p2 (Convert-Point 426 240 $size $wordScale) $p3
  $p4 = Convert-Point 334 236 $size $wordScale
  Add-Quadratic $path $p3 (Convert-Point 354 210 $size $wordScale) $p4
  $p5 = Convert-Point 326 302 $size $wordScale
  Add-Quadratic $path $p4 (Convert-Point 314 262 $size $wordScale) $p5
  $p6 = Convert-Point 378 348 $size $wordScale
  Add-Quadratic $path $p5 (Convert-Point 340 342 $size $wordScale) $p6
  $p7 = Convert-Point 422 328 $size $wordScale
  Add-Quadratic $path $p6 (Convert-Point 402 348 $size $wordScale) $p7
  $graphics.DrawPath($pen38, $path)
  $path.Dispose()

  $pen42.Dispose()
  $pen38.Dispose()
  $pen36.Dispose()
  $brush.Dispose()
}

function New-IconPng($path, $size, $withBackground, $wordScale) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  if ($withBackground) {
    $rectPath = New-RoundedRectPath 0 0 $size $size ([single]($size * 112 / 512))
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      [System.Drawing.PointF]::new(0, 0),
      [System.Drawing.PointF]::new([single]$size, [single]$size),
      $blueTop,
      $blueBottom
    )
    $graphics.FillPath($brush, $rectPath)
    $brush.Dispose()
    $rectPath.Dispose()
  }

  Draw-LifeWordmark $graphics $size $wordScale

  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$webIcons = @(
  @{ Path = Join-Path $projectRoot "public\icon-180.png"; Size = 180 },
  @{ Path = Join-Path $projectRoot "public\icon-192.png"; Size = 192 },
  @{ Path = Join-Path $projectRoot "public\icon-512.png"; Size = 512 }
)

foreach ($icon in $webIcons) {
  New-IconPng $icon.Path $icon.Size $true 0.78
}

$androidIcons = @(
  @{ Density = "mipmap-mdpi"; Launcher = 48; Foreground = 108 },
  @{ Density = "mipmap-hdpi"; Launcher = 72; Foreground = 162 },
  @{ Density = "mipmap-xhdpi"; Launcher = 96; Foreground = 216 },
  @{ Density = "mipmap-xxhdpi"; Launcher = 144; Foreground = 324 },
  @{ Density = "mipmap-xxxhdpi"; Launcher = 192; Foreground = 432 }
)

foreach ($icon in $androidIcons) {
  $dir = Join-Path $projectRoot ("android\app\src\main\res\" + $icon.Density)
  New-IconPng (Join-Path $dir "ic_launcher.png") $icon.Launcher $true 0.78
  New-IconPng (Join-Path $dir "ic_launcher_round.png") $icon.Launcher $true 0.78
  New-IconPng (Join-Path $dir "ic_launcher_foreground.png") $icon.Foreground $false 0.78
}

Write-Host "Generated LifeLog icons with adaptive safe-area padding."
