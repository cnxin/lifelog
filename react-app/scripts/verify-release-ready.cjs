const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..");
const failures = [];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function getSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const packageJsonPath = path.join(projectRoot, "package.json");
const packageLockPath = path.join(projectRoot, "package-lock.json");
const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");
const releaseNotesPath = path.join(projectRoot, "src", "constants", "releaseNotes.ts");
const readmePath = path.join(repoRoot, "README.md");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const manifestPath = path.join(repoRoot, "update-manifest.json");

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const version = String(packageJson.version || "");
const versionCodeMatch = version.match(/test\.(\d+)$/);
const versionCode = versionCodeMatch ? Number(versionCodeMatch[1]) : NaN;
const apkName = `lifelog-v${version}.apk`;
const apkPath = path.join(repoRoot, "downloads", apkName);

expect(Boolean(version), "package.json is missing version");
expect(Number.isFinite(versionCode), `Cannot derive versionCode from package version: ${version}`);
expect(packageLock.version === version, `package-lock.json version mismatch: ${packageLock.version} !== ${version}`);
expect(packageLock.packages?.[""]?.version === version, `package-lock root package version mismatch: ${packageLock.packages?.[""]?.version} !== ${version}`);

const buildGradle = readText(buildGradlePath);
expect(new RegExp(`versionCode\\s+${versionCode}\\b`).test(buildGradle), `Android versionCode should be ${versionCode}`);
expect(buildGradle.includes(`versionName "${version}"`), `Android versionName should be ${version}`);

const releaseNotes = readText(releaseNotesPath);
expect(releaseNotes.includes(`version: "${version}"`), `releaseNotes.ts is missing current version ${version}`);

const readme = readText(readmePath);
expect(readme.includes(`downloads/${apkName}`), `README.md is missing APK link downloads/${apkName}`);
expect(readme.includes(`当前版本：\`${version}\``), `README.md current version should be ${version}`);

const changelog = readText(changelogPath);
expect(changelog.includes(`## v${version}`), `CHANGELOG.md is missing v${version}`);

expect(fs.existsSync(apkPath), `Release APK is missing at ${apkPath}`);

let apk;
let sha256;
if (fs.existsSync(apkPath)) {
  apk = fs.statSync(apkPath);
  sha256 = getSha256(apkPath);
  const manifest = readJson(manifestPath);
  expect(manifest.version === version, `update-manifest.json version mismatch: ${manifest.version} !== ${version}`);
  expect(manifest.apkName === apkName, `update-manifest.json apkName mismatch: ${manifest.apkName} !== ${apkName}`);
  expect(manifest.apkSize === apk.size, `update-manifest.json apkSize mismatch: ${manifest.apkSize} !== ${apk.size}`);
  expect(manifest.apkSha256 === sha256, `update-manifest.json apkSha256 mismatch: ${manifest.apkSha256} !== ${sha256}`);
  expect(readme.includes(sha256), "README.md is missing APK SHA256");
}

if (failures.length) {
  console.error("Release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release readiness check passed: ${version}`);
console.log(`APK: downloads/${apkName}`);
console.log(`Size: ${apk.size} bytes`);
console.log(`SHA256: ${sha256}`);
