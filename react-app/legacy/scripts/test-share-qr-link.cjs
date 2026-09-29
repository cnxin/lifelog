const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const source = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

global.CompressionStream = require("node:stream/web").CompressionStream;
global.DecompressionStream = require("node:stream/web").DecompressionStream;
global.window = { location: { origin: "capacitor://localhost" } };

const QRCode = require("qrcode");

const { buildLifeLogShareLink, buildLifeLogShareQrCode, parseLifeLogShareLinkHash, extractLifeLogShareHashFromText } = loadTs("src/utils/lifelogShareLink.ts");

async function main() {
  const payload = {
    kind: "lifelog-share",
    schemaVersion: 1,
    shareType: "memory",
    title: "二维码测试",
    exportedAt: "2026-06-04T00:00:00.000Z",
    appVersion: "0.1.0-test",
    options: {
      memory: {
        includeContent: true,
        peopleMode: "public",
        placeMode: "full",
        includePhotos: false
      }
    },
    data: {
      people: [{ id: "person_1", name: "测试人物", relationship: "朋友" }],
      places: [{
        id: "place_1",
        name: "测试地点",
        country: "中国",
        province: "",
        city: "上海",
        area: "",
        mall: "测试商场",
        storeName: "测试地点",
        category: "咖啡",
        rating: 4,
        address: "测试路 100 号",
        mapUrl: "",
        sourceUrl: "",
        platformLinks: [],
        photos: [],
        desc: "",
        tags: [],
        favorite: false
      }],
      memories: [{
        id: "memory_1",
        title: "一次很长但仍然适合二维码的回忆",
        date: "2026-06-04",
        content: "这是一段用于测试二维码编码密度的内容。".repeat(12),
        personIds: ["person_1"],
        placeId: "place_1",
        placeIds: ["place_1"],
        tags: ["测试", "二维码"],
        mood: "开心",
        photos: []
      }],
      photos: []
    },
    integrity: {
      people: 1,
      places: 1,
      memories: 1,
      photos: 0
    }
  };
  const compactPayload = {
    ...payload,
    data: {
      ...payload.data,
      places: payload.data.places.map((place) => ({ ...place, address: "" })),
      memories: payload.data.memories.map((memory) => ({ ...memory, content: "" }))
    }
  };

  const link = await buildLifeLogShareLink(payload);
  const qrCode = await buildLifeLogShareQrCode(compactPayload);
  const parsed = await parseLifeLogShareLinkHash(extractLifeLogShareHashFromText(qrCode.qrText));

  if (parsed.shareType !== "memory" || parsed.data.memories.length !== 1) {
    throw new Error("QR mini payload should import one memory");
  }
  if (parsed.data.memories[0].title !== payload.data.memories[0].title) {
    throw new Error("QR mini payload should preserve memory title");
  }
  if (parsed.data.memories[0].content !== "") {
    throw new Error("QR mini payload should not include full memory content");
  }
  if (parsed.data.people[0]?.name !== "测试人物") {
    throw new Error("QR mini payload should preserve public person name");
  }
  if (parsed.data.places[0]?.name !== "测试地点") {
    throw new Error("QR mini payload should preserve place name");
  }

  if (!qrCode.qrText.startsWith("lifelog://q/Q2.")) {
    throw new Error(`Unexpected QR text: ${qrCode.qrText.slice(0, 32)}`);
  }

  const qr = QRCode.create(qrCode.qrSegments, { errorCorrectionLevel: "L" });
  const directQr = QRCode.create(link, { errorCorrectionLevel: "L" });
  if (qr.version >= directQr.version) {
    throw new Error(`QR mini code should be smaller than full link QR: mini v${qr.version}, full v${directQr.version}`);
  }

  console.log(`Share QR regression passed: link ${link.length} chars, qr ${qrCode.qrText.length} chars, qr v${qr.version} < full v${directQr.version}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
