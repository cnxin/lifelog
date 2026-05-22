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

const { buildMemoryDisplayContext, getMemoryDisplayTitle } = loadTs("src/utils/memoryDisplay.ts");

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

function makeMemory(patch) {
  return {
    id: "m1",
    title: "",
    date: "2026-05-20",
    personIds: [],
    placeId: "",
    placeIds: [],
    mood: "",
    content: "",
    tags: [],
    photos: [],
    ...patch
  };
}

const missingPlaceContext = buildMemoryDisplayContext(
  makeMemory({ placeId: "" }),
  () => "未关联人物",
  () => "未关联地点"
);
assertEqual("empty place id is not treated as a place", missingPlaceContext.placeName, "");

const deletedPlaceContext = buildMemoryDisplayContext(
  makeMemory({ placeId: "deleted-place", content: "补记一段没有地点的内容" }),
  () => "未关联人物",
  () => "未关联地点"
);
assertEqual("deleted place placeholder is hidden from context", deletedPlaceContext.placeName, "");
assertEqual(
  "deleted place does not generate fake title",
  getMemoryDisplayTitle(makeMemory({ placeId: "deleted-place", content: "补记一段没有地点的内容" }), deletedPlaceContext),
  "补记一段没有地点的内容"
);

const validContext = buildMemoryDisplayContext(
  makeMemory({ personIds: ["p1"], placeId: "l1" }),
  () => "小林",
  () => "蓝蛙"
);
assertEqual("valid context keeps person and place", validContext, { personNames: ["小林"], placeName: "蓝蛙", placeNames: ["蓝蛙"] });
const multiPlaceContext = buildMemoryDisplayContext(
  makeMemory({ placeId: "l1", placeIds: ["l1", "l2"] }),
  () => "未关联人物",
  (id) => (id === "l1" ? "蓝蛙" : "Seesaw Coffee")
);
assertEqual("multi-place context joins place names", multiPlaceContext.placeName, "蓝蛙、Seesaw Coffee");
assertEqual(
  "valid context still builds person-place title",
  getMemoryDisplayTitle(makeMemory({ personIds: ["p1"], placeId: "l1" }), validContext),
  "和小林在蓝蛙"
);

if (failures) {
  console.error(`Memory display regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log("Memory display regression passed: 6 cases.");
