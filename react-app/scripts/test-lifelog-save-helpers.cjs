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

const { buildPlaceFromFormData } = loadTs("src/utils/lifelogHelpers.ts");

const settings = {
  defaultCity: "杭州",
  defaultRelationship: "朋友",
  defaultMood: "开心",
  themeStyle: "classic"
};

let failures = 0;

function makeFormData(entries) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

const newPlace = buildPlaceFromFormData(
  makeFormData({
    country: "中国",
    name: "新地点",
    category: "餐厅",
    address: "浙江省杭州市上城区延安路湖滨银泰"
  }),
  undefined,
  settings
);
assertEqual("new place uses default city", newPlace.city, "杭州");
assertEqual("new place infers province", newPlace.province, "浙江省");
assertEqual("new place infers mall", newPlace.mall, "湖滨银泰");

const editedPlace = buildPlaceFromFormData(
  makeFormData({
    country: "中国",
    name: "老地点",
    category: "餐厅",
    province: "",
    city: "",
    mall: "",
    rating: "0",
    address: "浙江省杭州市上城区延安路湖滨银泰"
  }),
  "existing-place",
  settings
);
assertEqual("edited place keeps empty province", editedPlace.province, "");
assertEqual("edited place keeps empty city", editedPlace.city, "");
assertEqual("edited place keeps empty mall", editedPlace.mall, "");
assertEqual("zero rating remains zero", editedPlace.rating, 0);

if (failures) {
  console.error(`LifeLog save helper regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log("LifeLog save helper regression passed: 7 cases.");
