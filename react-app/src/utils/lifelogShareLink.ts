import type { QRCodeSegment } from "qrcode";
import type { LifeLogSharePayload } from "./lifelogShare";

const SHARE_LINK_VERSION = "v1";
const MAX_SHARE_LINK_LENGTH = 6200;
const APP_SHARE_ORIGIN = "lifelog://share";
const COMPACT_GZIP_PREFIX = "g1.";
const COMPACT_BASE64_PREFIX = "b1.";
const QR_GZIP_PREFIX = "Q1.";
const QR_MINI_GZIP_PREFIX = "Q2.";
const QR_SHARE_ORIGIN = "lifelog://q";
const QR_BASE43_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:";

interface LifeLogQrMiniPayload {
  v: 1;
  k: "m" | "p";
  t: string;
  d?: string;
  o?: string;
  g?: string[];
  p?: string[];
  l?: Array<string | [string, string?, string?, string?]>;
}

interface ShareLinkEnvelope {
  version: typeof SHARE_LINK_VERSION;
  encoding: "gzip-base64url" | "base64url";
  payload: string;
}

export class ShareLinkTooLargeError extends Error {
  constructor(length: number) {
    super(`分享内容生成的链接太长（${length} 字符），建议改用分享包。`);
    this.name = "ShareLinkTooLargeError";
  }
}

export interface LifeLogShareQrCode {
  link: string;
  qrText: string;
  qrSegments: QRCodeSegment[];
}

export async function buildLifeLogShareLink(payload: LifeLogSharePayload, origin = getDefaultShareOrigin()) {
  const json = JSON.stringify(payload);
  const hash = await encodeShareHash(json);
  const link = `${origin.replace(/\/$/, "")}/import#${hash}`;
  if (link.length > MAX_SHARE_LINK_LENGTH) {
    throw new ShareLinkTooLargeError(link.length);
  }
  return link;
}

export async function buildLifeLogShareQrCode(payload: LifeLogSharePayload): Promise<LifeLogShareQrCode> {
  const qrHash = await encodeQrMiniShareHash(JSON.stringify(buildQrMiniPayload(payload)));
  if (qrHash) {
    const link = `${APP_SHARE_ORIGIN}/import#${qrHash}`;
    const qrPrefix = `${QR_SHARE_ORIGIN}/`;
    return {
      link,
      qrText: `${qrPrefix}${qrHash}`,
      qrSegments: [
        { data: qrPrefix },
        { mode: "alphanumeric", data: qrHash }
      ]
    };
  }

  const link = await buildLifeLogShareLink(payload);
  return {
    link,
    qrText: link,
    qrSegments: [{ data: link }]
  };
}

export async function parseLifeLogShareLinkHash(hash: string): Promise<LifeLogSharePayload> {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) throw new Error("分享链接缺少导入数据。");

  if (raw.startsWith(QR_MINI_GZIP_PREFIX)) {
    const decoded = JSON.parse(await decodeCompressedBytes(base43ToBytes(raw.slice(QR_MINI_GZIP_PREFIX.length)))) as unknown;
    return inflateQrMiniPayload(decoded);
  }

  if (raw.startsWith(QR_GZIP_PREFIX)) {
    return JSON.parse(await decodeCompressedBytes(base43ToBytes(raw.slice(QR_GZIP_PREFIX.length)))) as LifeLogSharePayload;
  }

  if (raw.startsWith(COMPACT_GZIP_PREFIX)) {
    return JSON.parse(await decodeCompressed(raw.slice(COMPACT_GZIP_PREFIX.length))) as LifeLogSharePayload;
  }

  if (raw.startsWith(COMPACT_BASE64_PREFIX)) {
    return JSON.parse(decodeBase64UrlToText(raw.slice(COMPACT_BASE64_PREFIX.length))) as LifeLogSharePayload;
  }

  let envelope: ShareLinkEnvelope;
  try {
    envelope = JSON.parse(decodeURIComponent(raw)) as ShareLinkEnvelope;
  } catch {
    throw new Error("分享链接格式不正确。");
  }

  if (!envelope || envelope.version !== SHARE_LINK_VERSION || !envelope.payload) {
    throw new Error("分享链接版本不支持。");
  }

  const json = envelope.encoding === "gzip-base64url"
    ? await decodeCompressed(envelope.payload)
    : decodeBase64UrlToText(envelope.payload);
  return JSON.parse(json) as LifeLogSharePayload;
}

