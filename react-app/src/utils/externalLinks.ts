import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Place, PlaceLinkPlatform } from "../types";
import { buildAmapWebMarkerUrl, inferPlatformFromLink } from "./placeLinks";

interface NativeExternalBrowserPlugin {
  open(options: { url: string; packageName?: string }): Promise<void>;
}

const NativeExternalBrowser = registerPlugin<NativeExternalBrowserPlugin>("NativeExternalBrowser");

export async function openExternalUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    await openNativeViewUrl(url, getNativePackageName(inferPlatformFromLink(url)));
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
    await openNativeViewUrl(url);
    return;
  }

  await openExternalUrl(url);
}

export async function openNativeStoreUrl(rawUrl: string, platform?: PlaceLinkPlatform | string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    await openNativeViewUrl(url, getNativePackageName(platform || inferPlatformFromLink(url)));
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

async function openNativeViewUrl(url: string, packageName = "") {
  try {
    await NativeExternalBrowser.open({ url, packageName });
  } catch (error) {
    if (packageName) {
      try {
        await NativeExternalBrowser.open({ url });
        return;
      } catch (fallbackError) {
        console.warn("原生外部链接打开失败，回退到系统链接:", fallbackError);
      }
    } else {
      console.warn("原生外部链接打开失败，回退到系统链接:", error);
    }
    window.location.href = /^https?:\/\//i.test(url) ? buildAndroidViewIntentUrl(url) : url;
  }
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
