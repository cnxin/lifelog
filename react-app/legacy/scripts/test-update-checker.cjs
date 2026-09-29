const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  const source = fs.readFileSync(filePath, "utf8").replace(
    'import { APP_VERSION } from "../constants/version";',
    'const APP_VERSION = "0.1.0-test.60";'
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

const {
  chooseBestAppUpdate,
  compareVersions,
  formatFileSize,
  getExternalApkDownloadUrl,
  getPreferredApkDownloadUrl,
  parseGitHubReleasePayload,
  parseUpdateManifestPayload
} = loadTs("src/utils/updateChecker.ts");

let failures = 0;

function assert(condition, label) {
  if (condition) return;
  failures += 1;
  console.error(`[${label}] assertion failed`);
}

for (const [left, right, expected] of [
  ["0.1.0-test.61", "0.1.0-test.60", 1],
  ["v0.1.0-test.60", "0.1.0-test.60", 0],
  ["0.1.0-test.59", "0.1.0-test.60", -1]
]) {
  assert(Math.sign(compareVersions(left, right)) === expected, `compareVersions ${left}`);
}

const manifest = parseUpdateManifestPayload({
  version: "v0.1.0-test.64",
  releaseUrl: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.64",
  apkUrl: "https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.64/lifelog-v0.1.0-test.64.apk",
  mirrorApkUrl: "https://cdn.jsdelivr.net/gh/cnxin/lifelog@main/lifelog-v0.1.0-test.64.apk",
  apkName: "lifelog-v0.1.0-test.64.apk",
  apkSize: 3591000,
  apkSha256: "a".repeat(64)
}, "0.1.0-test.63");

assert(manifest.hasUpdate && manifest.apkSha256.length === 64 && manifest.apkSize === 3591000, "valid manifest accepted");
assert(formatFileSize(3587759) === "3.4 MB", "formatFileSize");

for (const [label, payload] of [
  ["missing hash", { ...manifest, apkSha256: "" }],
  ["untrusted host", { ...manifest, apkUrl: "https://example.invalid/lifelog.apk" }],
  ["invalid size", { ...manifest, apkSize: 0 }]
]) {
  let rejected = false;
  try {
    parseUpdateManifestPayload(payload, "0.1.0-test.63");
  } catch {
    rejected = true;
  }
  assert(rejected, `manifest ${label} rejected`);
}

let releaseRejected = false;
try {
  parseGitHubReleasePayload({ tag_name: "v0.1.0-test.65", assets: [] }, "0.1.0-test.64");
} catch {
  releaseRejected = true;
}
assert(releaseRejected, "unsigned GitHub release rejected");

const stale = chooseBestAppUpdate([manifest], "0.1.0-test.65");
assert(!stale.hasUpdate && !stale.apkUrl && !stale.mirrorApkUrl, "stale update cleared");
assert(getPreferredApkDownloadUrl(manifest).includes("cdn.jsdelivr.net"), "mirror preferred");
assert(getExternalApkDownloadUrl(manifest).includes("github.com"), "primary external link");

if (failures) {
  console.error(`Update checker regression failed: ${failures} failure(s).`);
  process.exit(1);
}

console.log("Update checker regression passed: version comparison and trusted manifest validation.");
