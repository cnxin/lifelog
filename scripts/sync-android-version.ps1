$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$androidBuildGradlePath = Join-Path (Join-Path (Join-Path $projectRoot "android") "app") "build.gradle"

if (-not (Test-Path $packageJsonPath)) {
  throw "package.json not found at $packageJsonPath"
}

if (-not (Test-Path $androidBuildGradlePath)) {
  throw "Android build.gradle not found at $androidBuildGradlePath"
}

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$versionName = [string]$packageJson.version

if (-not ($versionName -match 'test\.(\d+)$')) {
  throw "Cannot derive Android versionCode from package version: $versionName"
}

$versionCode = [int]$Matches[1]
$buildGradle = Get-Content $androidBuildGradlePath -Raw
$buildGradle = $buildGradle -replace 'versionCode\s+\d+', "versionCode $versionCode"
$buildGradle = $buildGradle -replace 'versionName\s+"[^"]+"', "versionName `"$versionName`""
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($androidBuildGradlePath, $buildGradle, $utf8NoBom)

Write-Host "Android version synced: versionCode $versionCode, versionName $versionName"
