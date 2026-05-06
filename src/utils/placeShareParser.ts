export type PlaceSourceType = "amap" | "meituan" | "dianping" | "generic";

export interface PlaceDraft {
  name: string;
  country: string;
  city: string;
  area: string;
  storeName: string;
  category: string;
  address: string;
  latitude: string;
  longitude: string;
  mapUrl: string;
  sourceUrl: string;
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
    city: "",
    area: "",
    storeName: "",
    category: "其他",
    address: "",
    latitude: "",
    longitude: "",
    mapUrl: "",
    sourceUrl: "",
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
  const textWithoutUrl = url ? text.replace(url, " ") : text;
  const urlDraft = parseUrl(url, sourceType);
  const textDraft = parseShareText(textWithoutUrl);
  const photos = extractPhotoUrls(text).join("\n");
  const address = textDraft.address || urlDraft.address || "";
  const name = textDraft.name || urlDraft.name || fallbackName(textWithoutUrl) || "";

  return {
    ...draft,
    ...urlDraft,
    ...textDraft,
    name,
    address,
    country: "中国",
    city: textDraft.city || inferCity(address) || inferCity(textWithoutUrl) || "",
    category: textDraft.category || inferCategory(`${name} ${textWithoutUrl}`),
    mapUrl: sourceType === "amap" ? url || urlDraft.mapUrl || "" : urlDraft.mapUrl || "",
    sourceUrl: url || "",
    photos,
    desc: text.length > 160 ? text.slice(0, 160) : text,
    tags: sourceType === "generic" ? "" : sourceLabel(sourceType),
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
  const normalized = text.replace(/[「」『』【】]/g, " ").replace(/\s+/g, " ").trim();
  const address =
    pickMatch(normalized, /(?:地址|位置|地点)[:：]\s*([^，,。；;\n]+)/) ||
    pickMatch(normalized, /(中国?[\u4e00-\u9fff]{2,}(?:市|县|区)[^，,。；;\n]{4,})/);
  const city = inferCity(address) || pickMatch(normalized, /([\u4e00-\u9fff]{2,}市)/);
  const explicitName = pickMatch(normalized, /(?:店名|名称|商户|地点)[:：]\s*([^，,。；;\n]+)/);
  const discoveredName =
    explicitName ||
    pickMatch(normalized, /(?:发现|推荐|分享)(?:一家|一个|了)?([^，,。；;\n]{2,24})/) ||
    pickMatch(normalized, /我在(?:高德|美团|大众点评)[^，,。；;\n]*?([^，,。；;\n]{2,24})/);

  return {
    name: cleanName(discoveredName),
    address,
    city,
    area: inferArea(address),
    category: inferCategory(normalized)
  };
}

function extractFirstUrl(text: string) {
  return (text.match(/(?:https?:\/\/|amapuri:\/\/|androidamap:\/\/)[^\s，,。；;]+/i)?.[0] || "").trim();
}

function extractPhotoUrls(text: string) {
  return Array.from(
    new Set(
      Array.from(text.matchAll(/https?:\/\/[^\s，,。；;]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s，,。；;]+)?/gi))
        .map((match) => match[0].trim())
        .filter(Boolean)
    )
  );
}

function detectSourceType(text: string, url: string): PlaceSourceType {
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
  return pickMatch(value, /([\u4e00-\u9fff]{2,}市)/);
}

function inferArea(value = "") {
  return pickMatch(value, /([\u4e00-\u9fffA-Za-z0-9]+(?:商圈|广场|中心|景区|园区|街区|商场|天地|银泰|万达))/);
}

function inferCategory(value = "") {
  if (/酒店|宾馆|民宿/.test(value)) return "酒店";
  if (/影院|影城|电影/.test(value)) return "电影院";
  if (/景区|景点|公园|博物馆|展馆/.test(value)) return "景点";
  if (/咖啡|奶茶|茶饮|酒吧/.test(value)) return "咖啡饮品";
  if (/餐厅|火锅|烧烤|烤肉|料理|面馆|小吃|饭店|美食|店/.test(value)) return "餐厅";
  return "";
}

function fallbackName(text: string) {
  return cleanName(text.split(/[，,。；;\n]/).map((item) => item.trim()).find((item) => item.length >= 2) || "");
}

function cleanName(value = "") {
  return value
    .replace(/^(一家|一个|不错的|好吃的|推荐的)/, "")
    .replace(/(?:地址|位置|链接|电话)[:：].*$/, "")
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

function scoreDraft(name: string, address: string, url: string, sourceType: PlaceSourceType) {
  let score = 0;
  if (name) score += 35;
  if (address) score += 25;
  if (url) score += 20;
  if (sourceType !== "generic") score += 15;
  return Math.min(score, 95);
}
