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

const { buildAndroidViewIntentUrl, buildNativeAppDeepLink } = loadTs("src/utils/externalLinks.ts");

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

const nativeCases = [
  {
    input: "https://uri.amap.com/search?keyword=%E8%A5%BF%E6%B9%96",
    platform: "amap",
    expected: "amapuri://poi/around?sourceApplication=LifeLog&keywords=%E8%A5%BF%E6%B9%96&dev=0"
  },
  {
    input: "https://www.meituan.com/s/%E7%83%A4%E8%82%89/",
    platform: "meituan",
    expected: "imeituan://www.meituan.com/search?q=%E7%83%A4%E8%82%89"
  },
  {
    input: "https://www.dianping.com/search/keyword/9/0_%E5%92%96%E5%95%A1",
    platform: "dianping",
    expected: "dianping://searchshoplist?keyword=%E5%92%96%E5%95%A1"
  },
  {
    input: "https://www.douyin.com/search/%E7%81%AB%E9%94%85?type=general",
    platform: "douyin",
    expected: "snssdk1128://search/tabs?keyword=%E7%81%AB%E9%94%85"
  },
  {
    input: "https://www.xiaohongshu.com/search_result?keyword=%E7%94%9C%E5%93%81",
    platform: "xiaohongshu",
    expected: "xhsdiscover://search/result?keyword=%E7%94%9C%E5%93%81"
  }
];

for (const item of nativeCases) {
  const actual = buildNativeAppDeepLink(item.input, item.platform);
  if (actual === item.expected) continue;
  failures += 1;
  console.error(`[buildNativeAppDeepLink] expected ${item.expected}, actual ${actual}`);
}

if (failures) {
  console.error(`External links regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`External links regression passed: ${cases.length + nativeCases.length} cases.`);
