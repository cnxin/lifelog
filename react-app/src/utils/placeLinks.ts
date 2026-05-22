import type { Place, PlaceExternalLink, PlaceLinkPlatform } from "../types";

export type PresetPlaceLinkPlatform = Exclude<PlaceLinkPlatform, "custom">;

export const PLACE_LINK_PLATFORM_DEFS: Array<{
  platform: PresetPlaceLinkPlatform;
  label: string;
  placeholder: string;
}> = [
  { platform: "amap", label: "高德", placeholder: "粘贴高德地点页、分享链接或 amapuri:// 链接" },
  { platform: "meituan", label: "美团", placeholder: "粘贴美团店铺页、分享链接或 meituan:// 链接" },
  { platform: "dianping", label: "大众点评", placeholder: "粘贴点评店铺页、dpurl.cn 或 dianping:// 链接" },
  { platform: "douyin", label: "抖音", placeholder: "粘贴抖音地点页、团购页、v.douyin.com 短链或搜索结果" },
  { platform: "xiaohongshu", label: "小红书", placeholder: "粘贴小红书笔记、地点页、xhslink.com 短链或 xhsdiscover:// 链接" },
  { platform: "baidu", label: "百度地图", placeholder: "粘贴百度地图地点页、map.baidu.com 或 baidumap:// 链接" },
  { platform: "tencent", label: "腾讯地图", placeholder: "粘贴腾讯地图地点页、map.qq.com 或 qqmap:// 链接" },
  { platform: "wechat", label: "微信", placeholder: "粘贴微信位置、公众号文章、mp.weixin.qq.com 或 weixin:// 链接" },
  { platform: "official", label: "官网/公众号", placeholder: "粘贴官网、公众号、小程序或其他官方入口链接" }
];

const presetPlatformValues = new Set<PlaceLinkPlatform>(PLACE_LINK_PLATFORM_DEFS.map((item) => item.platform));

export function buildPlaceSearchKeyword(place: Place) {
  return [place.city, place.area, place.mall, place.name, place.storeName].filter(Boolean).join(" ").trim();
}

