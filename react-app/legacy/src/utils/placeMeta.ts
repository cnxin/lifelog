import type { Place, PlaceExternalLink, PlaceLinkPlatform } from "../types";
import { createPlatformLink, inferPlatformFromLink } from "./placeLinks";

const chinaCityProvinceMap: Record<string, string> = {
  北京: "北京市",
  上海: "上海市",
  天津: "天津市",
  重庆: "重庆市",
  杭州: "浙江省",
  宁波: "浙江省",
  绍兴: "浙江省",
  嘉兴: "浙江省",
  湖州: "浙江省",
  金华: "浙江省",
  温州: "浙江省",
  台州: "浙江省",
  南京: "江苏省",
  苏州: "江苏省",
  无锡: "江苏省",
  常州: "江苏省",
  广州: "广东省",
  深圳: "广东省",
  佛山: "广东省",
  东莞: "广东省",
  成都: "四川省",
  武汉: "湖北省",
  长沙: "湖南省",
  西安: "陕西省",
  青岛: "山东省",
  济南: "山东省",
  厦门: "福建省",
  福州: "福建省",
  合肥: "安徽省",
  郑州: "河南省",
  南昌: "江西省",
  昆明: "云南省",
  海口: "海南省",
  三亚: "海南省",
  哈尔滨: "黑龙江省",
  沈阳: "辽宁省",
  大连: "辽宁省",
  长春: "吉林省",
  石家庄: "河北省",
  太原: "山西省",
  呼和浩特: "内蒙古自治区",
  南宁: "广西壮族自治区",
  拉萨: "西藏自治区",
  银川: "宁夏回族自治区",
  乌鲁木齐: "新疆维吾尔自治区",
  香港: "香港特别行政区",
  澳门: "澳门特别行政区"
};

const chinaDistrictCityMap: Record<string, string> = {
  上城区: "杭州",
  拱墅区: "杭州",
  西湖区: "杭州",
  滨江区: "杭州",
  萧山区: "杭州",
  余杭区: "杭州",
  临平区: "杭州",
  钱塘区: "杭州",
  富阳区: "杭州",
  临安区: "杭州",
  柯桥区: "绍兴",
  越城区: "绍兴",
  上虞区: "绍兴",
  新昌县: "绍兴",
  海曙区: "宁波",
  江北区: "宁波",
  镇海区: "宁波",
  北仑区: "宁波",
  鄞州区: "宁波",
  奉化区: "宁波"
};

const chinaDistrictAliasMap = Object.fromEntries(
  Object.keys(chinaDistrictCityMap)
    .sort((left, right) => right.length - left.length)
    .map((district) => [district.replace(/(?:区|县|市)$/, ""), district])
    .filter(([alias, district]) => alias && alias !== district)
);

const provincePattern =
  /((?:内蒙古|广西|宁夏|新疆|西藏)[^省市区]{0,4}自治区|(?:北京|上海|天津|重庆)市|(?:香港|澳门)特别行政区|[\u4e00-\u9fff]{2,8}(?:省|自治区|特别行政区))/;
const mallPattern =
  /([\u4e00-\u9fffA-Za-z0-9·\s-]{2,40}(?:广场|商场|商城|天地|天目里|中心|银泰城|银泰|宝龙城|万象城|万象汇|万达|印象城|大悦城|吾悦广场|天街|奥特莱斯|生活广场|国际广场|国金中心|写字楼|园区|大厦|SKP|IFS|Mall|mall))/;

export function normalizePlaceText(value: unknown) {
  return String(value || "").trim();
}

export function normalizeCityName(value: string) {
  return normalizePlaceText(value).replace(/市$/, "");
}

export function inferProvince(fields: {
  country?: string;
  province?: string;
  city?: string;
  address?: string;
}) {
  const country = normalizePlaceText(fields.country) || "中国";
  const province = normalizePlaceText(fields.province);
  if (province) return province;
  if (country && country !== "中国") return "";

  const address = normalizePlaceText(fields.address);
  const fromAddress = address.match(provincePattern)?.[1]?.trim() || "";
  if (fromAddress) return fromAddress;

  const city = normalizeCityName(fields.city || "");
  return chinaCityProvinceMap[city] || "";
}

export function inferMallName(value: string) {
  const matched = normalizePlaceText(value).match(mallPattern)?.[1]?.trim() || "";
  return cleanMallName(matched);
}

export function inferCityByDistrict(value = "") {
  const matched = findDistrictName(value);
  return matched ? chinaDistrictCityMap[matched] : "";
}

export function inferAreaFromText(value: string, mall = "") {
  const text = normalizePlaceText(value);
  let area =
    text.match(/([\u4e00-\u9fff]{2,12}(?:区|县))/)?.[1]?.trim() ||
    text.match(/([\u4e00-\u9fffA-Za-z0-9]{2,20}(?:商圈|街区))/)?.[1]?.trim() ||
    "";
  if (!area) {
    area = findDistrictName(`${text} ${mall}`);
  }
  if (!area) return "";
  return area === mall ? "" : area;
}

