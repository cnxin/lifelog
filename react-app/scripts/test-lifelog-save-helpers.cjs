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

const { buildMemoryFromFormData, buildPlaceFromFormData } = loadTs("src/utils/lifelogHelpers.ts");

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

const people = [
  { id: "p1", name: "\u5c0f\u6797", nickname: "\u6797\u6797" },
  { id: "p2", name: "\u963f\u5468" }
];
const places = [
  { id: "l1", name: "\u84dd\u86d9", storeName: "\u6e56\u6ee8\u94f6\u6cf0in77\u5e97", mall: "\u6e56\u6ee8\u94f6\u6cf0", area: "\u4e0a\u57ce\u533a" },
  { id: "l2", name: "Seesaw Coffee", storeName: "\u5609\u91cc\u4e2d\u5fc3\u5e97", mall: "\u676d\u5dde\u5609\u91cc\u4e2d\u5fc3", area: "\u62f1\u5885\u533a" }
];

const quickMemory = buildMemoryFromFormData({
  formData: makeFormData({
    memoryId: "m1",
    memoryMode: "quick",
    title: "\u6628\u5929\u548c\u5c0f\u6797\u5728Seesaw Coffee",
    content: "",
    date: "2026-05-20",
    mood: "平静",
    tags: "\u65e5\u5e38\u3001\u503c\u5f97\u8bb0\u4f4f"
  }),
  people,
  places,
  settings
});
assertEqual("quick memory infers date from title", quickMemory.date, "2026-05-19");
assertEqual("quick memory infers person from title", quickMemory.personIds, ["p1"]);
assertEqual("quick memory infers place from title", quickMemory.placeId, "l2");
assertEqual("quick memory stores inferred place ids", quickMemory.placeIds, ["l2"]);
assertEqual("quick memory parses tags", quickMemory.tags, ["日常", "值得记住"]);

const contextualQuickMemory = buildMemoryFromFormData({
  formData: makeFormData({
    memoryId: "m2",
    memoryMode: "quick",
    title: "\u987a\u624b\u8bb0\u4e00\u4e0b",
    content: "\u6b63\u6587\u6ca1\u6709\u660e\u786e\u4eba\u7269\u548c\u5730\u70b9",
    date: "2026-05-20",
    personIds: "p2",
    placeId: "l1"
  }),
  people,
  places,
  settings
});
assertEqual("quick memory keeps contextual person", contextualQuickMemory.personIds, ["p2"]);
assertEqual("quick memory keeps contextual place", contextualQuickMemory.placeId, "l1");
assertEqual("quick memory stores contextual place ids", contextualQuickMemory.placeIds, ["l1"]);
assertEqual("quick memory uses default mood when new mood empty", contextualQuickMemory.mood, "开心");

const multiPlaceFormData = makeFormData({
  memoryId: "m_multi",
  title: "商场半日",
  content: "先吃饭再喝咖啡",
  date: "2026-05-20",
  mood: "开心",
  placeId: "l1"
});
multiPlaceFormData.append("placeIds", "l1");
multiPlaceFormData.append("placeIds", "l2");
const multiPlaceMemory = buildMemoryFromFormData({
  formData: multiPlaceFormData,
  people,
  places,
  settings
});
assertEqual("memory supports multiple place ids", multiPlaceMemory.placeIds, ["l1", "l2"]);
assertEqual("memory primary place uses first selected place", multiPlaceMemory.placeId, "l1");

const editedMemory = buildMemoryFromFormData({
  formData: makeFormData({
    memoryId: "ignored",
    title: "\u5df2\u7f16\u8f91",
    content: "\u66f4\u65b0\u6b63\u6587",
    date: "2026-05-20",
    mood: ""
  }),
  existing: {
    id: "m_existing",
    title: "\u65e7\u56de\u5fc6",
    date: "2026-05-19",
    personIds: ["p1"],
    placeId: "l1",
    placeIds: ["l1"],
    mood: "开心",
    content: "\u65e7\u6b63\u6587",
    tags: ["old"],
    photos: ["photo-1"]
  },
  people,
  places,
  settings
});
assertEqual("edited memory keeps existing id", editedMemory.id, "m_existing");
assertEqual("edited memory keeps empty mood", editedMemory.mood, "");
assertEqual("edited memory keeps place when form has no place controls", editedMemory.placeId, "l1");
assertEqual("edited memory keeps place ids when form has no place controls", editedMemory.placeIds, ["l1"]);
assertEqual("edited memory keeps existing photos when no photo ids passed", editedMemory.photos, ["photo-1"]);

if (failures) {
  console.error(`LifeLog save helper regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log("LifeLog save helper regression passed: 23 cases.");
