import type {
  MemoryEvent,
  Place,
  PlaceDuplicateGroup,
  PlaceDuplicateStrength,
  PlaceMergePreview
} from "../types";
import { mergePlacePlatformLinks, normalizePlacePlatformLinks } from "./placeLinks";
import { replaceMemoryPlaceId } from "./memoryPlaces";
import { normalizePlaceText } from "./placeMeta";

interface SignatureRule {
  signature: string;
  reason: string;
  strength: PlaceDuplicateStrength;
}

interface PlaceCandidate {
  signature: string;
  place: Place;
  reason: string;
  strength: PlaceDuplicateStrength;
}

export function inspectPlaceDuplicate(place: Place, places: Place[]) {
  const targetRules = buildPlaceSignatures(place);
  const candidates = places
    .filter((item) => item.id !== place.id)
    .map((item) => matchPlaceBySignatures(item, targetRules))
    .filter((item): item is PlaceCandidate => Boolean(item))
    .sort(compareCandidates);

  if (!candidates.length) return null;

  const best = candidates[0];
  return buildPlaceMergePreview(
    best.place,
    [place],
    best.signature,
    best.reason,
    best.strength,
    buildPreviewDetails(best.place, place, best.reason)
  );
}

export function findPlaceDuplicateGroups(places: Place[]): PlaceDuplicateGroup[] {
  const buckets = new Map<string, { reason: string; strength: PlaceDuplicateStrength; places: Place[] }>();

  for (const place of places) {
    for (const signature of buildPlaceSignatures(place)) {
      const bucket = buckets.get(signature.signature) || {
        reason: signature.reason,
        strength: signature.strength,
        places: []
      };
      bucket.places.push(place);
      if (signature.strength === "strong") {
        bucket.strength = "strong";
      }
      buckets.set(signature.signature, bucket);
    }
  }

  const groups = new Map<string, PlaceDuplicateGroup>();

  for (const [signature, bucket] of buckets.entries()) {
    const uniquePlaces = uniqueById(bucket.places);
    if (uniquePlaces.length < 2) continue;

    const canonical = chooseCanonicalPlace(uniquePlaces);
    const placeIds = uniquePlaces.map((item) => item.id).sort();
    const groupKey = placeIds.join("|");
    const nextGroup: PlaceDuplicateGroup = {
      signature,
      placeIds,
      canonicalId: canonical.id,
      reason: bucket.reason,
      label: buildDuplicateLabel(canonical),
      strength: bucket.strength
    };
    const current = groups.get(groupKey);
    if (!current || shouldReplaceGroup(current, nextGroup)) {
      groups.set(groupKey, nextGroup);
    }
  }

  return Array.from(groups.values()).sort(compareGroups);
}

export function buildGroupMergePreview(group: PlaceDuplicateGroup, places: Place[]) {
  const members = uniqueById(places.filter((place) => group.placeIds.includes(place.id)));
  if (members.length < 2) return null;

  const canonical = members.find((place) => place.id === group.canonicalId) || chooseCanonicalPlace(members);
  const sources = members.filter((place) => place.id !== canonical.id);
  return buildPlaceMergePreview(canonical, sources, group.signature, group.reason, group.strength, buildPreviewDetails(canonical, sources[0], group.reason));
}

export function mergePlaceRecords(target: Place, source: Place) {
  const tags = Array.from(new Set([...target.tags, ...source.tags].map((item) => item.trim()).filter(Boolean)));
  const photos = Array.from(new Set([...target.photos, ...source.photos].map((item) => item.trim()).filter(Boolean)));
  const platformLinks = mergePlacePlatformLinks(target.platformLinks, source.platformLinks);

  return {
    ...target,
    name: pickLongerName(target.name, source.name),
    country: target.country || source.country,
    province: target.province || source.province,
    city: target.city || source.city,
    area: pickLongerName(target.area, source.area),
    mall: pickLongerName(target.mall, source.mall),
    storeName: pickLongerName(target.storeName, source.storeName),
    category: target.category !== "其他" ? target.category : source.category,
    rating: Math.max(target.rating || 0, source.rating || 0),
    address: pickLongerName(target.address, source.address),
    latitude: target.latitude ?? source.latitude,
    longitude: target.longitude ?? source.longitude,
    mapUrl: target.mapUrl || source.mapUrl,
    sourceUrl: target.sourceUrl || source.sourceUrl,
    platformLinks: normalizePlacePlatformLinks(platformLinks),
    photos,
    desc: pickLongerName(target.desc, source.desc),
    tags,
    favorite: target.favorite || source.favorite
  };
}

