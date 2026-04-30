$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkHome = Join-Path $env:USERPROFILE ".local\jdks\jdk-21.0.11+10"
$keytool = Join-Path $jdkHome "bin\keytool.exe"
$keystoreDir = Join-Path $env:USERPROFILE ".local\lifelog"
$keystorePath = Join-Path $keystoreDir "lifelog-release.p12"
$keystorePropertiesPath = Join-Path $projectRoot "android\keystore.properties"
$alias = "lifelog"
$password = "LifeLog-Local-Release-2026"

if (-not (Test-Path $keytool)) {
  throw "keytool not found at $keytool"
}

New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

if (-not (Test-Path $keystorePath)) {
  & $keytool -genkeypair `
    -v `
    -keystore $keystorePath `
    -storetype PKCS12 `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -alias $alias `
    -storepass $password `
    -keypass $password `
    -dname "CN=LifeLog, OU=LifeLog, O=cnxin, L=Local, S=Local, C=CN"
}

$escapedPath = $keystorePath.Replace("\", "\\")
@"
storeFile=$escapedPath
storePassword=$password
keyAlias=$alias
keyPassword=$password
"@ | Set-Content -Encoding ASCII -Path $keystorePropertiesPath

Write-Host "Keystore: $keystorePath"
Write-Host "Signing config: $keystorePropertiesPath"
