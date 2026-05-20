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

const {
  matchesPlaceLocationFilter,
  placeAreaLabel,
  placeCityLabel,
  placeCountryLabel,
  placeProvinceLabel
} = loadTs("src/hooks/usePlaceLocationFilter.ts");

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

const completePlace = { country: "中国", province: "浙江省", city: "杭州", area: "上城区" };
const incompletePlace = { country: "", province: "", city: "", area: "" };

assertEqual("country fallback label", placeCountryLabel(incompletePlace), "中国");
assertEqual("province fallback label", placeProvinceLabel(incompletePlace), "未设置");
assertEqual("city fallback label", placeCityLabel(incompletePlace), "未设置");
assertEqual("area fallback label", placeAreaLabel(incompletePlace), "未分组");

assertEqual(
  "complete place matches exact filters",
  matchesPlaceLocationFilter(completePlace, {
    country: "中国",
    province: "浙江省",
    city: "杭州",
    area: "上城区"
  }),
  true
);
assertEqual(
  "empty place matches unset filters",
  matchesPlaceLocationFilter(incompletePlace, {
    country: "中国",
    province: "未设置",
    city: "未设置",
    area: "未分组"
  }),
  true
);
assertEqual(
  "empty place does not match real city filter",
  matchesPlaceLocationFilter(incompletePlace, {
    country: "中国",
    province: "未设置",
    city: "杭州",
    area: "全部"
  }),
  false
);
assertEqual(
  "all filters match regardless of empty labels",
  matchesPlaceLocationFilter(incompletePlace, {
    country: "全部",
    province: "全部",
    city: "全部",
    area: "全部"
  }),
  true
);

if (failures) {
  console.error(`Place location filter regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log("Place location filter regression passed: 8 cases.");