export function buildAmapWebMarkerUrl(place: Place) {
  if (!place.latitude || !place.longitude) return "";

  const name = [place.name, place.mall, place.storeName].filter(Boolean).join(" ");
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
    { label: "抖音", platform: "douyin", url: `https://www.douyin.com/search/${encoded}?type=general` },
    { label: "小红书", platform: "xiaohongshu", url: `https://www.xiaohongshu.com/search_result?keyword=${encoded}` }
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
      const label = String(link.label || "").trim();

      const platform = normalizePlatform(link.platform, label, url);
      const labelConflictsWithUrl = doesLabelConflictWithUrl(label, url);
      return {
        label: labelConflictsWithUrl ? defaultPlatformLabel(platform) : label || defaultPlatformLabel(platform),
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

  const platform = normalizePlatform(undefined, label, trimmedUrl);
  const rawLabel = label.trim();
  const labelConflictsWithUrl = doesLabelConflictWithUrl(rawLabel, trimmedUrl);
  return {
    label: labelConflictsWithUrl ? defaultPlatformLabel(platform) : rawLabel || defaultPlatformLabel(platform),
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

export function inferPlatformFromLink(url: string, label = "", platform?: PlaceLinkPlatform | string) {
  return normalizePlatform(platform, label, url);
}

function normalizePlatform(platform: unknown, label: unknown, url: string): PlaceLinkPlatform {
  const value = String(platform || "").trim();
  const lowerLabel = String(label || "").trim().toLowerCase();
  const lowerUrl = url.toLowerCase();
  const urlPlatform = detectPlatformFromUrl(lowerUrl);
  if (urlPlatform !== "custom") return urlPlatform;

  if (presetPlatformValues.has(value as PlaceLinkPlatform)) {
    return value as PlaceLinkPlatform;
  }

  const labelPlatform = detectPlatformFromLabel(lowerLabel);
  if (labelPlatform !== "custom") return labelPlatform;

  return "custom";
}

function detectPlatformFromLabel(lowerLabel: string): PlaceLinkPlatform {
  if (lowerLabel.includes("高德") || lowerLabel.includes("amap")) return "amap";
  if (lowerLabel.includes("美团") || lowerLabel.includes("meituan")) return "meituan";
  if (lowerLabel.includes("点评") || lowerLabel.includes("dianping")) return "dianping";
  if (lowerLabel.includes("抖音") || lowerLabel.includes("douyin")) return "douyin";
  if (lowerLabel.includes("小红书") || lowerLabel.includes("xiaohongshu") || lowerLabel.includes("xhs")) return "xiaohongshu";
  if (lowerLabel.includes("百度") || lowerLabel.includes("baidu")) return "baidu";
  if (lowerLabel.includes("腾讯") || lowerLabel.includes("qqmap") || lowerLabel.includes("tencent")) return "tencent";
  if (lowerLabel.includes("微信") || lowerLabel.includes("wechat") || lowerLabel.includes("weixin")) return "wechat";
  if (lowerLabel.includes("官网") || lowerLabel.includes("官方网站") || lowerLabel.includes("官方") || lowerLabel.includes("公众号") || lowerLabel.includes("official")) return "official";
  return "custom";
}

function detectPlatformFromUrl(lowerUrl: string): PlaceLinkPlatform {
  if (lowerUrl.includes("amap.com") || lowerUrl.startsWith("amapuri://") || lowerUrl.startsWith("androidamap://")) return "amap";
  if (
    lowerUrl.includes("meituan.com") ||
    lowerUrl.includes("meishi.meituan.com") ||
    lowerUrl.includes("i.meituan.com") ||
    lowerUrl.startsWith("imeituan://") ||
    lowerUrl.startsWith("meituan://") ||
    lowerUrl.startsWith("meituanwaimai://")
  ) return "meituan";
  if (
    lowerUrl.includes("dianping.com") ||
    lowerUrl.includes("dpurl.cn") ||
    lowerUrl.startsWith("dianping://") ||
    lowerUrl.startsWith("dianpingapp://") ||
    lowerUrl.startsWith("dper://")
  ) return "dianping";
  if (lowerUrl.includes("douyin.com") || lowerUrl.includes("v.douyin.com") || lowerUrl.startsWith("snssdk1128://")) return "douyin";
  if (
    lowerUrl.includes("xiaohongshu.com") ||
    lowerUrl.includes("xhslink.com") ||
    lowerUrl.startsWith("xhsdiscover://") ||
    lowerUrl.startsWith("xiaohongshu://")
  ) return "xiaohongshu";
  if (
    lowerUrl.includes("map.baidu.com") ||
    lowerUrl.includes("api.map.baidu.com") ||
    lowerUrl.startsWith("baidumap://") ||
    lowerUrl.startsWith("bdmap://") ||
    lowerUrl.startsWith("bdapp://")
  ) return "baidu";
  if (
    lowerUrl.includes("map.qq.com") ||
    lowerUrl.includes("apis.map.qq.com") ||
    lowerUrl.startsWith("qqmap://") ||
    lowerUrl.startsWith("tencentmap://")
  ) return "tencent";
  if (
    lowerUrl.includes("mp.weixin.qq.com") ||
    lowerUrl.includes("weixin.qq.com") ||
    lowerUrl.includes("servicewechat.com") ||
    lowerUrl.startsWith("weixin://")
  ) return "wechat";
  return "custom";
}

function doesLabelConflictWithUrl(label: string, url: string) {
  const labelPlatform = detectPlatformFromLabel(label.toLowerCase());
  const urlPlatform = detectPlatformFromUrl(url.toLowerCase());
  return Boolean(label && urlPlatform !== "custom" && labelPlatform !== "custom" && labelPlatform !== urlPlatform);
}

export function defaultPlatformLabel(platform: PlaceLinkPlatform) {
  return PLACE_LINK_PLATFORM_DEFS.find((item) => item.platform === platform)?.label || "链接";
}