export function extractLifeLogShareHashFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#")) return trimmed.slice(1);
  if (isQrShareHash(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const opaquePath = url.pathname.replace(/^\/+/, "");
    if (url.protocol === "lifelog:" && isQrShareHash(opaquePath)) return opaquePath;
    if (url.protocol === "lifelog:" && url.hostname === "q") {
      const qrHash = url.pathname.replace(/^\/+/, "");
      if (isQrShareHash(qrHash)) return qrHash;
    }
    if (isLifeLogShareImportUrl(url) && url.hash) return url.hash.slice(1);
  } catch {
    // Continue with loose text matching below.
  }

  const qrMatch = trimmed.match(/lifelog:\/\/q\/((?:Q1|Q2)\.[0-9A-Z$*+\-./:]+)/);
  if (qrMatch) return qrMatch[1];

  const match = trimmed.match(/(?:\/share\/import|lifelog:\/\/share\/import)#([^\s"'<>]+)/);
  return match?.[1] || "";
}

export function buildLifeLogShareImportPathFromUrl(url: string) {
  const hash = extractLifeLogShareHashFromText(url);
  return hash ? `/share/import#${hash}` : "";
}

function getDefaultShareOrigin() {
  const origin = window.location.origin;
  if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return APP_SHARE_ORIGIN;
  if (/^capacitor:\/\//i.test(origin)) return APP_SHARE_ORIGIN;
  return `${origin}/share`;
}

function isLifeLogShareImportUrl(url: URL) {
  if (url.protocol === "lifelog:" && url.hostname === "share" && url.pathname === "/import") return true;
  return url.pathname === "/share/import";
}

async function encodeShareHash(json: string) {
  const envelope = await encodeShareEnvelope(json);
  const prefix = envelope.encoding === "gzip-base64url" ? COMPACT_GZIP_PREFIX : COMPACT_BASE64_PREFIX;
  return `${prefix}${envelope.payload}`;
}

async function encodeQrMiniShareHash(json: string) {
  if (!supportsCompressionStream()) return "";
  try {
    return `${QR_MINI_GZIP_PREFIX}${bytesToBase43(await encodeCompressedBytes(json))}`;
  } catch {
    return "";
  }
}

function buildQrMiniPayload(payload: LifeLogSharePayload): LifeLogQrMiniPayload {
  if (payload.shareType === "places") {
    return {
      v: 1,
      k: "p",
      t: cleanQrText(payload.title || "地点分享", 48),
      l: payload.data.places
        .map((place) => compactPlaceTuple(
          cleanQrText(place.name || place.storeName || "分享地点", 36),
          cleanQrText(place.city, 18),
          cleanQrText(place.mall, 28),
          cleanQrText(place.category, 16)
        ))
        .filter((place): place is string | [string, string?, string?, string?] => Boolean(place))
        .slice(0, 12)
    };
  }

  const memory = payload.data.memories[0];
  const personIds = new Set(readIdList(memory, "personIds", "people"));
  const placeIds = new Set(readIdList(memory, "placeIds", "places", "placeId"));
  const people = payload.data.people
    .filter((person) => !personIds.size || personIds.has(person.id))
    .map((person) => cleanQrText(person.name, 24))
    .filter(Boolean)
    .slice(0, 8);
  const places = payload.data.places
    .filter((place) => !placeIds.size || placeIds.has(place.id))
    .map((place) => cleanQrText(place.name || place.storeName, 32))
    .filter(Boolean)
    .slice(0, 8);

  return {
    v: 1,
    k: "m",
    t: cleanQrText(memory?.title || payload.title || "回忆分享", 48),
    d: normalizeQrDate(memory?.date || ""),
    o: cleanQrText(memory?.mood || "", 12),
    g: Array.isArray(memory?.tags) ? memory.tags.map((tag) => cleanQrText(tag, 12)).filter(Boolean).slice(0, 6) : [],
    p: people,
    l: places
  };
}

function inflateQrMiniPayload(value: unknown): LifeLogSharePayload {
  if (!isQrMiniPayload(value)) {
    throw new Error("分享二维码格式不正确。");
  }

  if (value.k === "p") {
    const places = (value.l || [])
      .map((item, index) => inflateQrMiniPlace(item, index))
      .filter((place): place is LifeLogSharePayload["data"]["places"][number] => Boolean(place));
    return buildInflatedSharePayload({
      shareType: "places",
      title: value.t || (places.length === 1 ? places[0]?.name || "地点分享" : `地点分享（${places.length} 个）`),
      options: {
        place: {
          includeAddress: false,
          includePreciseLocation: false,
          includeLinks: false,
          includePhotos: false
        }
      },
      data: {
        people: [],
        places,
        memories: [],
        photos: []
      }
    });
  }

  const people = (value.p || [])
    .map((name, index) => inflateQrMiniPerson(name, index))
    .filter((person): person is LifeLogSharePayload["data"]["people"][number] => Boolean(person));
  const places = (value.l || [])
    .map((item, index) => inflateQrMiniPlace(item, index))
    .filter((place): place is LifeLogSharePayload["data"]["places"][number] => Boolean(place));
  const memory = {
    id: "qrm1",
    title: value.t || "分享的回忆",
    date: normalizeQrDate(value.d || ""),
    personIds: people.map((person) => person.id),
    placeId: places[0]?.id || "",
    placeIds: places.map((place) => place.id),
    mood: value.o || "日常",
    content: "",
    tags: Array.isArray(value.g) ? value.g.map((tag) => cleanQrText(tag, 16)).filter(Boolean) : [],
    photos: []
  };

  return buildInflatedSharePayload({
    shareType: "memory",
    title: memory.title,
    options: {
      memory: {
        includeContent: false,
        peopleMode: people.length ? "public" : "hidden",
        placeMode: places.length ? "name" : "hidden",
        includePhotos: false
      }
    },
    data: {
      people,
      places,
      memories: [memory],
      photos: []
    }
  });
}

function buildInflatedSharePayload({
  shareType,
  title,
  options,
  data
}: Pick<LifeLogSharePayload, "shareType" | "title" | "options" | "data">): LifeLogSharePayload {
  return {
    schemaVersion: 1,
    kind: "lifelog-share",
    shareType,
    exportedAt: new Date().toISOString(),
    appVersion: "qr-mini-v1",
    title,
    options,
    data,
    integrity: {
      people: data.people.length,
      places: data.places.length,
      memories: data.memories.length,
      photos: data.photos.length
    }
  };
}

function inflateQrMiniPerson(name: string, index: number): LifeLogSharePayload["data"]["people"][number] | null {
  const safeName = cleanQrText(name, 24);
  if (!safeName) return null;
  return {
    id: `qrp${index + 1}`,
    name: safeName,
    nickname: "",
    relationship: "分享人物",
    birthday: "",
    birthdayIsLunar: false,
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [],
    notes: ""
  };
}

function inflateQrMiniPlace(item: string | [string, string?, string?, string?], index: number): LifeLogSharePayload["data"]["places"][number] | null {
  const tuple = Array.isArray(item) ? item : [item];
  const name = cleanQrText(tuple[0], 36);
  if (!name) return null;
  return {
    id: `qrl${index + 1}`,
    name,
    country: "中国",
    province: "",
    city: cleanQrText(tuple[1] || "", 18),
    area: "",
    mall: cleanQrText(tuple[2] || "", 28),
    storeName: name,
    category: cleanQrText(tuple[3] || "其他", 16) || "其他",
    rating: 0,
    address: "",
    latitude: undefined,
    longitude: undefined,
    mapUrl: "",
    sourceUrl: "",
    platformLinks: [],
    photos: [],
    desc: "",
    tags: [],
    favorite: false
  };
}

function compactPlaceTuple(name: string, city: string, mall: string, category: string): string | [string, string?, string?, string?] {
  if (!name) return "";
  if (!city && !mall && !category) return name;
  const tuple: [string, string?, string?, string?] = [name];
  if (city || mall || category) tuple[1] = city || "";
  if (mall || category) tuple[2] = mall || "";
  if (category) tuple[3] = category;
  return tuple;
}

function isQrMiniPayload(value: unknown): value is LifeLogQrMiniPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LifeLogQrMiniPayload>;
  return record.v === 1 && (record.k === "m" || record.k === "p") && typeof record.t === "string";
}

function isQrShareHash(value: string) {
  return value.startsWith(QR_GZIP_PREFIX) || value.startsWith(QR_MINI_GZIP_PREFIX);
}

function readIdList(source: unknown, ...keys: string[]) {
  if (!source || typeof source !== "object") return [];
  const record = source as Record<string, unknown>;
  return keys.flatMap((key) => {
    const value = record[key];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string" && value) return [value];
    return [];
  });
}

function cleanQrText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeQrDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

async function encodeShareEnvelope(json: string): Promise<ShareLinkEnvelope> {
  if (supportsCompressionStream()) {
    try {
      return {
        version: SHARE_LINK_VERSION,
        encoding: "gzip-base64url",
        payload: await encodeCompressed(json)
      };
    } catch {
      // Fall back to plain base64url below.
    }
  }
  return {
    version: SHARE_LINK_VERSION,
    encoding: "base64url",
    payload: encodeTextToBase64Url(json)
  };
}

async function encodeCompressed(text: string) {
  return bytesToBase64Url(await encodeCompressedBytes(text));
}

async function encodeCompressedBytes(text: string) {
  const stream = new Blob([text], { type: "application/json" })
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function decodeCompressed(value: string) {
  if (!supportsDecompressionStream()) {
    throw new Error("当前浏览器不支持解析压缩分享链接，请改用分享包导入。");
  }
  return decodeCompressedBytes(base64UrlToBytes(value));
}

async function decodeCompressedBytes(bytes: Uint8Array) {
  if (!supportsDecompressionStream()) {
    throw new Error("当前浏览器不支持解析压缩分享链接，请改用分享包导入。");
  }
  const safeBytes = new Uint8Array(bytes);
  const stream = new Blob([safeBytes.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function supportsCompressionStream() {
  return typeof CompressionStream !== "undefined";
}

function supportsDecompressionStream() {
  return typeof DecompressionStream !== "undefined";
}

function encodeTextToBase64Url(text: string) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function decodeBase64UrlToText(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase43(bytes: Uint8Array) {
  let value = 0n;
  bytes.forEach((byte) => {
    value = (value * 256n) + BigInt(byte);
  });
  if (value === 0n) return QR_BASE43_ALPHABET[0];

  const base = BigInt(QR_BASE43_ALPHABET.length);
  let output = "";
  while (value > 0n) {
    output = QR_BASE43_ALPHABET[Number(value % base)] + output;
    value /= base;
  }
  return output;
}

function base43ToBytes(value: string) {
  let result = 0n;
  const base = BigInt(QR_BASE43_ALPHABET.length);
  for (const char of value) {
    const index = QR_BASE43_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("分享二维码格式不正确。");
    result = (result * base) + BigInt(index);
  }

  if (result === 0n) return new Uint8Array([0]);
  const bytes: number[] = [];
  while (result > 0n) {
    bytes.unshift(Number(result % 256n));
    result /= 256n;
  }
  return new Uint8Array(bytes);
}
