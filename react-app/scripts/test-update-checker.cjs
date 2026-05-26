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
  getPreferredApkDownloadUrl,
  parseGitHubReleasePayload,
  parseUpdateManifestPayload
} = loadTs("src/utils/updateChecker.ts");

const cases = [
  ["0.1.0-test.61", "0.1.0-test.60", 1],
  ["v0.1.0-test.60", "0.1.0-test.60", 0],
  ["0.1.0-test.59", "0.1.0-test.60", -1],
  ["0.1.1", "0.1.0-test.60", 1],
  ["0.2.0", "0.1.9", 1]
];

let failures = 0;

for (const [left, right, expectedSign] of cases) {
  const actual = Math.sign(compareVersions(left, right));
  if (actual === expectedSign) continue;
  failures += 1;
  console.error(`[compareVersions ${left} vs ${right}] expected ${expectedSign}, actual ${actual}`);
}

const parsed = parseGitHubReleasePayload(
  {
    tag_name: "v0.1.0-test.61",
    html_url: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.61",
    body: "- 更新中心增强",
    published_at: "2026-05-21T09:32:17Z",
    assets: [
      {
        name: "lifelog-v0.1.0-test.61.apk",
        size: 3587759,
        browser_download_url: "https://example.invalid/lifelog.apk"
      }
    ]
  },
  "0.1.0-test.60"
);

if (!parsed.hasUpdate || parsed.apkSize !== 3587759 || parsed.apkName !== "lifelog-v0.1.0-test.61.apk") {
  failures += 1;
  console.error(`[parseGitHubReleasePayload] unexpected payload: ${JSON.stringify(parsed)}`);
}

if (formatFileSize(3587759) !== "3.4 MB") {
  failures += 1;
  console.error(`[formatFileSize] expected 3.4 MB, actual ${formatFileSize(3587759)}`);
}

const manifest = parseUpdateManifestPayload(
  {
    version: "v0.1.0-test.64",
    releaseUrl: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.64",
    apkUrl: "https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.64/lifelog-v0.1.0-test.64.apk",
    mirrorApkUrl: "https://cdn.jsdelivr.net/gh/cnxin/lifelog@main/lifelog-v0.1.0-test.64.apk",
    apkName: "lifelog-v0.1.0-test.64.apk",
    apkSize: 3591000
  },
  "0.1.0-test.63"
);

if (!manifest.hasUpdate || manifest.latestVersion !== "0.1.0-test.64" || !manifest.mirrorApkUrl.includes("cdn.jsdelivr.net")) {
  failures += 1;
  console.error(`[parseUpdateManifestPayload] unexpected payload: ${JSON.stringify(manifest)}`);
}

const newerRelease = parseGitHubReleasePayload(
  {
    tag_name: "v0.1.0-test.65",
    html_url: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.65",
    assets: [
      {
        name: "lifelog-v0.1.0-test.65.apk",
        size: 3592347,
        browser_download_url: "https://example.invalid/lifelog-65.apk"
      }
    ]
  },
  "0.1.0-test.64"
);

if (!newerRelease.hasUpdate || newerRelease.latestVersion !== "0.1.0-test.65" || !newerRelease.mirrorApkUrl.includes("/downloads/")) {
  failures += 1;
  console.error(`[parseGitHubReleasePayload latest fallback] unexpected payload: ${JSON.stringify(newerRelease)}`);
}

const staleOnly = chooseBestAppUpdate([manifest], "0.1.0-test.65");
if (staleOnly.latestVersion !== "0.1.0-test.65" || staleOnly.hasUpdate || staleOnly.apkUrl || staleOnly.mirrorApkUrl) {
  failures += 1;
  console.error(`[chooseBestAppUpdate stale source] unexpected payload: ${JSON.stringify(staleOnly)}`);
}

const mixedSources = chooseBestAppUpdate([manifest, newerRelease], "0.1.0-test.64");
if (!mixedSources.hasUpdate || mixedSources.latestVersion !== "0.1.0-test.65") {
  failures += 1;
  console.error(`[chooseBestAppUpdate mixed sources] unexpected payload: ${JSON.stringify(mixedSources)}`);
}

const preferredDownload = getPreferredApkDownloadUrl({
  apkUrl: "https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.65/lifelog-v0.1.0-test.65.apk",
  mirrorApkUrl: "https://gitee.com/cnxin/lifelog/releases/download/v0.1.0-test.65/lifelog-v0.1.0-test.65.apk",
  releaseUrl: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.65"
});
if (!preferredDownload.includes("gitee.com/cnxin/lifelog/releases/download/")) {
  failures += 1;
  console.error(`[getPreferredApkDownloadUrl] expected mirror asset first, actual ${preferredDownload}`);
}

const fallbackDownload = getPreferredApkDownloadUrl({
  apkUrl: "https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.65/lifelog-v0.1.0-test.65.apk",
  mirrorApkUrl: "",
  releaseUrl: "https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.65"
});
if (!fallbackDownload.includes("github.com/cnxin/lifelog/releases/download/")) {
  failures += 1;
  console.error(`[getPreferredApkDownloadUrl fallback] expected GitHub fallback, actual ${fallbackDownload}`);
}

if (failures) {
  console.error(`Update checker regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Update checker regression passed: ${cases.length} version cases plus release metadata.`);
