$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkHome = Join-Path $env:USERPROFILE ".local\jdks\jdk-21.0.11+10"
$androidSdk = Join-Path $env:USERPROFILE "Android\Sdk"
$keystorePath = Join-Path $env:USERPROFILE ".local\lifelog\lifelog-release.p12"
$keystorePropertiesPath = Join-Path $projectRoot "android\keystore.properties"

if (-not (Test-Path (Join-Path $jdkHome "bin\java.exe"))) {
  throw "JDK 21 not found at $jdkHome"
}

if (-not (Test-Path (Join-Path $androidSdk "platforms\android-36"))) {
  throw "Android SDK platform android-36 not found at $androidSdk"
}

if (-not (Test-Path $keystorePropertiesPath)) {
  throw "Signing config not found at $keystorePropertiesPath. Run scripts/create-android-keystore.ps1 first."
}

if (-not (Test-Path $keystorePath)) {
  throw "Release keystore not found at $keystorePath"
}

$env:JAVA_HOME = $jdkHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

& (Join-Path $PSScriptRoot "sync-android-version.ps1")

Push-Location $projectRoot
try {
  npm.cmd run build
  npm.cmd run cap:sync

  Push-Location (Join-Path $projectRoot "android")
  try {
    .\gradlew.bat assembleRelease
  }
  finally {
    Pop-Location
  }
}
finally {
  Pop-Location
}

$apkPath = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkPath)) {
  throw "Release APK was not created."
}

Write-Host "Release APK: $apkPath"
