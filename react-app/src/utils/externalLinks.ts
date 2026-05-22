import { Browser } from "@capacitor/browser";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Place } from "../types";
import { buildAmapWebMarkerUrl } from "./placeLinks";

interface NativeExternalBrowserPlugin {
  open(options: { url: string }): Promise<void>;
}

const NativeExternalBrowser = registerPlugin<NativeExternalBrowserPlugin>("NativeExternalBrowser");

export async function openExternalUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (/^https?:\/\//i.test(url)) {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = url;
}

export async function openApkDownloadUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform() && /^https?:\/\//i.test(url)) {
    try {
      await NativeExternalBrowser.open({ url });
      return;
    } catch (error) {
      console.warn("原生外部浏览器打开失败，回退到系统链接:", error);
      window.location.href = buildAndroidViewIntentUrl(url);
      return;
    }
  }

  await openExternalUrl(url);
}

export async function openNativeStoreUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    window.location.href = url;
    return;
  }

  await openExternalUrl(url);
}

export async function openPlaceMap(place: Place) {
  if (Capacitor.isNativePlatform() && place.latitude && place.longitude) {
    const url = buildAmapUrl(place);
    if (url) {
      openSchemeUrl(url);
      return;
    }
  }

  if (place.mapUrl) {
    await openExternalUrl(place.mapUrl);
    return;
  }

  const amapUrl = buildAmapUrl(place);

  if (Capacitor.isNativePlatform() && amapUrl) {
    openSchemeUrl(amapUrl);
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
