import { APP_VERSION } from "../constants/version";

const LATEST_RELEASE_URL = "https://api.github.com/repos/cnxin/lifelog/releases/latest";
const UPDATE_MANIFEST_URL = "https://cdn.jsdelivr.net/gh/cnxin/lifelog@main/update-manifest.json";
const RAW_UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/cnxin/lifelog/main/update-manifest.json";

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  apkUrl: string;
  mirrorApkUrl: string;
  apkName: string;
  apkSize: number;
  body: string;
  publishedAt: string;
  checkedAt: string;
  source: string;
  hasUpdate: boolean;
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

interface UpdateManifestPayload {
  version?: string;
  releaseUrl?: string;
  apkUrl?: string;
  mirrorApkUrl?: string;
  apkName?: string;
  apkSize?: number;
  body?: string;
  publishedAt?: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

export async function checkLatestAppUpdate(): Promise<AppUpdateInfo> {
  const candidates = await Promise.allSettled([fetchUpdateManifest(UPDATE_MANIFEST_URL), fetchUpdateManifest(RAW_UPDATE_MANIFEST_URL), fetchLatestRelease()]);
  const updates = candidates
    .flatMap((candidate) => (candidate.status === "fulfilled" && candidate.value ? [candidate.value] : []))
    .flatMap((payload) => parseUpdateCandidate(payload, APP_VERSION));

  if (updates.length > 0) {
    return chooseBestAppUpdate(updates, APP_VERSION);
  }

  throw new Error("没有读取到可用的更新信息");
}

function parseUpdateCandidate(payload: UpdateManifestPayload | GitHubReleasePayload, currentVersion = APP_VERSION) {
  try {
    return [isGitHubReleasePayload(payload) ? parseGitHubReleasePayload(payload, currentVersion) : parseUpdateManifestPayload(payload, currentVersion)];
  } catch (error) {
    console.warn("更新来源解析失败，跳过该来源:", error);
    return [];
  }
}

export function chooseBestAppUpdate(updates: AppUpdateInfo[], currentVersion = APP_VERSION) {
  const best = updates.sort((left, right) => compareVersions(right.latestVersion, left.latestVersion))[0];
  if (compareVersions(best.latestVersion, currentVersion) >= 0) return best;

  return {
    ...best,
    currentVersion,
    latestVersion: currentVersion,
    apkUrl: "",
    mirrorApkUrl: "",
    apkName: "",
    apkSize: 0,
    body: "",
    source: best.source,
    hasUpdate: false
  };
}

async function fetchLatestRelease() {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`GitHub 返回 ${response.status}`);
  }
  return (await response.json()) as GitHubReleasePayload;
}

async function fetchUpdateManifest(url: string) {
  const response = await fetch(`${url}?t=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) return null;
  return {
    ...((await response.json()) as UpdateManifestPayload),
    source: url.includes("cdn.jsdelivr") ? "CDN 清单" : "GitHub raw 清单"
  } as UpdateManifestPayload & { source: string };
}

function isGitHubReleasePayload(payload: UpdateManifestPayload | GitHubReleasePayload): payload is GitHubReleasePayload {
  return "tag_name" in payload || "assets" in payload;
}

export function parseUpdateManifestPayload(payload: UpdateManifestPayload & { source?: string }, currentVersion = APP_VERSION): AppUpdateInfo {
  const latestVersion = normalizeVersion(payload.version || "");
  if (!latestVersion) {
    throw new Error("更新清单没有版本号");
  }

  return {
    currentVersion,
    latestVersion,
    releaseUrl: payload.releaseUrl || `https://github.com/cnxin/lifelog/releases/tag/v${latestVersion}`,
    apkUrl: payload.apkUrl || "",
    mirrorApkUrl: payload.mirrorApkUrl || "",
    apkName: payload.apkName || `lifelog-v${latestVersion}.apk`,
    apkSize: typeof payload.apkSize === "number" ? payload.apkSize : 0,
    body: payload.body || "",
    publishedAt: payload.publishedAt || "",
    checkedAt: new Date().toISOString(),
    source: payload.source || "更新清单",
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0
  };
}

export function parseGitHubReleasePayload(payload: GitHubReleasePayload, currentVersion = APP_VERSION): AppUpdateInfo {
  const latestVersion = normalizeVersion(payload.tag_name || "");
  if (!latestVersion) {
    throw new Error("没有读取到最新版本号");
  }

  const apkAsset = (payload.assets || []).find((asset) => asset.name?.endsWith(".apk"));
  return {
    currentVersion,
    latestVersion,
    releaseUrl: payload.html_url || `https://github.com/cnxin/lifelog/releases/tag/v${latestVersion}`,
    apkUrl: apkAsset?.browser_download_url || "",
    mirrorApkUrl: apkAsset?.name ? buildJsDelivrApkUrl(latestVersion, apkAsset.name) : "",
    apkName: apkAsset?.name || "",
    apkSize: typeof apkAsset?.size === "number" ? apkAsset.size : 0,
    body: payload.body || "",
    publishedAt: payload.published_at || "",
    checkedAt: new Date().toISOString(),
    source: "GitHub Release",
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0
  };
}

export function getPreferredApkDownloadUrl(update: Pick<AppUpdateInfo, "apkUrl" | "mirrorApkUrl" | "releaseUrl"> | null | undefined) {
  return update?.apkUrl || update?.mirrorApkUrl || update?.releaseUrl || "";
}

function buildJsDelivrApkUrl(version: string, assetName: string) {
  return `https://cdn.jsdelivr.net/gh/cnxin/lifelog@main/downloads/${assetName || `lifelog-v${version}.apk`}`;
}

export function compareVersions(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const size = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < size; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
}

function versionParts(value: string) {
  return normalizeVersion(value)
    .split(/[.-]/)
    .map((part) => Number(part.replace(/\D/g, "")))
    .filter((part) => Number.isFinite(part));
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v/i, "");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}
