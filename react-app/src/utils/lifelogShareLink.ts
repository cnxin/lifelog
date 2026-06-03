import type { LifeLogSharePayload } from "./lifelogShare";

const SHARE_LINK_VERSION = "v1";
const MAX_SHARE_LINK_LENGTH = 6200;
const APP_SHARE_ORIGIN = "lifelog://share";
const COMPACT_GZIP_PREFIX = "g1.";
const COMPACT_BASE64_PREFIX = "b1.";

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

export async function buildLifeLogShareLink(payload: LifeLogSharePayload, origin = getDefaultShareOrigin()) {
  const json = JSON.stringify(payload);
  const hash = await encodeShareHash(json);
  const link = `${origin.replace(/\/$/, "")}/import#${hash}`;
  if (link.length > MAX_SHARE_LINK_LENGTH) {
    throw new ShareLinkTooLargeError(link.length);
  }
  return link;
}

export async function parseLifeLogShareLinkHash(hash: string): Promise<LifeLogSharePayload> {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) throw new Error("分享链接缺少导入数据。");

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

  try {
    const url = new URL(trimmed);
    if (isLifeLogShareImportUrl(url) && url.hash) return url.hash.slice(1);
  } catch {
    // Continue with loose text matching below.
  }

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
  const stream = new Blob([text], { type: "application/json" })
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buffer));
}

async function decodeCompressed(value: string) {
  if (!supportsDecompressionStream()) {
    throw new Error("当前浏览器不支持解析压缩分享链接，请改用分享包导入。");
  }
  const bytes = base64UrlToBytes(value);
  const stream = new Blob([bytes])
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
