import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { Place, PlaceLinkPlatform } from "../types";
import { buildAmapWebMarkerUrl, inferPlatformFromLink, normalizeHttpsUrl, normalizePlaceNavigationUrl } from "./placeLinks";

interface NativeExternalBrowserPlugin {
  open(options: { url: string; packageName?: string }): Promise<void>;
  installApk(options: { url: string; fileName?: string; fallbackUrl?: string; expectedSha256?: string; expectedSize?: number }): Promise<void>;
  canInstallPackages(): Promise<{ granted: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  addListener(eventName: "apkDownloadProgress", listenerFunc: (progress: ApkDownloadProgress) => void): Promise<PluginListenerHandle>;
}

interface NativeLaunchTarget {
  urls: string[];
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
  const url = normalizeHttpsUrl(rawUrl);
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    const target = getNativeLaunchTarget(url);
    await openNativeViewUrl(target.urls, target.packageName, target.fallbackUrl);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openApkDownloadUrl(rawUrl: string) {
  const url = normalizeHttpsUrl(rawUrl);
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    await openNativeApkInstaller(url);
    return;
  }

  await openExternalUrl(url);
}

export async function openApkDownload(update: { apkUrl?: string; mirrorApkUrl?: string; releaseUrl?: string; apkName?: string; apkSha256?: string; apkSize?: number } | null | undefined) {
  if (!update) return;
  const primaryUrl = update.mirrorApkUrl || update.apkUrl || update.releaseUrl || "";
  const fallbackUrl = primaryUrl === update.apkUrl ? update.mirrorApkUrl || "" : update.apkUrl || "";
  await openApkDownloadUrlWithFallback(primaryUrl, update.apkName, fallbackUrl, update.apkSha256, update.apkSize);
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

export async function openApkDownloadUrlWithFallback(rawUrl: string, fileName = "", rawFallbackUrl = "", expectedSha256 = "", expectedSize = 0) {
  const url = normalizeHttpsUrl(rawUrl);
  const fallbackUrl = normalizeHttpsUrl(rawFallbackUrl);
  if (!url) return;
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256) || !Number.isSafeInteger(expectedSize) || expectedSize < 1024) {
    throw new Error("Update package integrity information is missing or invalid");
  }

  if (Capacitor.isNativePlatform()) {
    await openNativeApkInstaller(url, fileName, fallbackUrl, expectedSha256, expectedSize);
    return;
  }

  await openExternalUrl(url);
}

export async function openNativeStoreUrl(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  const url = normalizePlaceNavigationUrl(rawUrl);
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    const target = getNativeLaunchTarget(url, platform);
    await openNativeViewUrl(target.urls, target.packageName, target.fallbackUrl);
    return;
  }

  await openExternalUrl(url);
}

export async function openPlaceMap(place: Place) {
  const amapUrls = buildAmapUrls(place);

  if (Capacitor.isNativePlatform() && amapUrls.length) {
    await openNativeViewUrl(amapUrls, getNativePackageName("amap"), place.mapUrl || buildAmapWebUrl(place));
    return;
  }

  const amapWebUrl = buildAmapWebMarkerUrl(place);
  if (amapWebUrl) {
    await openExternalUrl(amapWebUrl);
    return;
  }

  if (place.mapUrl) {
    await openNativeStoreUrl(place.mapUrl, "amap");
    return;
  }

  const searchUrl = buildAmapWebSearchUrl(place);
  if (searchUrl) {
    await openExternalUrl(searchUrl);
    return;
  }

  if (amapUrls[0]) {
    openSchemeUrl(amapUrls[0]);
  }
}

function openSchemeUrl(url: string) {
  window.location.href = url;
}

async function openNativeViewUrl(url: string | string[], packageName = "", fallbackUrl = "") {
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
  const fallback = normalizePlaceNavigationUrl(fallbackUrl || (Array.isArray(url) ? url[0] : url));
  if (!fallback) throw new Error("Unsupported external URL");
  window.location.href = fallback.startsWith("https://") ? buildAndroidViewIntentUrl(fallback) : fallback;
}

async function openNativeApkInstaller(url: string, fileName = "", fallbackUrl = "", expectedSha256 = "", expectedSize = 0) {
  try {
    await NativeExternalBrowser.installApk({ url, fileName, fallbackUrl, expectedSha256, expectedSize });
  } catch (error) {
    console.warn("原生 APK 下载打开失败，回退到外部链接:", error);
    await openNativeViewUrl(fallbackUrl || url);
  }
}

function buildNativeOpenAttempts(url: string | string[], packageName = "", fallbackUrl = "") {
  const attempts: Array<{ url: string; packageName?: string }> = [];
  const urls = Array.isArray(url) ? url : [url];
  const add = (nextUrl: string, nextPackageName = "") => {
    const safeUrl = normalizePlaceNavigationUrl(nextUrl);
    if (!safeUrl) return;
    const key = `${safeUrl}|${nextPackageName}`;
    if (attempts.some((attempt) => `${attempt.url}|${attempt.packageName || ""}` === key)) return;
    attempts.push(nextPackageName ? { url: safeUrl, packageName: nextPackageName } : { url: safeUrl });
  };

  urls.forEach((item) => add(item, packageName));
  add(fallbackUrl, packageName);
  urls.forEach((item) => add(item));
  add(fallbackUrl);
  return attempts;
}

