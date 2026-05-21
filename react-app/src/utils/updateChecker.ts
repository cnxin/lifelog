import { APP_VERSION } from "../constants/version";

const LATEST_RELEASE_URL = "https://api.github.com/repos/cnxin/lifelog/releases/latest";

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  apkUrl: string;
  body: string;
  hasUpdate: boolean;
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  html_url?: string;
  body?: string;
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
  const latestVersion = normalizeVersion(payload.tag_name || "");
  if (!latestVersion) {
    throw new Error("没有读取到最新版本号");
  }

  const apkAsset = (payload.assets || []).find((asset) => asset.name?.endsWith(".apk"));
  return {
    currentVersion: APP_VERSION,
    latestVersion,
    releaseUrl: payload.html_url || `https://github.com/cnxin/lifelog/releases/tag/v${latestVersion}`,
    apkUrl: apkAsset?.browser_download_url || "",
    body: payload.body || "",
    hasUpdate: compareVersions(latestVersion, APP_VERSION) > 0
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
