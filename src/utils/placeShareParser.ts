import { createPlatformLink, inferPlatformFromLink } from "./placeLinks";
import { inferAreaFromText, inferCityByDistrict, inferMallName, inferProvince, normalizeCityName } from "./placeMeta";

export type PlaceSourceType = "amap" | "meituan" | "dianping" | "generic";

export interface PlaceDraft {
  name: string;
  country: string;
  province: string;
  city: string;
  area: string;
  mall: string;
  storeName: string;
  category: string;
  address: string;
  latitude: string;
  longitude: string;
  mapUrl: string;
  sourceUrl: string;
  platformLinks: string;
  photos: string;
  desc: string;
  tags: string;
  sourceType: PlaceSourceType;
  confidence: number;
}

export function emptyPlaceDraft(): PlaceDraft {
  return {
    name: "",
    country: "中国",
    province: "",
    city: "",
    area: "",
    mall: "",
    storeName: "",
    category: "其他",
    address: "",
    latitude: "",
    longitude: "",
    mapUrl: "",
    sourceUrl: "",
    platformLinks: "",
    photos: "",
    desc: "",
    tags: "",
    sourceType: "generic",
    confidence: 0
  };
}

export function parsePlaceShare(input: string): PlaceDraft {
  const text = input.trim();
  const draft = emptyPlaceDraft();
  if (!text) return draft;

  const url = extractFirstUrl(text);
  const sourceType = detectSourceType(text, url);
  const cleanText = url ? text.replace(url, " ") : text;
  const urlDraft = parseUrl(url, sourceType);
  const textDraft = parseShareText(cleanText);
  const address = textDraft.address || urlDraft.address || "";
  const city = normalizeCityName(textDraft.city || inferCity(address) || inferCity(cleanText) || inferCityByDistrict(`${address} ${cleanText}`));
  const mall = textDraft.mall || inferMallName(address) || inferMallName(cleanText);
  const area = textDraft.area || inferAreaFromText(address || cleanText, mall);
  const province = inferProvince({
    country: "中国",
    province: textDraft.province,
    city,
    address
  });
  const name = textDraft.name || urlDraft.name || fallbackName(cleanText);
  const platformLinks = buildPlatformLinks(url, sourceType);
  const sourceUrl = sourceType === "meituan" || sourceType === "dianping" ? "" : url;

  return {
    ...draft,
    ...urlDraft,
    ...textDraft,
    name,
    country: "中国",
    province,
    city,
    area,
    mall,
    address,
    mapUrl: sourceType === "amap" ? url || urlDraft.mapUrl || "" : urlDraft.mapUrl || "",
    sourceUrl,
    platformLinks,
    photos: extractPhotoUrls(text).join("\n"),
    tags: sourceType === "generic" ? "" : sourceLabel(sourceType),
    category: textDraft.category || inferCategory(`${name} ${cleanText}`),
    sourceType,
    confidence: scoreDraft(name, address, url, sourceType)
  };
}

function parseUrl(rawUrl: string, sourceType: PlaceSourceType): Partial<PlaceDraft> {
  if (!rawUrl) return {};

  if (/^(amapuri|androidamap):\/\//i.test(rawUrl)) {
    const query = rawUrl.split("?")[1] || "";
    const params = new URLSearchParams(query);
    const coords = parseCoords(params.get("location") || params.get("lnglat") || "");
    return {
      name: params.get("poiname") || params.get("name") || params.get("keywords") || "",
      latitude: params.get("lat") || coords.latitude,
      longitude: params.get("lon") || params.get("longitude") || coords.longitude,
      mapUrl: rawUrl
    };
  }

  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;
    const coords = parseCoords(
      params.get("location") || params.get("lnglat") || params.get("q") || params.get("center") || ""
    );

    return {
      name: params.get("query") || params.get("keywords") || params.get("name") || params.get("poiname") || "",
      address: params.get("address") || "",
      latitude: params.get("lat") || params.get("latitude") || coords.latitude,
      longitude: params.get("lon") || params.get("lng") || params.get("longitude") || coords.longitude,
      mapUrl: sourceType === "amap" ? rawUrl : ""
    };
  } catch {
    return {};
  }
}

function parseShareText(text: string): Partial<PlaceDraft> {
  const lines = normalizeShareLines(text);
  const normalized = lines.join(" ");
  const titleLine = pickTitleLine(lines);
  const titleParts = splitTitleAndStore(titleLine);
  const address =
    pickMatch(normalized, /(?:地址|位置|地点)[:：]?\s*([^\n]+)/) ||
    pickAddressLine(lines, titleLine) ||
    "";
  const name =
    pickMatch(normalized, /(?:店名|名称|商户|地点)[:：]?\s*([^\n]+)/) ||
    titleParts.name ||
    pickMatch(normalized, /我在(?:高德|美团|大众点评)[^，。；\n]*?发现了([^，。；\n]{2,40})/) ||
    "";
  const mall = titleParts.mall || inferMallName(address) || inferMallName(normalized);
  const city = normalizeCityName(inferCity(address) || inferCity(normalized) || inferCityByDistrict(`${address} ${normalized}`));
  const province = inferProvince({
    country: "中国",
    city,
    address
  });

  return {
    name: cleanName(name),
    province,
    city,
    address,
    mall,
    area: inferAreaFromText(address || normalized, mall),
    storeName: titleParts.storeName,
    category: inferCategoryFromLines(lines) || inferCategory(normalized)
  };
}

