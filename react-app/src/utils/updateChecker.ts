import { APP_VERSION } from "../constants/version";

const LATEST_RELEASE_URL = "https://api.github.com/repos/cnxin/lifelog/releases/latest";

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  apkUrl: string;
  apkName: string;
  apkSize: number;
  body: string;
  publishedAt: string;
  checkedAt: string;
  hasUpdate: boolean;
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

interface GitHubReleasePayload {
  tag_name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

export async function checkLatestAppUpdate(): Promise<AppUpdateInfo> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub 返回 ${response.status}`);
  }

  const payload = (await response.json()) as GitHubReleasePayload;
  return parseGitHubReleasePayload(payload, APP_VERSION);
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
    apkName: apkAsset?.name || "",
    apkSize: typeof apkAsset?.size === "number" ? apkAsset.size : 0,
    body: payload.body || "",
    publishedAt: payload.published_at || "",
    checkedAt: new Date().toISOString(),
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0
  };
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
