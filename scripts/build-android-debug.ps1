$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkHome = Join-Path $env:USERPROFILE ".local\jdks\jdk-21.0.11+10"
$androidSdk = Join-Path $env:USERPROFILE "Android\Sdk"

if (-not (Test-Path (Join-Path $jdkHome "bin\java.exe"))) {
  throw "JDK 21 not found at $jdkHome"
}

if (-not (Test-Path (Join-Path $androidSdk "platforms\android-36"))) {
  throw "Android SDK platform android-36 not found at $androidSdk"
}

$env:JAVA_HOME = $jdkHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Push-Location $projectRoot
try {
  npm.cmd run build
  npm.cmd run cap:sync

  Push-Location (Join-Path $projectRoot "android")
  try {
    .\gradlew.bat assembleDebug --no-daemon
  }
  finally {
    Pop-Location
  }
}
finally {
  Pop-Location
}

$apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
  throw "Debug APK was not created."
}

Write-Host "Debug APK: $apkPath"
