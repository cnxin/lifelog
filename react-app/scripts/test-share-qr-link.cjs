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

const { buildLifeLogShareLink, buildLifeLogShareQrCode, parseLifeLogShareLinkHash, extractLifeLogShareHashFromText } = loadTs("src/utils/lifelogShareLink.ts");

async function main() {
  const payload = {
    kind: "lifelog-share",
    schemaVersion: 1,
    shareType: "memory",
    title: "二维码测试",
    exportedAt: "2026-06-04T00:00:00.000Z",
    data: {
      people: [{ id: "person_1", name: "测试人物", relation: "朋友" }],
      places: [{ id: "place_1", name: "测试地点", city: "上海", address: "测试路 100 号" }],
      memories: [{
        id: "memory_1",
        title: "一次很长但仍然适合二维码的回忆",
        date: "2026-06-04",
        content: "这是一段用于测试二维码编码密度的内容。".repeat(12),
        people: ["person_1"],
        places: ["place_1"],
        tags: ["测试", "二维码"],
        mood: "开心",
        photos: []
      }],
      photos: []
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
  if (JSON.stringify(parsed) !== JSON.stringify(compactPayload)) {
    throw new Error("QR share payload roundtrip failed");
  }

  if (!qrCode.qrText.startsWith("lifelog://q/Q1.")) {
    throw new Error(`Unexpected QR text: ${qrCode.qrText.slice(0, 32)}`);
  }

  console.log(`Share QR regression passed: link ${link.length} chars, qr ${qrCode.qrText.length} chars.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