function normalizeShareLines(text: string) {
  return text
    .split(/\r?\n+/)
    .map((line) => line.replace(/[【】「」『』（）]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pickTitleLine(lines: string[]) {
  return (
    lines.find((line) => {
      if (isUrlLine(line) || isMetaLine(line) || looksLikeAddress(line)) return false;
      return line.length >= 2;
    }) || ""
  );
}

function pickAddressLine(lines: string[], titleLine: string) {
  const candidates = lines.filter((line) => {
    if (!line || line === titleLine) return false;
    if (isUrlLine(line) || isMetaLine(line)) return false;
    return looksLikeAddress(line);
  });
  return candidates[candidates.length - 1] || "";
}

function splitTitleAndStore(title: string) {
  const cleaned = cleanName(title);
  const match = cleaned.match(/^(.*?)(?:\(([^()]{2,32})\)|（([^（）]{2,32})）)$/);
  if (!match) {
    return {
      name: cleaned,
      mall: inferMallName(cleaned),
      storeName: ""
    };
  }

  const storeName = (match[2] || match[3] || "").trim();
  return {
    name: cleanName(match[1]),
    mall: inferMallName(storeName),
    storeName
  };
}

function inferCategoryFromLines(lines: string[]) {
  const knownCategories = [
    "西餐",
    "中餐",
    "火锅",
    "烧烤",
    "日料",
    "韩餐",
    "咖啡",
    "茶饮",
    "甜品",
    "酒吧",
    "酒店",
    "景点",
    "电影院"
  ];

  for (const line of lines) {
    const parts = line
      .split(/[·|｜/]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const direct = parts.find((part) => knownCategories.includes(part));
    if (direct) return direct;
  }

  return knownCategories.find((category) => lines.some((line) => line.includes(category))) || "";
}

function isUrlLine(line: string) {
  return /^(?:https?:\/\/|amapuri:\/\/|androidamap:\/\/)/i.test(line);
}

function isMetaLine(line: string) {
  return /(?:\d+(?:\.\d+)?分|¥\d+|人均|榜|第\d+名)/.test(line);
}

function looksLikeAddress(line: string) {
  return /(?:省|市|区|县|路|街|大道|广场|中心|国际|写字楼|地铁站|步行|商场|Mall|mall|F\d|B\d)/.test(line);
}

function extractFirstUrl(text: string) {
  return (text.match(/(?:https?:\/\/|amapuri:\/\/|androidamap:\/\/)[^\s，。；;]+/i)?.[0] || "").trim();
}

function extractPhotoUrls(text: string) {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/https?:\/\/[^\s，。；;]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s，。；;]+)?/gi))
        .map((match) => match[0].trim())
        .filter(Boolean)
    )
  );
}

function detectSourceType(text: string, url: string): PlaceSourceType {
  const linkPlatform = inferPlatformFromLink(url);
  if (linkPlatform === "amap") return "amap";
  if (linkPlatform === "meituan") return "meituan";
  if (linkPlatform === "dianping") return "dianping";

  const value = `${text} ${url}`.toLowerCase();
  if (value.includes("amap") || value.includes("高德")) return "amap";
  if (value.includes("meituan") || value.includes("美团")) return "meituan";
  if (value.includes("dianping") || value.includes("大众点评")) return "dianping";
  return "generic";
}

function parseCoords(value: string) {
  const match = value.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: "", longitude: "" };

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (Math.abs(first) > 90) {
    return { longitude: String(first), latitude: String(second) };
  }
  return { latitude: String(first), longitude: String(second) };
}

function inferCity(value = "") {
  return value.match(/([\u4e00-\u9fff]{2,12})市/)?.[1]?.trim() || "";
}

function inferCategory(value = "") {
  if (/西餐/.test(value)) return "西餐";
  if (/中餐/.test(value)) return "中餐";
  if (/火锅/.test(value)) return "火锅";
  if (/烧烤/.test(value)) return "烧烤";
  if (/日料|日本料理/.test(value)) return "日料";
  if (/韩餐|韩国料理/.test(value)) return "韩餐";
  if (/酒店|宾馆|民宿/.test(value)) return "酒店";
  if (/影院|影城|电影/.test(value)) return "电影院";
  if (/景区|景点|公园|博物馆|展馆/.test(value)) return "景点";
  if (/咖啡|奶茶|茶饮|酒吧/.test(value)) return "咖啡饮品";
  if (/餐厅|料理|面馆|小吃|饭店|美食|店/.test(value)) return "餐厅";
  return "";
}

function fallbackName(text: string) {
  return cleanName(
    text
      .split(/[，。；;\n]/)
      .map((item) => item.trim())
      .find((item) => item.length >= 2) || ""
  );
}

function cleanName(value = "") {
  return value
    .replace(/^(发现一家|一家|推荐的|好吃的)/, "")
    .replace(/(?:地址|位置|链接|电话)[:：].*$/, "")
    .replace(/[【】]/g, "")
    .trim();
}

function pickMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || "";
}

function sourceLabel(sourceType: PlaceSourceType) {
  if (sourceType === "amap") return "高德";
  if (sourceType === "meituan") return "美团";
  if (sourceType === "dianping") return "大众点评";
  return "";
}

function buildPlatformLinks(url: string, sourceType: PlaceSourceType) {
  if (!url) return "";
  if (sourceType !== "meituan" && sourceType !== "dianping") return "";

  const label = sourceType === "meituan" ? "美团" : "点评";
  const link = createPlatformLink(url, label);
  if (!link) return "";
  return `${link.label} | ${link.url}`;
}

function scoreDraft(name: string, address: string, url: string, sourceType: PlaceSourceType) {
  let score = 0;
  if (name) score += 35;
  if (address) score += 25;
  if (url) score += 20;
  if (sourceType !== "generic") score += 15;
  return Math.min(score, 95);
}
