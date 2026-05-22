const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === "@capacitor/browser") return { Browser: { open: async () => undefined } };
    if (id === "@capacitor/core") {
      return {
        Capacitor: { isNativePlatform: () => false },
        registerPlugin: () => ({ open: async () => undefined })
      };
    }
    if (!id.startsWith(".")) return require(id);
    return loadTs(path.relative(projectRoot, path.resolve(path.dirname(filePath), `${id}.ts`)));
  };
  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { buildAndroidViewIntentUrl } = loadTs("src/utils/externalLinks.ts");

const cases = [
  {
    input: "https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.63/lifelog-v0.1.0-test.63.apk",
    expected: "intent://github.com/cnxin/lifelog/releases/download/v0.1.0-test.63/lifelog-v0.1.0-test.63.apk#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end"
  },
  {
    input: "http://example.invalid/app.apk",
    expected: "intent://example.invalid/app.apk#Intent;scheme=http;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end"
  }
];

let failures = 0;

for (const item of cases) {
  const actual = buildAndroidViewIntentUrl(item.input);
  if (actual === item.expected) continue;
  failures += 1;
  console.error(`[buildAndroidViewIntentUrl] expected ${item.expected}, actual ${actual}`);
}

if (failures) {
  console.error(`External links regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`External links regression passed: ${cases.length} cases.`);
