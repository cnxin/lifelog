import type { Place, PlaceExternalLink, PlaceLinkPlatform } from "../types";

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

export function buildGeneratedPlatformLinks(place: Place): PlaceExternalLink[] {
  const keyword = buildPlaceSearchKeyword(place);
  if (!keyword) return [];

  const encoded = encodeURIComponent(keyword);
  return [
    { label: "美团", platform: "meituan", url: `https://www.meituan.com/s/${encoded}/` },
    { label: "点评", platform: "dianping", url: `https://www.dianping.com/search/keyword/9/0_${encoded}` },
    { label: "抖音", platform: "douyin", url: `https://www.douyin.com/search/${encoded}?type=general` }
  ];
}

export function buildPlacePlatformLinks(place: Place): PlaceExternalLink[] {
  return mergePlacePlatformLinks(place.platformLinks, buildGeneratedPlatformLinks(place));
}

export function mergePlacePlatformLinks(
  savedLinks: PlaceExternalLink[] = [],
  generatedLinks: PlaceExternalLink[] = []
) {
  const saved = normalizePlacePlatformLinks(savedLinks);
  const savedPlatforms = new Set(saved.filter((link) => link.platform !== "custom").map((link) => link.platform));
  const generated = normalizePlacePlatformLinks(generatedLinks).filter((link) => !savedPlatforms.has(link.platform));
  const links = [...saved, ...generated];
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.platform}:${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizePlacePlatformLinks(value: unknown): PlaceExternalLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const link = item as Partial<PlaceExternalLink>;
      const url = String(link.url || "").trim();
      if (!url) return null;

      const platform = normalizePlatform(link.platform, url);
      return {
        label: String(link.label || defaultPlatformLabel(platform)).trim(),
        platform,
        url
      };
    })
    .filter((item): item is PlaceExternalLink => Boolean(item));
}

export function parsePlatformLinksText(value: FormDataEntryValue | null): PlaceExternalLink[] {
  return String(value || "")
    .split(/\n+/)
    .map((line) => parsePlatformLinkLine(line))
    .filter((item): item is PlaceExternalLink => Boolean(item));
}

export function platformLinksToText(links: PlaceExternalLink[] = []) {
  return links.map((link) => `${link.label} | ${link.url}`).join("\n");
}

export function createPlatformLink(url: string, label = ""): PlaceExternalLink | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const platform = normalizePlatform(undefined, trimmedUrl);
  return {
    label: label.trim() || defaultPlatformLabel(platform),
    platform,
    url: trimmedUrl
  };
}

function parsePlatformLinkLine(line: string): PlaceExternalLink | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const [rawLabel, ...rest] = trimmed.split("|");
  const hasLabel = rest.length > 0;
  const url = (hasLabel ? rest.join("|") : rawLabel).trim();
  const label = hasLabel ? rawLabel.trim() : "";
  return createPlatformLink(url, label);
}

function normalizePlatform(platform: unknown, url: string): PlaceLinkPlatform {
  const value = String(platform || "").trim();
  if (["amap", "meituan", "dianping", "douyin", "custom"].includes(value)) {
    return value as PlaceLinkPlatform;
  }

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("amap.com") || lowerUrl.startsWith("amapuri://") || lowerUrl.startsWith("androidamap://")) return "amap";
  if (lowerUrl.includes("meituan.com")) return "meituan";
  if (lowerUrl.includes("dianping.com")) return "dianping";
  if (lowerUrl.includes("douyin.com")) return "douyin";
  return "custom";
}

function defaultPlatformLabel(platform: PlaceLinkPlatform) {
  if (platform === "amap") return "高德";
  if (platform === "meituan") return "美团";
  if (platform === "dianping") return "点评";
  if (platform === "douyin") return "抖音";
  return "链接";
}
