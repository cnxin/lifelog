const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filePath, module);

  const localRequire = (id) => {
    if (!id.startsWith(".")) return require(id);
    return loadTs(path.relative(projectRoot, path.resolve(path.dirname(filePath), `${id}.ts`)));
  };

  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { inferMemoryDate, inferPlaceId, inferQuickMemory } = loadTs("src/utils/memoryInference.ts");

const people = [
  { id: "p1", name: "小林", nickname: "林林" },
  { id: "p2", name: "阿周" }
];

const places = [
  { id: "l1", name: "蓝蛙", storeName: "湖滨银泰in77店", mall: "湖滨银泰", area: "上城区" },
  { id: "l2", name: "Seesaw Coffee", storeName: "嘉里中心店", mall: "杭州嘉里中心", area: "拱墅区" },
  { id: "l3", name: "另一家店", storeName: "湖滨银泰B区店", mall: "湖滨银泰", area: "上城区" }
];

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

assertEqual("relative yesterday uses fallback date", inferMemoryDate("昨天和小林吃饭", "2026-05-20"), "2026-05-19");
assertEqual("relative day after tomorrow uses fallback date", inferMemoryDate("后天去看电影", "2026-05-20"), "2026-05-22");
assertEqual("full dotted date", inferMemoryDate("2026.5.18 和阿周喝咖啡", "2026-05-20"), "2026-05-18");
assertEqual("month slash date", inferMemoryDate("5/2 去嘉里中心", "2026-05-20"), "2026-05-02");
assertEqual("direct place name match", inferPlaceId("昨天在蓝蛙吃饭", places), "l1");
assertEqual("unique mall match", inferPlaceId("今天在杭州嘉里中心逛街", places), "l2");
assertEqual("ambiguous mall match stays empty", inferPlaceId("今天在湖滨银泰逛街", places), "");

const quick = inferQuickMemory({
  content: "昨天和林林在Seesaw Coffee聊天",
  people,
  places,
  fallbackDate: "2026-05-20"
});
assertEqual("quick memory person inference", quick.personIds, ["p1"]);
assertEqual("quick memory place inference", quick.placeId, "l2");
assertEqual("quick memory date inference", quick.date, "2026-05-19");

const quickTitleOnly = inferQuickMemory({
  rawTitle: "\u6628\u5929\u548c\u5c0f\u6797\u5728Seesaw Coffee",
  content: "",
  people,
  places,
  fallbackDate: "2026-05-20"
});
assertEqual("quick title-only person inference", quickTitleOnly.personIds, ["p1"]);
assertEqual("quick title-only place inference", quickTitleOnly.placeId, "l2");
assertEqual("quick title-only date inference", quickTitleOnly.date, "2026-05-19");

const quickTitleWithDetails = inferQuickMemory({
  rawTitle: "5/2 \u548c\u963f\u5468\u53bb\u84dd\u86d9",
  content: "details without inferable entities",
  people,
  places,
  fallbackDate: "2026-05-20"
});
assertEqual("quick title plus details person inference", quickTitleWithDetails.personIds, ["p2"]);
assertEqual("quick title plus details place inference", quickTitleWithDetails.placeId, "l1");
assertEqual("quick title plus details date inference", quickTitleWithDetails.date, "2026-05-02");

if (failures) {
  console.error(`Memory inference regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log("Memory inference regression passed: 16 cases.");