export function buildPlaceDisplayName(place: Pick<Place, "name" | "storeName">) {
  return [place.name, place.storeName].filter(Boolean).join(" · ");
}

export function buildPlaceGeoLine(place: Pick<Place, "country" | "province" | "city">) {
  return uniqueParts([place.country, place.province, place.city]).join(" · ");
}

export function buildPlaceContextLine(place: Pick<Place, "area" | "mall" | "address">) {
  const summary = uniqueParts([place.area, place.mall]).join(" · ");
  return summary || place.address || "未设置区域";
}

export function buildPlaceLocationDetail(place: Pick<Place, "country" | "province" | "city" | "area" | "mall">) {
  return uniqueParts([place.country, place.province, place.city, place.area, place.mall]).join(" · ");
}

export function buildMallKey(fields: Pick<Place, "country" | "province" | "city" | "mall"> & Partial<Pick<Place, "name" | "category">>) {
  const mall = getPlaceMallName(fields);
  if (!mall) return "";

  return [fields.country || "中国", fields.province || "", fields.city || "", mall]
    .map((part) => normalizePlaceText(part))
    .join("__");
}

export function getPlaceMallName(fields: Pick<Place, "mall"> & Partial<Pick<Place, "name" | "category">>) {
  const mall = normalizePlaceText(fields.mall);
  if (mall) return mall;
  return isMallRecord(fields) ? normalizePlaceText(fields.name) : "";
}

export function normalizeStoredMall(
  fields: Partial<Pick<Place, "mall" | "address" | "area">>
) {
  if (Object.prototype.hasOwnProperty.call(fields, "mall")) {
    return normalizePlaceText(fields.mall);
  }

  return inferMallName(fields.address || "") || normalizePlaceText(fields.area);
}

export function isMallRecord(fields: Partial<Pick<Place, "name" | "category" | "storeName">>) {
  const category = normalizePlaceText(fields.category);
  const name = normalizePlaceText(fields.name);
  return Boolean(name) && ["商场", "购物中心", "园区", "景区"].some((keyword) => category.includes(keyword));
}

export function parseMallKey(value: string) {
  const [country = "中国", province = "", city = "", mall = ""] = decodeURIComponent(value).split("__");
  return { country, province, city, mall };
}

export function isSameMall(
  place: Pick<Place, "country" | "province" | "city" | "mall"> & Partial<Pick<Place, "name" | "category">>,
  mallInfo: Pick<Place, "country" | "province" | "city" | "mall">
) {
  return (
    normalizePlaceText(getPlaceMallName(place)) === normalizePlaceText(mallInfo.mall) &&
    normalizePlaceText(place.city) === normalizePlaceText(mallInfo.city) &&
    normalizePlaceText(place.province) === normalizePlaceText(mallInfo.province) &&
    normalizePlaceText(place.country || "中国") === normalizePlaceText(mallInfo.country || "中国")
  );
}

export function getPlacePlatformLink(
  place: Pick<Place, "platformLinks" | "sourceUrl">,
  platform: Exclude<PlaceLinkPlatform, "custom">
) {
  const saved = place.platformLinks.find((link) => link.platform === platform);
  if (saved) return saved;
  return buildFallbackPlatformLink(place.sourceUrl, platform);
}

export function getPlaceReferenceUrl(place: Pick<Place, "sourceUrl">) {
  const sourceUrl = normalizePlaceText(place.sourceUrl);
  if (!sourceUrl) return "";

  const platform = inferPlatformFromLink(sourceUrl);
  if (platform !== "custom") {
    return "";
  }

  return sourceUrl;
}

export function buildFallbackPlatformLink(sourceUrl: string, platform: Exclude<PlaceLinkPlatform, "custom">) {
  const link = createPlatformLink(sourceUrl);
  if (!link || link.platform !== platform) return null;
  return link as PlaceExternalLink;
}

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();

  return parts
    .map((part) => normalizePlaceText(part))
    .filter(Boolean)
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    });
}

function cleanMallName(value: string) {
  return normalizePlaceText(value)
    .replace(/^.*?(?:省|自治区|特别行政区)/, "")
    .replace(/^.*?(?:区|县)/, "")
    .replace(/^.*?(?:路|街|大道|巷|弄|号)/, "")
    .trim();
}

function findDistrictName(value = "") {
  const text = normalizePlaceText(value);
  if (!text) return "";

  const exact = Object.keys(chinaDistrictCityMap)
    .sort((left, right) => right.length - left.length)
    .find((district) => text.includes(district));
  if (exact) return exact;

  const alias = Object.keys(chinaDistrictAliasMap)
    .sort((left, right) => right.length - left.length)
    .find((district) => text.includes(district));
  return alias ? chinaDistrictAliasMap[alias] : "";
}
