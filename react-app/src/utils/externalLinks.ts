import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { Place, PlaceLinkPlatform } from "../types";
import { buildAmapWebMarkerUrl, inferPlatformFromLink } from "./placeLinks";

interface NativeExternalBrowserPlugin {
  open(options: { url: string; packageName?: string }): Promise<void>;
  installApk(options: { url: string; fileName?: string; fallbackUrl?: string; expectedSha256?: string }): Promise<void>;
  canInstallPackages(): Promise<{ granted: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  addListener(eventName: "apkDownloadProgress", listenerFunc: (progress: ApkDownloadProgress) => void): Promise<PluginListenerHandle>;
}

interface NativeLaunchTarget {
  url: string;
  fallbackUrl: string;
  packageName: string;
}

const NativeExternalBrowser = registerPlugin<NativeExternalBrowserPlugin>("NativeExternalBrowser");

export interface ApkDownloadProgress {
  stage: "downloading" | "verifying" | "opening" | "fallback" | "failed";
  bytesRead: number;
  totalBytes: number;
  percent: number;
  fileName: string;
  message?: string;
}

export async function openExternalUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    const target = getNativeLaunchTarget(url);
    await openNativeViewUrl(target.url, target.packageName, target.fallbackUrl);
    return;
  }

  if (/^https?:\/\//i.test(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = url;
}

export async function openApkDownloadUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform() && /^https?:\/\//i.test(url)) {
    await openNativeApkInstaller(url);
    return;
  }

  await openExternalUrl(url);
}

export async function openApkDownload(update: { apkUrl?: string; mirrorApkUrl?: string; releaseUrl?: string; apkName?: string; apkSha256?: string } | null | undefined) {
  if (!update) return;
  const primaryUrl = update.mirrorApkUrl || update.apkUrl || update.releaseUrl || "";
  const fallbackUrl = primaryUrl === update.apkUrl ? update.releaseUrl || "" : update.apkUrl || update.releaseUrl || "";
  await openApkDownloadUrlWithFallback(primaryUrl, update.apkName, fallbackUrl, update.apkSha256);
}

export async function canInstallApkPackages() {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const result = await NativeExternalBrowser.canInstallPackages();
    return result.granted;
  } catch {
    return true;
  }
}

export async function openApkInstallPermissionSettings() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeExternalBrowser.openInstallPermissionSettings();
  } catch (error) {
    console.warn("打开安装来源权限设置失败:", error);
  }
}

export function addApkDownloadProgressListener(listener: (progress: ApkDownloadProgress) => void) {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve({ remove: async () => undefined });
  }
  return NativeExternalBrowser.addListener("apkDownloadProgress", listener);
}

export async function openApkDownloadUrlWithFallback(rawUrl: string, fileName = "", rawFallbackUrl = "", expectedSha256 = "") {
  const url = rawUrl.trim();
  const fallbackUrl = rawFallbackUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform() && /^https?:\/\//i.test(url)) {
    await openNativeApkInstaller(url, fileName, fallbackUrl, expectedSha256);
    return;
  }

  await openExternalUrl(url);
}

export async function openNativeStoreUrl(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    const target = getNativeLaunchTarget(url, platform);
    await openNativeViewUrl(target.url, target.packageName, target.fallbackUrl);
    return;
  }

  await openExternalUrl(url);
}

export async function openPlaceMap(place: Place) {
  if (Capacitor.isNativePlatform() && place.latitude && place.longitude) {
    const url = buildAmapUrl(place);
    if (url) {
      await openNativeViewUrl(url, getNativePackageName("amap"));
      return;
    }
  }

  if (place.mapUrl) {
    await openExternalUrl(place.mapUrl);
    return;
  }

  const amapUrl = buildAmapUrl(place);

  if (Capacitor.isNativePlatform() && amapUrl) {
    await openNativeViewUrl(amapUrl, getNativePackageName("amap"));
    return;
  }

  const amapWebUrl = buildAmapWebMarkerUrl(place);
  if (amapWebUrl) {
    await openExternalUrl(amapWebUrl);
    return;
  }

  if (amapUrl) {
    openSchemeUrl(amapUrl);
  }
}

function openSchemeUrl(url: string) {
  window.location.href = url;
}