function getNativeLaunchTarget(rawUrl: string, platform?: PlaceLinkPlatform | string): NativeLaunchTarget {
  const detectedPlatform = platform || inferPlatformFromLink(rawUrl);
  const nativeUrls = buildNativeAppDeepLinkVariants(rawUrl, detectedPlatform);
  return {
    urls: nativeUrls.length ? nativeUrls : [rawUrl],
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

function buildNativeAppDeepLinkVariants(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  const url = rawUrl.trim();
  if (!url) return [];
  const detectedPlatform = platform || inferPlatformFromLink(url);
  const keyword = /^https?:\/\//i.test(url) ? getPlatformSearchKeyword(url, detectedPlatform) : "";
  const encodedKeyword = keyword ? encodeURIComponent(keyword) : "";
  const variants: string[] = [];
  const add = (value: string) => {
    if (value && !variants.includes(value)) variants.push(value);
  };

  add(buildNativeAppDeepLink(url, detectedPlatform));

  if (/^https?:\/\//i.test(url)) {
    switch (detectedPlatform) {
      case "amap":
        add(buildAmapDeepLinkFromWebUrl(url));
        break;
      case "meituan":
        if (encodedKeyword) {
          add(`imeituan://www.meituan.com/search?q=${encodedKeyword}`);
        }
        add(`imeituan://www.meituan.com/web?url=${encodeURIComponent(url)}`);
        add(`meituan://www.meituan.com/web?url=${encodeURIComponent(url)}`);
        break;
      case "dianping":
        if (encodedKeyword) {
          add(`dianping://searchshoplist?keyword=${encodedKeyword}`);
        }
        add(`dianping://web?url=${encodeURIComponent(url)}`);
        add(`dianpingapp://web?url=${encodeURIComponent(url)}`);
        break;
      default:
        break;
    }
  }

  add(url);
  return variants;
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
      return buildAmapRouteUrl({ lat, lon, name });
    }
  } catch {
    return "";
  }

  return "";
}

export function buildAndroidViewIntentUrl(url: string) {
  const safeUrl = normalizeHttpsUrl(url);
  if (!safeUrl) return "";
  return `intent://${safeUrl.replace(/^https:\/\//i, "")}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

function buildAmapUrls(place: Place) {
  const source = "LifeLog";
  const name = buildAmapPlaceName(place);
  const coords = getPlaceCoordinates(place);
  const urls: string[] = [];
  const add = (url: string) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  if (coords) {
    add(buildAmapRouteUrl({ ...coords, name }));
    add(`androidamap://viewMap?sourceApplication=${source}&poiname=${encodeURIComponent(name)}&lat=${coords.lat}&lon=${coords.lon}&dev=0`);
    add(`amapuri://poi/detail?sourceApplication=${source}&poiname=${encodeURIComponent(name)}&lat=${coords.lat}&lon=${coords.lon}&dev=0`);
  }

  const query = getAmapQuery(place.mapUrl) || buildAmapSearchKeyword(place);
  if (query.trim()) {
    add(`amapuri://poi/around?sourceApplication=${source}&keywords=${encodeURIComponent(query.trim())}&dev=0`);
  }

  return urls;
}

function buildAmapRouteUrl(target: { lat: string | number; lon: string | number; name: string }) {
  return `androidamap://route/plan/?sourceApplication=LifeLog&dlat=${target.lat}&dlon=${target.lon}&dname=${encodeURIComponent(target.name)}&dev=0&t=0`;
}

function buildAmapWebUrl(place: Place) {
  return buildAmapWebMarkerUrl(place) || place.mapUrl || buildAmapWebSearchUrl(place);
}

function buildAmapWebSearchUrl(place: Place) {
  const keyword = buildAmapSearchKeyword(place);
  return keyword ? `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}` : "";
}

function buildAmapSearchKeyword(place: Place) {
  return [place.city, place.area, place.address, place.mall, place.name, place.storeName].filter(Boolean).join(" ").trim();
}

function buildAmapPlaceName(place: Place) {
  return [place.name, place.mall, place.storeName].filter(Boolean).join(" ") || "地点";
}

function getPlaceCoordinates(place: Place): { lat: string; lon: string } | null {
  if (place.latitude && place.longitude) {
    return { lat: String(place.latitude), lon: String(place.longitude) };
  }
  return getAmapCoordinates(place.mapUrl);
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
    return url.searchParams.get("query") || url.searchParams.get("keyword") || url.searchParams.get("keywords") || url.searchParams.get("name") || "";
  } catch {
    return "";
  }
}

function getAmapCoordinates(rawUrl: string): { lat: string; lon: string } | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (!/amap\.com$/i.test(url.hostname) && !/\.amap\.com$/i.test(url.hostname)) return null;
    const position = url.searchParams.get("position") || url.searchParams.get("location") || "";
    const [lon, lat] = position.split(",").map((item) => item.trim());
    if (isCoordinate(lat) && isCoordinate(lon)) return { lat, lon };

    const nextLat = url.searchParams.get("lat") || url.searchParams.get("latitude") || "";
    const nextLon = url.searchParams.get("lon") || url.searchParams.get("lng") || url.searchParams.get("longitude") || "";
    if (isCoordinate(nextLat) && isCoordinate(nextLon)) return { lat: nextLat, lon: nextLon };
  } catch {
    return null;
  }

  return null;
}

function isCoordinate(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}