export function mergeMemoryPlaceReferences(memories: MemoryEvent[], fromId: string, toId: string) {
  return memories.map((memory) => replaceMemoryPlaceId(memory, fromId, toId));
}

function buildPlaceSignatures(place: Place) {
  const country = normalizeToken(place.country || "中国");
  const province = normalizeToken(place.province);
  const city = normalizeToken(place.city);
  const area = normalizeToken(place.area);
  const mall = normalizeToken(place.mall);
  const name = normalizeToken(place.name);
  const storeName = normalizeToken(place.storeName);
  const address = normalizeAddress(place.address);
  const category = normalizeToken(place.category);
  const geo = buildGeoBucket(place);

  const signatures: SignatureRule[] = [];

  pushSignature(signatures, [country, province, city, mall, name, storeName], {
    reason: "同城同商场同店名",
    strength: "strong"
  });
  pushSignature(signatures, [country, province, city, name, storeName, address], {
    reason: "同城同店名同地址",
    strength: "strong"
  });
  pushSignature(signatures, [country, province, city, name, address], {
    reason: "同城同地点名同地址",
    strength: "strong"
  });

  if (geo) {
    pushSignature(signatures, [country, province, city, geo, name], {
      reason: "同坐标附近同名称",
      strength: "strong"
    });
  }

  if (mall && name && !storeName) {
    pushSignature(signatures, [country, province, city, mall, name, category], {
      reason: "同城同商场同主名称",
      strength: "weak"
    });
  }

  if (name && !address && area && mall) {
    pushSignature(signatures, [country, province, city, area, mall, name], {
      reason: "同区域同商场同名称",
      strength: "weak"
    });
  }

  if (name && city && !address) {
    pushSignature(signatures, [country, province, city, name], {
      reason: "同城同名称但地址缺失",
      strength: "weak"
    });
  }

  if (mall && category && isWeakStoreName(storeName)) {
    pushSignature(signatures, [country, province, city, mall, category, name], {
      reason: "同商场同分类名称接近",
      strength: "weak"
    });
  }

  return uniqueRules(signatures);
}

function pushSignature(
  signatures: SignatureRule[],
  parts: Array<string | undefined>,
  meta: { reason: string; strength: PlaceDuplicateStrength }
) {
  const normalized = parts.filter(Boolean) as string[];
  if (normalized.length < 4) return;
  signatures.push({
    signature: normalized.join("|"),
    reason: meta.reason,
    strength: meta.strength
  });
}

function uniqueRules(signatures: SignatureRule[]) {
  const bucket = new Map<string, SignatureRule>();

  for (const item of signatures) {
    const current = bucket.get(item.signature);
    if (!current || (current.strength === "weak" && item.strength === "strong")) {
      bucket.set(item.signature, item);
    }
  }

  return Array.from(bucket.values());
}

function matchPlaceBySignatures(place: Place, targetSignatures: SignatureRule[]) {
  const candidateSignatures = new Map(buildPlaceSignatures(place).map((item) => [item.signature, item]));
  const matched = targetSignatures.find((item) => candidateSignatures.has(item.signature));
  if (!matched) return null;

  const candidate = candidateSignatures.get(matched.signature);
  const strength = matched.strength === "strong" || candidate?.strength === "strong" ? "strong" : "weak";

  return {
    signature: matched.signature,
    place,
    reason: matched.reason,
    strength
  };
}

function buildPlaceMergePreview(
  canonical: Place,
  sources: Place[],
  signature: string,
  reason: string,
  strength: PlaceDuplicateStrength,
  details: string[]
): PlaceMergePreview {
  const merged = sources.reduce((current, source) => mergePlaceRecords(current, source), canonical);
  return {
    signature,
    reason,
    strength,
    details,
    canonical,
    sources,
    merged
  };
}

