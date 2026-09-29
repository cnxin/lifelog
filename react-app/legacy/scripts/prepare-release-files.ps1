$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$sourceApkPath = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
$manifestPath = Join-Path $repoRoot "update-manifest.json"
$changelogPath = Join-Path $repoRoot "CHANGELOG.md"

function Write-Utf8NoBom($path, $content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

if (-not (Test-Path $sourceApkPath)) {
  throw "Release APK not found. Run npm.cmd run release:apk first: $sourceApkPath"
}

$packageJson = Get-Content $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$packageJson.version
$apkName = "lifelog-v$version.apk"
$downloadsDir = Join-Path $repoRoot "downloads"
$targetApkPath = Join-Path $downloadsDir $apkName

if (-not (Test-Path $downloadsDir)) {
  New-Item -ItemType Directory -Path $downloadsDir | Out-Null
}

Copy-Item -LiteralPath $sourceApkPath -Destination $targetApkPath -Force
$apk = Get-Item $targetApkPath
$sha256 = (Get-FileHash -Algorithm SHA256 $targetApkPath).Hash.ToLowerInvariant()
$publishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.version = $version
$manifest.releaseUrl = "https://github.com/cnxin/lifelog/releases/tag/v$version"
$manifest.apkUrl = "https://github.com/cnxin/lifelog/releases/download/v$version/$apkName"
$manifest.mirrorApkUrl = "https://gitee.com/ysjugg/lifelog/raw/main/downloads/$apkName"
$manifest.apkName = $apkName
$manifest.apkSize = $apk.Length
$manifest.apkSha256 = $sha256
$manifest.publishedAt = $publishedAt

if (Test-Path $changelogPath) {
  $changelog = Get-Content $changelogPath -Raw -Encoding UTF8
  $versionHeading = [regex]::Escape("## v$version")
  $releaseMatch = [regex]::Match($changelog, "(?ms)^$versionHeading[^\r\n]*(?<section>.*?)(?=^## v|\z)")
  if ($releaseMatch.Success) {
    $section = $releaseMatch.Groups["section"].Value
    $capturingFirstSection = $false
    $hasCapturedSection = $false
    $bodyLines = @()
    foreach ($line in ($section -split "`r?`n")) {
      if ($line -match '^###\s+') {
        if ($hasCapturedSection) {
          break
        }
        $capturingFirstSection = $true
        $hasCapturedSection = $true
        continue
      }
      if ($capturingFirstSection -and $line -match '^- ') {
        $bodyLines += $line
      }
    }
    if ($bodyLines.Count -eq 0) {
      $bodyLines = @($section -split "`r?`n" | Where-Object { $_ -match '^- ' })
    }
    if ($bodyLines.Count -gt 0) {
      $manifest.body = [string]::Join("`n", $bodyLines)
    }
  }
}
Write-Utf8NoBom $manifestPath (($manifest | ConvertTo-Json -Depth 8) + "`n")

Write-Host "Prepared release files for $version"
Write-Host "APK: downloads/$apkName"
Write-Host "Size: $($apk.Length) bytes"
Write-Host "SHA256: $sha256"
Write-Host "PublishedAt: $publishedAt"
