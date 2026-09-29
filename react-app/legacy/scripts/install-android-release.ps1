$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidSdk = Join-Path $env:USERPROFILE "Android\Sdk"
$adb = Join-Path $androidSdk "platform-tools\adb.exe"
$apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"

if (-not (Test-Path $adb)) {
  throw "adb not found at $adb"
}

if (-not (Test-Path $apkPath)) {
  throw "Release APK not found at $apkPath. Run npm.cmd run android:release first."
}

$env:ANDROID_SDK_HOME = Join-Path $env:USERPROFILE "Android"
$env:ADB_VENDOR_KEYS = Join-Path $env:ANDROID_SDK_HOME ".android\adbkey"

& $adb devices
& $adb install -r $apkPath