function chooseCanonicalPlace(places: Place[]) {
  return [...places].sort((a, b) => scorePlaceCandidate(b) - scorePlaceCandidate(a))[0];
}

function compareCandidates(a: PlaceCandidate, b: PlaceCandidate) {
  if (a.strength !== b.strength) {
    return a.strength === "strong" ? -1 : 1;
  }

  return scorePlaceCandidate(b.place) - scorePlaceCandidate(a.place);
}

function compareGroups(a: PlaceDuplicateGroup, b: PlaceDuplicateGroup) {
  if (a.strength !== b.strength) {
    return a.strength === "strong" ? -1 : 1;
  }

  return b.placeIds.length - a.placeIds.length || a.label.localeCompare(b.label, "zh-CN");
}

function shouldReplaceGroup(current: PlaceDuplicateGroup, next: PlaceDuplicateGroup) {
  if (current.strength !== next.strength) {
    return next.strength === "strong";
  }

  return next.reason.length > current.reason.length;
}

function scorePlaceCandidate(place: Place) {
  let score = 0;
  if (place.favorite) score += 80;
  if (place.address) score += 25;
  if (place.mall) score += 20;
  if (place.storeName) score += 20;
  if (place.mapUrl) score += 18;
  if (place.sourceUrl) score += 14;
  if (place.platformLinks.length) score += 16;
  if (place.photos.length) score += 16;
  if (place.tags.length) score += 8;
  if (place.desc) score += 10;
  if (place.latitude && place.longitude) score += 10;
  score += Math.min(place.name.length, 12);
  score += Math.min(place.address.length, 20);
  return score;
}

function buildDuplicateLabel(place: Place) {
  return [place.name, place.storeName, place.mall].filter(Boolean).join(" · ") || place.name;
}

function buildGeoBucket(place: Pick<Place, "latitude" | "longitude">) {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return "";
  const lat = Math.round(place.latitude * 1000) / 1000;
  const lng = Math.round(place.longitude * 1000) / 1000;
  return `${lat},${lng}`;
}

function normalizeToken(value: string) {
  return normalizePlaceText(value)
    .toLowerCase()
    .replace(/[·•・\s]+/g, "")
    .replace(/[()（）【】]/g, "");
}

function normalizeAddress(value: string) {
  return normalizeToken(value)
    .replace(/[\-_,，。；;:：]/g, "")
    .replace(/第?\d+层/g, "")
    .replace(/\b[ab]\d+\b/gi, "")
    .replace(/\bf\d+\b/gi, "");
}

function pickLongerName(primary: string, fallback: string) {
  const left = normalizePlaceText(primary);
  const right = normalizePlaceText(fallback);
  if (!left) return right;
  if (!right) return left;
  return left.length >= right.length ? left : right;
}

function uniqueById(places: Place[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

function isWeakStoreName(value: string) {
  const normalized = normalizeToken(value);
  return !normalized || ["总店", "分店", "旗舰店", "店", "门店"].includes(normalized);
}

function buildPreviewDetails(existing: Place, incoming: Place, reason: string) {
  const details: string[] = [];

  if (reason.includes("同城")) {
    details.push(`城市一致：${[existing.province, existing.city].filter(Boolean).join(" · ") || existing.city || "未设置"}`);
  }

  if (reason.includes("商场")) {
    const left = existing.mall || "未填写";
    const right = incoming.mall || "未填写";
    details.push(`商场/园区：${left} / ${right}`);
  }

  if (reason.includes("店名") || reason.includes("名称")) {
    const left = [existing.name, existing.storeName].filter(Boolean).join(" · ") || existing.name;
    const right = [incoming.name, incoming.storeName].filter(Boolean).join(" · ") || incoming.name;
    details.push(`名称接近：${left} / ${right}`);
  }

  if (reason.includes("地址")) {
    details.push(`地址命中：${existing.address || "未填写"} / ${incoming.address || "未填写"}`);
  } else if (!existing.address || !incoming.address) {
    details.push("至少一条记录缺少详细地址，需要人工确认。");
  }

  if (existing.mapUrl || incoming.mapUrl || (existing.latitude && incoming.latitude)) {
    details.push("存在地图链接或坐标信息，可作为同一地点辅助判断。");
  }

  return details;
}
