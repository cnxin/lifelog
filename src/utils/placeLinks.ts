import type { Place } from "../types";

export interface PlacePlatformLink {
  label: string;
  url: string;
}

export function buildPlaceSearchKeyword(place: Place) {
  return [place.city, place.area, place.name, place.storeName].filter(Boolean).join(" ").trim();
}

export function buildAmapWebMarkerUrl(place: Place) {
  if (!place.latitude || !place.longitude) return "";

  const name = [place.name, place.storeName].filter(Boolean).join(" ");
  return `https://uri.amap.com/marker?position=${place.longitude},${place.latitude}&name=${encodeURIComponent(
    name
  )}&src=lifelog.place&coordinate=gaode&callnative=0`;
}

export function buildPlacePlatformLinks(place: Place): PlacePlatformLink[] {
  const keyword = buildPlaceSearchKeyword(place);
  if (!keyword) return [];

  const encoded = encodeURIComponent(keyword);
  return [
    { label: "美团", url: `https://www.meituan.com/s/${encoded}/` },
    { label: "点评", url: `https://www.dianping.com/search/keyword/9/0_${encoded}` },
    { label: "抖音", url: `https://www.douyin.com/search/${encoded}?type=general` }
  ];
}
