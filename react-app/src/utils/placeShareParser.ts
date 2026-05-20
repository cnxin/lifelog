import { createPlatformLink, inferPlatformFromLink } from "./placeLinks";
import { inferAreaFromText, inferCityByDistrict, inferMallName, inferProvince, normalizeCityName } from "./placeMeta";

export type PlaceSourceType = "amap" | "meituan" | "dianping" | "generic";

const shareUrlPattern =
  /(?:https?:\/\/|amapuri:\/\/|androidamap:\/\/|imeituan:\/\/|meituan:\/\/|meituanwaimai:\/\/|dianping:\/\/|dianpingapp:\/\/|dper:\/\/)[^\s"'<>，。；;]+/gi;
const inlineFieldLabels = [
  "地点名称",
  "店铺名称",
  "门店名称",
  "商户名称",
  "商家名称",
  "详细地址",
  "商户地址",
  "商家地址",
  "门店地址",
  "店铺地址",
  "所在商场",
  "所在商城",
  "购物中心",
  "人均消费",
  "人均价格",
  "营业时间",
  "门店名",
  "分店名",
  "客单价",
  "店名",
  "名称",
  "商户",
  "商家",
  "地址",
  "位置",
  "电话",
  "评分",
  "星级",
  "口味",
  "环境",
  "服务",
  "人均",
  "价格",
  "营业",
  "分店",
  "门店",
  "商场",
  "商城",
  "园区"
];
const inlineFieldLabelPattern = `(?:${inlineFieldLabels.map(escapeRegExp).join("|")})`;

export interface PlaceDraft {
  name: string;
  country: string;
  province: string;
  city: string;
  area: string;
  mall: string;
  storeName: string;
  category: string;
  rating: number;
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
    rating: 0,
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

  const urls = extractUrls(text);
  const url = pickPrimaryPlaceUrl(urls, text);
  const sourceType = detectSourceType(text, url);
  const cleanText = stripUrls(text, urls);
  const urlDraft = parseUrl(url, sourceType);
  const textDraft = parseShareText(cleanText, sourceType);
  const address = cleanAddress(textDraft.address || urlDraft.address || "");
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
  const lines = normalizeShareLines(cleanText);
  const rating = textDraft.rating || extractRating(lines);
  const price = extractPrice(lines);
  const desc = buildDescription(textDraft.desc || "", price);

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
    rating,
    mapUrl: sourceType === "amap" ? url || urlDraft.mapUrl || "" : urlDraft.mapUrl || "",
    sourceUrl,
    platformLinks,
    photos: extractPhotoUrls(text).join("\n"),
    desc,
    tags: sourceType === "generic" ? "" : sourceLabel(sourceType),
    category: normalizeCategory(textDraft.category || inferCategory(`${name} ${cleanText}`)),
    sourceType,
    confidence: scoreDraft(name, address, url, sourceType, rating)
  };
}

function parseUrl(rawUrl: string, sourceType: PlaceSourceType): Partial<PlaceDraft> {
  if (!rawUrl) return {};

  if (/^(amapuri|androidamap):\/\//i.test(rawUrl)) {
    const query = rawUrl.split("?")[1] || "";
    const params = new URLSearchParams(query);
    const coords = parseCoords(params.get("location") || params.get("lnglat") || params.get("position") || "");
    return {
      name: cleanName(params.get("poiname") || params.get("dname") || params.get("name") || params.get("keywords") || ""),
      address: cleanAddress(params.get("address") || params.get("addr") || ""),
      latitude: params.get("lat") || params.get("dlat") || coords.latitude,
      longitude: params.get("lon") || params.get("lng") || params.get("dlon") || params.get("longitude") || coords.longitude,
      mapUrl: rawUrl
    };
  }

  try {
    const url = new URL(rawUrl);
    const params = collectUrlParams(url);
    const nestedUrl = safeDecodeUrl(pickParam(params, ["url", "target", "redirect", "redirectUrl", "link", "shareUrl", "weburl", "webUrl"]));
    const nestedDraft = nestedUrl && nestedUrl !== rawUrl ? parseUrl(nestedUrl, detectSourceType("", nestedUrl)) : {};
    const coords = parseCoords(
      pickParam(params, ["location", "lnglat", "position", "q", "center", "coord", "coordinate", "coordinates"]) || ""
    );
    const name = cleanName(
      pickParam(params, [
        "query",
        "keywords",
        "keyword",
        "name",
        "poiname",
        "poiName",
        "dname",
        "shopName",
        "shopname",
        "shop_name",
        "title",
        "businessName",
        "wmPoiName"
      ]) || nestedDraft.name || ""
    );
    const address = cleanAddress(
      pickParam(params, ["address", "addr", "addressName", "poiAddress", "poiaddress", "shopAddr", "shopaddr"]) ||
        nestedDraft.address ||
        ""
    );

    return {
      ...nestedDraft,
      name,
      address,
      latitude: pickParam(params, ["lat", "latitude", "dlat"]) || coords.latitude || nestedDraft.latitude || "",
      longitude: pickParam(params, ["lon", "lng", "longitude", "dlon"]) || coords.longitude || nestedDraft.longitude || "",
      mapUrl: sourceType === "amap" ? rawUrl : nestedDraft.mapUrl || ""
    };
  } catch {
    return {};
  }
}

