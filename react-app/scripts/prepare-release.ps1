$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$packageJsonPath = Join-Path $projectRoot "package.json"

function Invoke-Step($label, $scriptBlock) {
  Write-Host ""
  Write-Host "==> $label"
  & $scriptBlock
}

if (-not (Test-Path $packageJsonPath)) {
  throw "package.json not found at $packageJsonPath"
}

$packageJson = Get-Content $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$packageJson.version

if (-not ($version -match '^0\.1\.0-test\.\d+$')) {
  throw "Unexpected package version format: $version"
}

Invoke-Step "Sync Android version" {
  & (Join-Path $PSScriptRoot "sync-android-version.ps1")
}

Invoke-Step "Release notes regression" {
  Push-Location $projectRoot
  try {
    npm.cmd run test:release-notes
  }
  finally {
    Pop-Location
  }
}

Invoke-Step "Core data regressions" {
  Push-Location $projectRoot
  try {
    npm.cmd run test:helpers
    npm.cmd run test:reminders
    npm.cmd run test:calendar-items
    npm.cmd run test:backup-import
    npm.cmd run test:update-checker
  }
  finally {
    Pop-Location
  }
}

Invoke-Step "Build signed APK" {
  & (Join-Path $PSScriptRoot "release-apk.ps1")
}

Invoke-Step "Prepare release files" {
  & (Join-Path $PSScriptRoot "prepare-release-files.ps1")
}

Invoke-Step "Release readiness check" {
  Push-Location $projectRoot
  try {
    npm.cmd run test:release-ready
  }
  finally {
    Pop-Location
  }
}

$apkName = "lifelog-v$version.apk"
$apkPath = Join-Path (Join-Path $repoRoot "downloads") $apkName
if (-not (Test-Path $apkPath)) {
  throw "Prepared APK not found: $apkPath"
}

$apk = Get-Item $apkPath
$sha256 = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()

Write-Host ""
Write-Host "Release files prepared for $version"
Write-Host "APK: downloads/$apkName"
Write-Host "Size: $($apk.Length) bytes"
Write-Host "SHA256: $sha256"
Write-Host "Next manual steps:"
Write-Host "  git status --short"
Write-Host "  git commit -m `"Release $version`""
Write-Host "  git push origin main"
Write-Host "  git push gitee main"
Write-Host "  gh release create v$version downloads/$apkName --title `"v$version`" --notes-file <notes.md>"
