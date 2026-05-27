import { APP_VERSION } from "../constants/version";

const LATEST_RELEASE_URL = "https://api.github.com/repos/cnxin/lifelog/releases/latest";
const GITEE_UPDATE_MANIFEST_URL = "https://gitee.com/ysjugg/lifelog/raw/main/update-manifest.json";
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
  apkSha256: string;
  body: string;
  publishedAt: string;
  checkedAt: string;
  source: string;
  diagnostics: UpdateSourceDiagnostic[];
  hasUpdate: boolean;
}

export interface UpdateSourceDiagnostic {
  source: string;
  status: "ok" | "empty" | "failed" | "invalid";
  message: string;
  version?: string;
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
  apkSha256?: string;
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
  const sources = [
    { name: "Gitee 国内镜像清单", fetcher: () => fetchUpdateManifest(GITEE_UPDATE_MANIFEST_URL) },
    { name: "GitHub raw 清单", fetcher: () => fetchUpdateManifest(RAW_UPDATE_MANIFEST_URL) },
    { name: "CDN 清单", fetcher: () => fetchUpdateManifest(UPDATE_MANIFEST_URL) },
    { name: "GitHub Release", fetcher: fetchLatestRelease }
  ];
  const candidates = await Promise.allSettled(sources.map((source) => source.fetcher()));
  const diagnostics = buildUpdateDiagnostics(candidates, sources.map((source) => source.name));
  const updates = candidates
    .flatMap((candidate) => (candidate.status === "fulfilled" && candidate.value ? [candidate.value] : []))
    .flatMap((payload) => parseUpdateCandidate(payload, APP_VERSION));

  if (updates.length > 0) {
    return {
      ...chooseBestAppUpdate(updates, APP_VERSION),
      diagnostics
    };
  }

  throw new Error(`没有读取到可用的更新信息：${formatUpdateDiagnostics(diagnostics)}`);
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
  const best = updates.sort((left, right) => {
    const versionCompare = compareVersions(right.latestVersion, left.latestVersion);
    if (versionCompare !== 0) return versionCompare;
    return updateSourcePriority(left.source) - updateSourcePriority(right.source);
  })[0];
  if (compareVersions(best.latestVersion, currentVersion) >= 0) return best;

  return {
    ...best,
    currentVersion,
    latestVersion: currentVersion,
    apkUrl: "",
    mirrorApkUrl: "",
    apkName: "",
    apkSize: 0,
    apkSha256: "",
    body: "",
    source: best.source,
    diagnostics: best.diagnostics,
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
    source: formatManifestSource(url)
  } as UpdateManifestPayload & { source: string };
}

function formatManifestSource(url: string) {
  if (url.includes("gitee.com")) return "Gitee 国内镜像清单";
  if (url.includes("cdn.jsdelivr")) return "CDN 清单";
  if (url.includes("raw.githubusercontent")) return "GitHub raw 清单";
  return "更新清单";
}

function updateSourcePriority(source: string) {
  if (source.includes("Gitee")) return 0;
  if (source.includes("GitHub raw")) return 1;
  if (source.includes("CDN")) return 2;
  if (source.includes("GitHub Release")) return 3;
  return 4;
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
    apkSha256: payload.apkSha256 || "",
    body: payload.body || "",
    publishedAt: payload.publishedAt || "",
    checkedAt: new Date().toISOString(),
    source: payload.source || "更新清单",
    diagnostics: [],
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
    apkSha256: "",
    body: payload.body || "",
    publishedAt: payload.published_at || "",
    checkedAt: new Date().toISOString(),
    source: "GitHub Release",
    diagnostics: [],
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0
  };
}

function buildUpdateDiagnostics(
  candidates: PromiseSettledResult<UpdateManifestPayload | GitHubReleasePayload | null>[],
  names: string[]
): UpdateSourceDiagnostic[] {
  return candidates.map((candidate, index) => {
    const source = names[index] || "更新来源";
    if (candidate.status === "rejected") {
      return {
        source,
        status: "failed",
        message: candidate.reason instanceof Error ? candidate.reason.message : "请求失败"
      };
    }

    if (!candidate.value) {
      return {
        source,
        status: "empty",
        message: "未返回可用清单"
      };
    }

    try {
      const update = isGitHubReleasePayload(candidate.value)
        ? parseGitHubReleasePayload(candidate.value)
        : parseUpdateManifestPayload(candidate.value);
      return {
        source,
        status: "ok",
        message: update.apkName || update.releaseUrl || "已读取",
        version: update.latestVersion
      };
    } catch (error) {
      return {
        source,
        status: "invalid",
        message: error instanceof Error ? error.message : "解析失败"
      };
    }
  });
}

function formatUpdateDiagnostics(diagnostics: UpdateSourceDiagnostic[]) {
  return diagnostics.map((item) => `${item.source} ${formatDiagnosticStatus(item.status)}${item.message ? `（${item.message}）` : ""}`).join("；");
}

function formatDiagnosticStatus(status: UpdateSourceDiagnostic["status"]) {
  if (status === "ok") return "正常";
  if (status === "empty") return "无数据";
  if (status === "invalid") return "解析失败";
  return "失败";
}

export function getPreferredApkDownloadUrl(update: Pick<AppUpdateInfo, "apkUrl" | "mirrorApkUrl" | "releaseUrl"> | null | undefined) {
  return update?.mirrorApkUrl || update?.apkUrl || update?.releaseUrl || "";
}

export function getExternalApkDownloadUrl(update: Pick<AppUpdateInfo, "apkUrl" | "mirrorApkUrl" | "releaseUrl"> | null | undefined) {
  return update?.apkUrl || update?.mirrorApkUrl || update?.releaseUrl || "";
}

export function getExternalApkDownloadSource(update: Pick<AppUpdateInfo, "apkUrl" | "mirrorApkUrl" | "releaseUrl"> | null | undefined) {
  if (!update) return "";
  if (update.apkUrl) return formatDownloadSource(update.apkUrl);
  if (update.mirrorApkUrl) return formatDownloadSource(update.mirrorApkUrl);
  if (update.releaseUrl) return "Release 页面";
  return "";
}

export function getPreferredApkDownloadSource(update: Pick<AppUpdateInfo, "apkUrl" | "mirrorApkUrl" | "releaseUrl"> | null | undefined) {
  if (!update) return "";
  if (update.mirrorApkUrl) return formatDownloadSource(update.mirrorApkUrl);
  if (update.apkUrl) return formatDownloadSource(update.apkUrl);
  if (update.releaseUrl) return "Release 页面";
  return "";
}

function formatDownloadSource(url: string) {
  if (url.includes("gitee.com")) return "Gitee 国内镜像";
  if (url.includes("github.com")) return "GitHub Release";
  if (url.includes("cdn.jsdelivr")) return "jsDelivr CDN";
  return "下载链接";
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