function parseShareText(text: string, sourceType: PlaceSourceType): Partial<PlaceDraft> {
  const lines = normalizeShareLines(text);
  const normalized = lines.join(" ");
  const explicitName = pickFieldValue(lines, ["地点名称", "店铺名称", "门店名称", "商户名称", "商家名称", "店名", "名称", "商户", "商家"]);
  const sharedName = extractSharedName(text, sourceType);
  const titleLine = pickTitleLine(lines);
  const titleParts = splitTitleAndStore(explicitName || sharedName || titleLine);
  const address =
    pickFieldValue(lines, ["详细地址", "商户地址", "商家地址", "门店地址", "店铺地址", "地址", "位置"]) ||
    pickAddressLine(lines, titleLine) ||
    "";
  const name =
    titleParts.name ||
    explicitName ||
    sharedName ||
    "";
  const mall =
    pickFieldValue(lines, ["所在商场", "所在商城", "商场", "商城", "购物中心", "园区"]) ||
    titleParts.mall ||
    inferMallFromText(address) ||
    inferMallFromText(normalized);
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
    address: cleanAddress(address),
    mall,
    area: inferAreaFromText(address || normalized, mall),
    storeName: pickFieldValue(lines, ["分店", "门店", "店铺", "门店名", "分店名"]) || titleParts.storeName,
    category: inferCategoryFromLines(lines) || inferCategory(normalized),
    rating: extractRating(lines),
    desc: buildDescription("", extractPrice(lines))
  };
}

function normalizeShareLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(new RegExp(`(?:^|[\\s，,；;|｜])(${inlineFieldLabelPattern})\\s*[:：]`, "g"), "\n$1：")
    .split(/\n+|\t+/)
    .flatMap((line) => line.split(/\s{2,}|[|｜]+/))
    .map((line) => line.replace(/[【】「」『』“”]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pickTitleLine(lines: string[]) {
  return (
    lines.find((line) => {
      if (
        isUrlLine(line) ||
        isPlatformHeaderLine(line) ||
        isInstructionLine(line) ||
        isShareIntroLine(line) ||
        isMetaLine(line) ||
        isNonCategoryFieldLine(line) ||
        looksLikeAddress(line)
      ) {
        return false;
      }
      return line.length >= 2;
    }) || ""
  );
}

function pickAddressLine(lines: string[], titleLine: string) {
  const candidates = lines.filter((line) => {
    if (!line || line === titleLine) return false;
    if (isUrlLine(line) || isInstructionLine(line) || isMetaLine(line)) return false;
    return looksLikeAddress(line);
  });
  return cleanAddress(candidates[candidates.length - 1] || "");
}

function splitTitleAndStore(title: string) {
  const cleaned = cleanName(title);
  const match = cleaned.match(/^(.*?)(?:\(([^()]{2,32})\)?|（([^（）]{2,32})）?)$/);
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
  for (const line of lines) {
    if (isUrlLine(line) || isInstructionLine(line) || isShareIntroLine(line) || isNonCategoryFieldLine(line)) continue;
    const parts = line
      .split(/[·|｜/>]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const direct = parts.map(inferCategory).find(Boolean);
    if (direct) return direct;
  }

  return inferCategory(lines.filter((line) => !isShareIntroLine(line) && !isNonCategoryFieldLine(line)).join(" "));
}

function isUrlLine(line: string) {
  return /^(?:https?:\/\/|amapuri:\/\/|androidamap:\/\/|imeituan:\/\/|meituan:\/\/|meituanwaimai:\/\/|dianping:\/\/|dianpingapp:\/\/|dper:\/\/)/i.test(line) || extractUrls(line).length > 0;
}

function isMetaLine(line: string) {
  return /^(?:评分|星级|口味|环境|服务|人均|价格|电话|营业|营业时间|距离|排名|榜单|第\d+名|¥|￥|[★☆]{2,})/.test(line);
}

function isPlatformHeaderLine(line: string) {
  return /^(?:高德地图|高德|美团|大众点评|点评|地图|导航)$/.test(line.trim());
}

function isNonCategoryFieldLine(line: string) {
  return /^(?:店名|名称|地点名称|店铺名称|门店名称|商户名称|商家名称|商户|商家|地址|位置|详细地址|商户地址|商家地址|门店地址|店铺地址|分店|门店|门店名|分店名|所在商场|所在商城|商场|商城|购物中心|园区)\s*[:：]/.test(line);
}

function looksLikeAddress(line: string) {
  if (/^(?:地址|位置|详细地址|商户地址|商家地址|门店地址|店铺地址)\s*[:：]/.test(line)) return true;
  const indicators = [
    /(?:省|市|区|县|镇|乡|村)/,
    /(?:路|街|大道|巷|弄|号)/,
    /(?:幢|栋|座|层|室|号楼|F\d|B\d|\dF|B\d层)/,
    /(?:地铁站|地铁|步行)/,
    /(?:广场|商场|商城|中心|银泰|万象城|万象汇|万达|Mall|mall)/
  ];
  const signalCount = indicators.filter((pattern) => pattern.test(line)).length;
  if (signalCount >= 2) return true;
  return signalCount >= 1 && /(?:浙江|江苏|上海|北京|广州|深圳|成都|武汉|南京|杭州|绍兴|宁波)/.test(line);
}

function extractUrls(text: string) {
  return Array.from(
    new Set(
      Array.from(text.matchAll(shareUrlPattern))
        .map((match) => cleanUrl(match[0]))
        .filter(Boolean)
    )
  );
}

function pickPrimaryPlaceUrl(urls: string[], text: string) {
  return (
    urls.find((item) => detectSourceType("", item) !== "generic" || inferPlatformFromLink(item) !== "custom") ||
    urls.find((item) => /^https?:\/\//i.test(item) && !/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(item)) ||
    urls.find((item) => !/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(item)) ||
    (detectSourceType(text, "") !== "generic" ? urls[0] : "") ||
    ""
  );
}

function stripUrls(text: string, urls: string[]) {
  return urls.reduce((current, url) => current.replace(url, " "), text);
}

function cleanUrl(value: string) {
  return value.replace(/[，。；;、!！?？）)\]】"'<>]+$/g, "").trim();
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
  if (value.includes("dianping") || value.includes("dper://") || value.includes("dpurl.cn") || value.includes("大众点评") || value.includes("点评")) return "dianping";
  if (value.includes("meituan") || value.includes("imeituan://") || value.includes("美团")) return "meituan";
  if (value.includes("amap") || value.includes("高德")) return "amap";
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
  const afterProvince = value.match(/(?:省|自治区|特别行政区)([\u4e00-\u9fff]{2,12})市/)?.[1]?.trim();
  if (afterProvince) return afterProvince;
  const direct = value.match(/([\u4e00-\u9fff]{2,12})市/)?.[1]?.trim() || "";
  return direct.replace(/^.*省/, "");
}

function inferCategory(value = "") {
  if (/咖啡|咖啡厅|咖啡馆|Coffee|coffee|奶茶|茶饮|甜品|蛋糕|面包|烘焙|酒吧/.test(value)) return "咖啡厅";
  if (/西餐|中餐|火锅|烧烤|烤肉|日料|日本料理|韩餐|韩国料理|餐厅|料理|面馆|小吃|饭店|美食|店/.test(value)) return "餐厅";
  if (/商场|商城|购物中心|百货|Mall|mall|广场/.test(value)) return "商场";
  if (/酒店|宾馆|民宿/.test(value)) return "酒店";
  if (/影院|影城|电影/.test(value)) return "电影院";
  if (/公园/.test(value)) return "公园";
  if (/书店|书城/.test(value)) return "书店";
  if (/医院|诊所|卫生院/.test(value)) return "医院";
  if (/学校|大学|学院|校区/.test(value)) return "学校";
  if (/公司|写字楼|办公室|园区/.test(value)) return "公司";
  if (/景区|景点|博物馆|展馆|美术馆|寺|古镇|乐园/.test(value)) return "景点";
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
    .replace(shareUrlPattern, " ")
    .replace(/[【】「」『』“”"]/g, " ")
    .replace(/^(?:我在)?(?:高德地图|高德|美团|大众点评|点评)(?:地图|App|APP)?(?:上)?(?:发现|找到|推荐|分享)(?:了)?(?:一家|一个)?(?:不错的|好吃的)?(?:地点|店铺|商家|餐厅)?[:：，,\s]*/i, "")
    .replace(/^(?:来自|打开|分享自)?(?:高德地图|高德|美团|大众点评|点评)(?:地图|App|APP)?[:：，,\s]*/i, "")
    .replace(/^(?:我分享了?一个地点给你|分享地点|推荐店铺|推荐一家|发现一家|一家|推荐的|好吃的)[:：，,\s]*/, "")
    .replace(/(?:地址|位置|链接|电话|营业时间|营业|评分|星级|人均|价格|路线|导航|详情)[:：]?.*$/, "")
    .replace(/\s*(?:\d(?:\.\d+)?\s*(?:分|星)|[★☆]{2,}|[¥￥]\s*\d+.*|人均.*)$/, "")
    .replace(/(?:快来看看吧?|点击.*|复制.*|打开.*|查看更多.*)$/, "")
    .trim();
}

function pickMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || "";
}

function pickFieldValue(lines: string[], labels: string[]) {
  for (const line of lines) {
    for (const label of [...labels].sort((left, right) => right.length - left.length)) {
      const escaped = escapeRegExp(label);
      const match = line.match(new RegExp(`(?:^|[\\s，,；;|｜])${escaped}(?:\\s*(?:[:：]|为|是)\\s*|\\s+)([^，,；;|｜]+)`));
      if (match) {
        const value = cleanFieldValue(match[1]);
        if (value) return value;
      }
    }
  }
  return "";
}

function cleanFieldValue(value = "") {
  return value
    .replace(/(?:电话|营业时间|营业|评分|星级|人均|价格|距离|路线|导航|链接|详情)\s*[:：]?\s*.*$/, "")
    .replace(/(?:点击|复制|打开|查看更多|快来看看).*$/, "")
    .trim();
}

function extractSharedName(rawText: string, sourceType: PlaceSourceType) {
  const bracketed = pickBracketedName(rawText);
  if (bracketed) return bracketed;

  const platform = sourceType === "generic" ? "(?:高德地图|高德|美团|大众点评|点评)" : sourceLabel(sourceType);
  const patterns = [
    new RegExp(`(?:我在|来自|打开)?${platform}[^，。；\\n]*?(?:发现|找到|推荐|分享)(?:了)?(?:一家|一个)?(?:不错的)?(?:地点|店铺|商家|餐厅)?[:：\\s]*([^，。；\\n]{2,80})`),
    new RegExp(`${platform}[^，。；\\n]*?(?:商家|门店|地点)[:：\\s]*([^，。；\\n]{2,80})`),
    /(?:分享|推荐)(?:给你)?(?:一个|一家)?(?:地点|店铺|商家|餐厅)?[:：\s]*([^，。；\n]{2,80})/,
    /(?:我分享了?一个地点给你)[:：\s]*([^，。；\n]{2,80})/
  ];

  for (const pattern of patterns) {
    const value = cleanName(rawText.match(pattern)?.[1] || "");
    if (isLikelyPlaceName(value)) return value;
  }

  return "";
}

function pickBracketedName(rawText: string) {
  for (const match of rawText.matchAll(/[【「『“"]([^【】「」『』“”"]{2,80})[】」』”"]/g)) {
    const value = cleanName(match[1]);
    if (isLikelyPlaceName(value)) return value;
  }
  return "";
}

function isLikelyPlaceName(value: string) {
  if (!value || value.length < 2 || value.length > 80) return false;
  if (/(?:高德地图|高德|美团|大众点评|点评|App|APP|复制|打开|点击|查看|地址|位置|电话|营业|导航|路线|人均|评分|星级)/.test(value)) return false;
  return true;
}

function cleanAddress(value = "") {
  return cleanFieldValue(value)
    .replace(/^(?:地址|位置|详细地址|商户地址|商家地址|门店地址|店铺地址)\s*[:：]\s*/, "")
    .replace(shareUrlPattern, "")
    .replace(/[【】「」『』“”"]/g, "")
    .trim();
}

function inferMallFromText(value: string) {
  const raw = inferMallName(value);
  if (!raw) return "";
  return raw
    .replace(/^.*?(?=[\u4e00-\u9fffA-Za-z0-9·\s-]{2,24}(?:广场|商场|商城|天地|中心|银泰|万象城|万象汇|万达|印象城|大悦城|吾悦广场|天街|奥特莱斯|生活广场|国际广场|国金中心|写字楼|园区|大厦|SKP|IFS|Mall|mall)$)/, "")
    .replace(/^(?:.*(?:省|市|区|县|路|街|大道|巷|弄|号))/, "")
    .trim() || raw;
}

function buildDescription(existing: string, price: string) {
  return [existing, price ? `人均 ${price}` : ""]
    .map((item) => item.trim())
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .join("；");
}

function normalizeCategory(value = "") {
  return inferCategory(value) || value || "其他";
}

function collectUrlParams(url: URL) {
  const params = new URLSearchParams(url.search);
  const hashQuery = url.hash.includes("?") ? url.hash.slice(url.hash.indexOf("?") + 1) : url.hash.replace(/^#\/?/, "");
  if (hashQuery) {
    const hashParams = new URLSearchParams(hashQuery);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  return params;
}

function safeDecodeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const decoded = decodeURIComponent(trimmed);
    return shareUrlPattern.test(decoded) ? decoded : "";
  } catch {
    return shareUrlPattern.test(trimmed) ? trimmed : "";
  } finally {
    shareUrlPattern.lastIndex = 0;
  }
}

function pickParam(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value.trim();
  }
  return "";
}

function isInstructionLine(line: string) {
  return /(?:复制.*打开|打开.*查看|快来看看|点击链接|查看更多|App内打开|APP内打开|下载|分享自|长按复制)/i.test(line);
}

function isShareIntroLine(line: string) {
  return /(?:高德地图|高德|美团|大众点评|点评).{0,18}(?:发现|找到|推荐|分享)/.test(line);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function extractRating(lines: string[]) {
  for (const line of lines) {
    const match =
      line.match(/(?:评分|星级)[:：]?\s*(\d(?:\.\d+)?)/) ||
      line.match(/(\d(?:\.\d+)?)\s*(?:分|星)/) ||
      line.match(/(?:口味|环境|服务)\s*(\d(?:\.\d+)?)/);
    if (match) {
      const value = Number(match[1]);
      if (value > 0 && value <= 5) return value;
    }
    const stars = line.match(/[★]+/)?.[0].length || 0;
    if (stars > 0 && stars <= 5) return stars;
  }
  return 0;
}

function extractPrice(lines: string[]) {
  for (const line of lines) {
    const match =
      line.match(/(?:人均|人均消费|人均价格|客单价)[:：]?\s*[¥￥￥]?\s*(\d+)/) ||
      line.match(/[¥￥]\s*(\d+)\s*(?:\/?\s*人)?/) ||
      line.match(/(\d+)\s*(?:元|块)\s*(?:\/?\s*人)?/);
    if (match) return `¥${match[1]}/人`;
  }
  return "";
}

function scoreDraft(name: string, address: string, url: string, sourceType: PlaceSourceType, rating: number) {
  let score = 0;
  if (name) score += 35;
  if (address) score += 25;
  if (url) score += 20;
  if (rating) score += 5;
  if (sourceType !== "generic") score += 15;
  return Math.min(score, 95);
}
