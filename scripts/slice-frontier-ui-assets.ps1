param(
  [string]$Source = "public/assets/ui/frontier-ui-sheet.png",
  [string]$Output = "public/assets/ui/frontier"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (!(Test-Path -LiteralPath $Source)) {
  throw "Frontier UI sheet not found: $Source"
}

New-Item -ItemType Directory -Force -Path $Output | Out-Null

$sheet = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Source))

$assets = @(
  @{ name = "title-logo.png"; x = 42; y = 34; w = 515; h = 235; transparent = $true },
  @{ name = "background-mobile.png"; x = 15; y = 291; w = 445; h = 412; transparent = $false },
  @{ name = "reel-frame.png"; x = 474; y = 336; w = 435; h = 350; transparent = $true },
  @{ name = "jackpot-grand.png"; x = 602; y = 51; w = 316; h = 124; transparent = $true },
  @{ name = "jackpot-major.png"; x = 944; y = 51; w = 316; h = 124; transparent = $true },
  @{ name = "jackpot-minor.png"; x = 604; y = 184; w = 316; h = 112; transparent = $true },
  @{ name = "jackpot-mini.png"; x = 944; y = 184; w = 316; h = 112; transparent = $true },
  @{ name = "spin-button.png"; x = 1276; y = 48; w = 214; h = 214; transparent = $true },
  @{ name = "spin-button-pressed.png"; x = 1276; y = 320; w = 214; h = 214; transparent = $true },
  @{ name = "buy-bonus-button.png"; x = 938; y = 389; w = 304; h = 126; transparent = $true },
  @{ name = "respin-button.png"; x = 928; y = 580; w = 314; h = 116; transparent = $true },
  @{ name = "balance-panel.png"; x = 24; y = 744; w = 302; h = 112; transparent = $true },
  @{ name = "bet-panel.png"; x = 344; y = 744; w = 356; h = 112; transparent = $true },
  @{ name = "quick-bet-10.png"; x = 720; y = 766; w = 112; h = 72; transparent = $true },
  @{ name = "quick-bet-20.png"; x = 832; y = 766; w = 112; h = 72; transparent = $true },
  @{ name = "quick-bet-50.png"; x = 944; y = 766; w = 112; h = 72; transparent = $true },
  @{ name = "quick-bet-100.png"; x = 1057; y = 766; w = 112; h = 72; transparent = $true },
  @{ name = "quick-bet-250.png"; x = 1169; y = 766; w = 112; h = 72; transparent = $true },
  @{ name = "hold-and-win-banner.png"; x = 31; y = 902; w = 377; h = 94; transparent = $true },
  @{ name = "respins-panel.png"; x = 481; y = 909; w = 196; h = 90; transparent = $true },
  @{ name = "bonus-total-panel.png"; x = 694; y = 908; w = 212; h = 92; transparent = $true },
  @{ name = "win-big.png"; x = 927; y = 910; w = 180; h = 82; transparent = $true },
  @{ name = "win-mega.png"; x = 1109; y = 909; w = 198; h = 84; transparent = $true },
  @{ name = "win-epic.png"; x = 1319; y = 908; w = 194; h = 86; transparent = $true },
  @{ name = "icon-menu.png"; x = 1292; y = 582; w = 94; h = 94; transparent = $true },
  @{ name = "icon-info.png"; x = 1414; y = 582; w = 94; h = 94; transparent = $true },
  @{ name = "icon-sound.png"; x = 1292; y = 684; w = 94; h = 94; transparent = $true },
  @{ name = "icon-settings.png"; x = 1414; y = 684; w = 94; h = 94; transparent = $true }
)

function Test-DarkBackdrop([System.Drawing.Color]$Color) {
  return ($Color.R -lt 18 -and $Color.G -lt 24 -and $Color.B -lt 32)
}

function Clear-EdgeBackdrop([System.Drawing.Bitmap]$Bitmap) {
  $w = $Bitmap.Width
  $h = $Bitmap.Height
  $visited = New-Object 'bool[,]' $w, $h
  $queue = New-Object System.Collections.Generic.Queue[object]

  for ($x = 0; $x -lt $w; $x += 1) {
    $queue.Enqueue(@($x, 0))
    $queue.Enqueue(@($x, ($h - 1)))
  }
  for ($y = 0; $y -lt $h; $y += 1) {
    $queue.Enqueue(@(0, $y))
    $queue.Enqueue(@(($w - 1), $y))
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    $x = [int]$point[0]
    $y = [int]$point[1]
    if ($x -lt 0 -or $x -ge $w -or $y -lt 0 -or $y -ge $h -or $visited[$x, $y]) {
      continue
    }
    $visited[$x, $y] = $true
    $color = $Bitmap.GetPixel($x, $y)
    if (Test-DarkBackdrop $color) {
      $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
      $queue.Enqueue(@(($x + 1), $y))
      $queue.Enqueue(@(($x - 1), $y))
      $queue.Enqueue(@($x, ($y + 1)))
      $queue.Enqueue(@($x, ($y - 1)))
    }
  }
}

foreach ($asset in $assets) {
  $crop = New-Object System.Drawing.Bitmap($asset.w, $asset.h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  $graphics.DrawImage(
    $sheet,
    (New-Object System.Drawing.Rectangle(0, 0, $asset.w, $asset.h)),
    (New-Object System.Drawing.Rectangle($asset.x, $asset.y, $asset.w, $asset.h)),
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $graphics.Dispose()

  if ($asset.transparent) {
    Clear-EdgeBackdrop $crop
  }

  $crop.Save((Join-Path $Output $asset.name), [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

$sheet.Dispose()
Write-Output "Sliced $($assets.Count) Frontier UI assets into $Output"
