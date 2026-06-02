import { APP_VERSION } from "../constants/version";

const LATEST_RELEASE_URL = "https://api.github.com/repos/cnxin/lifelog/releases/latest";
const GITEE_UPDATE_MANIFEST_URL = "https://gitee.com/api/v5/repos/ysjugg/lifelog/contents/update-manifest.json?ref=main";
const UPDATE_MANIFEST_URL = "https://cdn.jsdelivr.net/gh/cnxin/lifelog@main/update-manifest.json";
const RAW_UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/cnxin/lifelog/main/update-manifest.json";
const PRIMARY_CHECK_TIMEOUT_MS = 5200;
const FALLBACK_CHECK_TIMEOUT_MS = 3500;
const FIRST_VALID_RESULT_GRACE_MS = 900;

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

interface GiteeContentPayload {
  content?: string;
  encoding?: string;
}

interface UpdateSource {
  name: string;
  fetcher: () => Promise<UpdateManifestPayload | GitHubReleasePayload | null>;
}

type UpdateSourceResult =
  | { source: string; status: "fulfilled"; value: UpdateManifestPayload | GitHubReleasePayload | null }
  | { source: string; status: "rejected"; reason: unknown }
  | { source: string; status: "skipped"; reason: string };

export async function checkLatestAppUpdate(): Promise<AppUpdateInfo> {
  const primarySources: UpdateSource[] = [
    { name: "Gitee 国内镜像清单", fetcher: () => fetchUpdateManifest(GITEE_UPDATE_MANIFEST_URL, PRIMARY_CHECK_TIMEOUT_MS) },
    { name: "CDN 清单", fetcher: () => fetchUpdateManifest(UPDATE_MANIFEST_URL, PRIMARY_CHECK_TIMEOUT_MS) },
    { name: "GitHub Release", fetcher: () => fetchLatestRelease(PRIMARY_CHECK_TIMEOUT_MS) }
  ];
  const primaryResults = await settleUpdateSources(primarySources, {
    timeoutMs: PRIMARY_CHECK_TIMEOUT_MS,
    firstValidGraceMs: FIRST_VALID_RESULT_GRACE_MS
  });
  const primaryDiagnostics = buildUpdateDiagnostics(primaryResults);
  const primaryUpdates = parseUpdateResults(primaryResults, APP_VERSION);

  if (primaryUpdates.length > 0) {
    return {
      ...chooseBestAppUpdate(primaryUpdates, APP_VERSION),
      diagnostics: primaryDiagnostics
    };
  }

  const fallbackSources: UpdateSource[] = [
    { name: "GitHub raw 清单", fetcher: () => fetchUpdateManifest(RAW_UPDATE_MANIFEST_URL, FALLBACK_CHECK_TIMEOUT_MS) }
  ];
  const fallbackResults = await settleUpdateSources(fallbackSources, {
    timeoutMs: FALLBACK_CHECK_TIMEOUT_MS,
    firstValidGraceMs: 0
  });
  const diagnostics = [...primaryDiagnostics, ...buildUpdateDiagnostics(fallbackResults)];
  const updates = parseUpdateResults(fallbackResults, APP_VERSION);

  if (updates.length > 0) {
    return {
      ...chooseBestAppUpdate(updates, APP_VERSION),
      diagnostics
    };
  }
  throw new Error(`没有读取到可用的更新信息：${formatUpdateDiagnostics(diagnostics)}`);
}

