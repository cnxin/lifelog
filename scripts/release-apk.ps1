$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
$startedAt = Get-Date

function Invoke-Step($label, $scriptBlock) {
  Write-Host "==> $label"
  & $scriptBlock
}

Invoke-Step "Sync Android version" {
  & (Join-Path $PSScriptRoot "sync-android-version.ps1")
}

Invoke-Step "Build release APK" {
  & (Join-Path $PSScriptRoot "build-android-release.ps1")
}

if (-not (Test-Path $apkPath)) {
  throw "Release APK was not created at $apkPath"
}

$apk = Get-Item $apkPath
if ($apk.LastWriteTime -lt $startedAt) {
  throw "Release APK timestamp was not updated. APK: $apkPath, LastWriteTime: $($apk.LastWriteTime), StartedAt: $startedAt"
}

Write-Host "Release APK verified: $apkPath"
Write-Host "APK size: $($apk.Length) bytes"
Write-Host "APK timestamp: $($apk.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
