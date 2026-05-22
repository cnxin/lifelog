const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  let source = fs.readFileSync(filePath, "utf8").replace(
    'import { APP_VERSION } from "../constants/version";',
    'const APP_VERSION = "0.1.0-test.61";'
  );
  source = source.replace(/import type .*?;\n/g, "");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filePath, module);

  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

global.navigator = {
  userAgent: "LifeLogTest/1.0",
  platform: "Android",
  language: "zh-CN"
};
global.window = {
  screen: {
    width: 390,
    height: 844
  }
};

const { buildDiagnosticsPayload, formatDiagnosticsText } = loadTs("src/utils/diagnostics.ts");

const state = {
  people: [{ id: "p1", name: "张三" }],
  places: [{ id: "l1", name: "敏感地点" }],
  memories: [{ id: "m1", title: "敏感回忆标题", personIds: ["p1"], placeId: "l1", photos: ["photo1", "photo2"] }]
};
const healthReport = {
  status: "ok",
  people: 1,
  places: 1,
  memories: 1,
  photoRefs: 2,
  issueCount: 0,
  issues: []
};

const payload = buildDiagnosticsPayload(state, healthReport);
const text = formatDiagnosticsText(payload);
const failures = [];

if (payload.counts.people !== 1 || payload.counts.places !== 1 || payload.counts.memories !== 1 || payload.counts.photoRefs !== 2) {
  failures.push(`Unexpected counts: ${JSON.stringify(payload.counts)}`);
}

if (!text.includes("版本：0.1.0-test.61") || !text.includes("人物：1") || !text.includes("照片引用：2")) {
  failures.push(`Diagnostics text missing summary fields: ${text}`);
}

for (const sensitive of ["张三", "敏感地点", "敏感回忆标题"]) {
  if (text.includes(sensitive)) {
    failures.push(`Diagnostics text leaked sensitive content: ${sensitive}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Diagnostics regression passed: summary generated without content leakage.");