async function settleUpdateSources(
  sources: UpdateSource[],
  options: { timeoutMs: number; firstValidGraceMs: number }
): Promise<UpdateSourceResult[]> {
  const pending = sources.map((source, index) => {
    const promise = source.fetcher()
      .then((value): UpdateSourceResult & { index: number } => ({ index, source: source.name, status: "fulfilled", value }))
      .catch((reason): UpdateSourceResult & { index: number } => ({ index, source: source.name, status: "rejected", reason }));
    return {
      source,
      promise,
      settled: false
    };
  });
  const results: Array<UpdateSourceResult | undefined> = [];
  const startedAt = Date.now();
  let deadline = startedAt + options.timeoutMs;

  while (pending.some((item) => !item.settled)) {
    const remainingMs = Math.max(0, deadline - Date.now());
    if (remainingMs <= 0) break;
    const active = pending.filter((item) => !item.settled);
    const settled = await Promise.race([
      ...active.map((item) => item.promise),
      delay(remainingMs).then(() => null)
    ]);
    if (!settled) break;

    pending[settled.index].settled = true;
    results[settled.index] = settled;

    if (options.firstValidGraceMs > 0 && hasValidUpdateResult([settled])) {
      deadline = Math.min(deadline, Date.now() + options.firstValidGraceMs);
    }
  }

  pending.forEach((item, index) => {
    if (item.settled) return;
    results[index] = {
      source: item.source.name,
      status: "skipped",
      reason: "响应较慢，已跳过"
    };
  });

  return results.filter((item): item is UpdateSourceResult => Boolean(item));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    getTimerHost().setTimeout(resolve, ms);
  });
}

function hasValidUpdateResult(results: UpdateSourceResult[]) {
  return parseUpdateResults(results).length > 0;
}

function parseUpdateResults(results: UpdateSourceResult[], currentVersion = APP_VERSION) {
  return results
    .flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []))
    .flatMap((payload) => parseUpdateCandidate(payload, currentVersion));
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

async function fetchLatestRelease(timeoutMs: number) {
  const response = await fetchWithTimeout(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store"
  }, timeoutMs);
  if (!response.ok) {
    throw new Error(`GitHub 返回 ${response.status}`);
  }
  return (await response.json()) as GitHubReleasePayload;
}

async function fetchUpdateManifest(url: string, timeoutMs: number) {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetchWithTimeout(`${url}${separator}t=${Date.now()}`, {
    cache: "no-store"
  }, timeoutMs);
  if (!response.ok) return null;
  const payload = (await response.json()) as UpdateManifestPayload | GiteeContentPayload;
  return {
    ...normalizeManifestPayload(payload),
    source: formatManifestSource(url)
  } as UpdateManifestPayload & { source: string };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timerHost = getTimerHost();
  const timeoutId = timerHost.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`超过 ${Math.round(timeoutMs / 1000)} 秒未响应`);
    }
    throw error;
  } finally {
    timerHost.clearTimeout(timeoutId);
  }
}

function getTimerHost(): Pick<Window, "setTimeout" | "clearTimeout"> {
  return typeof window !== "undefined" ? window : globalThis;
}

function formatManifestSource(url: string) {
  if (url.includes("gitee.com")) return "Gitee 国内镜像清单";
  if (url.includes("cdn.jsdelivr")) return "CDN 清单";
  if (url.includes("raw.githubusercontent")) return "GitHub raw 清单";
  return "更新清单";
}

function normalizeManifestPayload(payload: UpdateManifestPayload | GiteeContentPayload): UpdateManifestPayload {
  if ("content" in payload && payload.content) {
    const decoded = decodeBase64Json(payload.content);
    return JSON.parse(decoded) as UpdateManifestPayload;
  }
  return payload as UpdateManifestPayload;
}

function decodeBase64Json(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (typeof atob === "function") {
    return decodeURIComponent(
      Array.from(atob(normalized))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
  }
  throw new Error("当前环境无法解析 Gitee 清单");
}

function updateSourcePriority(source: string) {
  if (source.includes("Gitee")) return 0;
  if (source.includes("CDN")) return 1;
  if (source.includes("GitHub Release")) return 2;
  if (source.includes("GitHub raw")) return 3;
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
  candidates: UpdateSourceResult[]
): UpdateSourceDiagnostic[] {
  return candidates.map((candidate) => {
    const source = candidate.source || "更新来源";
    if (candidate.status === "skipped") {
      return {
        source,
        status: "failed",
        message: candidate.reason
      };
    }

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
