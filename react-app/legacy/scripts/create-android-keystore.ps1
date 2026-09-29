$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$jdkHome = Join-Path $env:USERPROFILE ".local\jdks\jdk-21.0.11+10"
$keytool = Join-Path $jdkHome "bin\keytool.exe"
$keystoreDir = Join-Path $env:USERPROFILE ".local\lifelog"
$keystorePath = Join-Path $keystoreDir "lifelog-release.p12"
$keystorePropertiesPath = Join-Path $projectRoot "android\keystore.properties"
$alias = "lifelog"
$password = $env:LIFELOG_KEYSTORE_PASSWORD

if (-not (Test-Path $keytool)) {
  throw "keytool not found at $keytool"
}

New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

if (Test-Path $keystorePath) {
  if ([string]::IsNullOrWhiteSpace($password)) {
    if (Test-Path $keystorePropertiesPath) {
      Write-Host "Existing signing configuration preserved: $keystorePropertiesPath"
      exit 0
    }
    throw "Existing keystore detected. Set LIFELOG_KEYSTORE_PASSWORD before recreating keystore.properties."
  }
} else {
  if ([string]::IsNullOrWhiteSpace($password)) {
    $randomBytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
    $password = [Convert]::ToBase64String($randomBytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
  }
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