async function openNativeViewUrl(url: string, packageName = "", fallbackUrl = "") {
  let lastError: unknown;
  for (const attempt of buildNativeOpenAttempts(url, packageName, fallbackUrl)) {
    try {
      await NativeExternalBrowser.open(attempt);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("原生外部链接打开失败，回退到系统链接:", lastError);
  const fallback = fallbackUrl || url;
  window.location.href = /^https?:\/\//i.test(fallback) ? buildAndroidViewIntentUrl(fallback) : fallback;
}

async function openNativeApkInstaller(url: string, fileName = "", fallbackUrl = "", expectedSha256 = "") {
  try {
    await NativeExternalBrowser.installApk({ url, fileName, fallbackUrl, expectedSha256 });
  } catch (error) {
    console.warn("原生 APK 下载打开失败，回退到外部链接:", error);
    await openNativeViewUrl(fallbackUrl || url);
  }
}

function buildNativeOpenAttempts(url: string, packageName = "", fallbackUrl = "") {
  const attempts: Array<{ url: string; packageName?: string }> = [];
  const add = (nextUrl: string, nextPackageName = "") => {
    if (!nextUrl) return;
    const key = `${nextUrl}|${nextPackageName}`;
    if (attempts.some((attempt) => `${attempt.url}|${attempt.packageName || ""}` === key)) return;
    attempts.push(nextPackageName ? { url: nextUrl, packageName: nextPackageName } : { url: nextUrl });
  };

  add(url, packageName);
  add(fallbackUrl, packageName);
  add(url);
  add(fallbackUrl);
  return attempts;
}

function getNativeLaunchTarget(rawUrl: string, platform?: PlaceLinkPlatform | string): NativeLaunchTarget {
  const detectedPlatform = platform || inferPlatformFromLink(rawUrl);
  const nativeUrl = buildNativeAppDeepLink(rawUrl, detectedPlatform);
  return {
    url: nativeUrl || rawUrl,
    fallbackUrl: rawUrl,
    packageName: getNativePackageName(detectedPlatform)
  };
}

export function buildNativeAppDeepLink(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  const url = rawUrl.trim();
  if (!url || !/^https?:\/\//i.test(url)) return url;

  const detectedPlatform = platform || inferPlatformFromLink(url);
  const keyword = getPlatformSearchKeyword(url, detectedPlatform);
  const encodedKeyword = keyword ? encodeURIComponent(keyword) : "";

  switch (detectedPlatform) {
    case "amap":
      return buildAmapDeepLinkFromWebUrl(url) || url;
    case "meituan":
      return encodedKeyword
        ? `imeituan://www.meituan.com/search?q=${encodedKeyword}`
        : `imeituan://www.meituan.com/web?url=${encodeURIComponent(url)}`;
    case "dianping":
      return encodedKeyword ? `dianping://searchshoplist?keyword=${encodedKeyword}` : url;
    case "douyin":
      return encodedKeyword
        ? `snssdk1128://search/tabs?keyword=${encodedKeyword}`
        : `snssdk1128://webview?url=${encodeURIComponent(url)}&from=webview&refer=web`;
    case "xiaohongshu":
      return encodedKeyword ? `xhsdiscover://search/result?keyword=${encodedKeyword}` : url;
    default:
      return url;
  }
}

function buildAmapDeepLinkFromWebUrl(rawUrl: string) {
  try {
    const webUrl = new URL(rawUrl);
    const hostname = webUrl.hostname.toLowerCase();
    if (!hostname.endsWith("amap.com")) return "";

    const keyword = webUrl.searchParams.get("keyword") || webUrl.searchParams.get("query") || "";
    if (keyword.trim()) {
      return `amapuri://poi/around?sourceApplication=LifeLog&keywords=${encodeURIComponent(keyword.trim())}&dev=0`;
    }

    const position = webUrl.searchParams.get("position") || "";
    const [lon, lat] = position.split(",").map((item) => item.trim());
    if (lon && lat) {
      const name = webUrl.searchParams.get("name") || "地点";
      return `amapuri://poi/detail?sourceApplication=LifeLog&poiname=${encodeURIComponent(name)}&lat=${lat}&lon=${lon}&dev=0`;
    }
  } catch {
    return "";
  }

  return "";
}

export function buildAndroidViewIntentUrl(url: string) {
  return `intent://${url.replace(/^https?:\/\//i, "")}#Intent;scheme=${url.startsWith("https://") ? "https" : "http"};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

function buildAmapUrl(place: Place) {
  const source = "LifeLog";
  const name = encodeURIComponent(place.name);

  if (place.latitude && place.longitude) {
    return `amapuri://poi/detail?sourceApplication=${source}&poiname=${name}&lat=${place.latitude}&lon=${place.longitude}&dev=0`;
  }

  const query = getAmapQuery(place.mapUrl) || [place.city, place.area, place.name].filter(Boolean).join(" ");
  if (!query.trim()) return "";

  return `amapuri://poi/around?sourceApplication=${source}&keywords=${encodeURIComponent(query.trim())}&dev=0`;
}

function getNativePackageName(platform?: PlaceLinkPlatform | string) {
  switch (platform) {
    case "amap":
      return "com.autonavi.minimap";
    case "meituan":
      return "com.sankuai.meituan";
    case "dianping":
      return "com.dianping.v1";
    case "douyin":
      return "com.ss.android.ugc.aweme";
    case "xiaohongshu":
      return "com.xingin.xhs";
    case "baidu":
      return "com.baidu.BaiduMap";
    case "tencent":
      return "com.tencent.map";
    case "wechat":
      return "com.tencent.mm";
    default:
      return "";
  }
}

function getPlatformSearchKeyword(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  try {
    const url = new URL(rawUrl);
    const queryKeyword =
      url.searchParams.get("q") ||
      url.searchParams.get("query") ||
      url.searchParams.get("keyword") ||
      url.searchParams.get("search_key");
    if (queryKeyword?.trim()) return queryKeyword.trim();

    const pathParts = url.pathname.split("/").filter(Boolean).map(decodeUrlPart);
    if (platform === "meituan") {
      const searchIndex = pathParts.findIndex((part) => part === "s" || part === "search");
      return searchIndex >= 0 ? pathParts[searchIndex + 1] || "" : "";
    }

    if (platform === "dianping") {
      const lastPart = pathParts[pathParts.length - 1] || "";
      return lastPart.replace(/^0_/, "").trim();
    }

    if (platform === "douyin") {
      const searchIndex = pathParts.findIndex((part) => part === "search");
      return searchIndex >= 0 ? pathParts[searchIndex + 1] || "" : "";
    }
  } catch {
    return "";
  }

  return "";
}

function decodeUrlPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getAmapQuery(rawUrl: string) {
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    if (!/amap\.com$/i.test(url.hostname) && !/\.amap\.com$/i.test(url.hostname)) return "";
    return url.searchParams.get("query") || url.searchParams.get("keywords") || "";
  } catch {
    return "";
  }
}
