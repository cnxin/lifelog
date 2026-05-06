import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { Place } from "../types";
import { buildAmapWebMarkerUrl } from "./placeLinks";

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
  const amapUrl = buildAmapUrl(place);

  if (Capacitor.isNativePlatform() && amapUrl) {
    openSchemeUrl(amapUrl);
    return;
  }

  if (place.mapUrl) {
    await openExternalUrl(place.mapUrl);
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
