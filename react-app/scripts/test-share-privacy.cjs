const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/import type .*?;\r?\n/g, "");
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filePath, module);
  const localRequire = (id) => {
    if (!id.startsWith(".")) return require(id);
    const resolved = path.resolve(path.dirname(filePath), id);
    const target = [`${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, "index.ts")].find(fs.existsSync);
    if (!target) throw new Error(`Cannot resolve ${id} from ${relativeFile}`);
    return loadTs(path.relative(projectRoot, target));
  };
  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { buildMemorySharePayload, buildPlacesSharePayload, buildSharePresetOptions } = loadTs("src/utils/lifelogShare.ts");

const person = {
  id: "p1", name: "真实姓名", nickname: "昵称", relationship: "朋友", birthday: "", birthdayIsLunar: false,
  favorite: true, preferences: [], dislikes: [], anniversaries: [], notes: "私密备注"
};
const place = {
  id: "l1", name: "私密地点", country: "中国", province: "上海", city: "上海", area: "静安区", mall: "商场",
  storeName: "门店", category: "餐厅", rating: 5, address: "详细门牌", latitude: 31.2, longitude: 121.5,
  mapUrl: "https://example.test/map", sourceUrl: "https://example.test/source", platformLinks: [], photos: ["https://example.test/photo.jpg"],
  desc: "评价", tags: [], favorite: true
};
const memory = {
  id: "m1", kind: "memory", title: "记录标题", date: "2026-07-19", personIds: ["p1"], placeId: "l1", placeIds: ["l1"],
  mood: "开心", content: "私密正文", tags: [], photos: []
};
const state = { people: [person], places: [place], memories: [memory], anniversaryPlans: [], settings: {} };

(async () => {
  const privateOptions = buildSharePresetOptions("private");
  const privateMemory = await buildMemorySharePayload({ state, memoryId: "m1", photos: [], options: privateOptions.memory, appVersion: "test" });
  assert.deepStrictEqual({
    options: privateMemory.options.memory,
    personName: privateMemory.data.people[0].name,
    content: privateMemory.data.memories[0].content,
    place: {
      address: privateMemory.data.places[0].address,
      latitude: privateMemory.data.places[0].latitude,
      longitude: privateMemory.data.places[0].longitude,
      mapUrl: privateMemory.data.places[0].mapUrl
    },
    photos: privateMemory.data.photos.length
  }, {
    options: { includeContent: false, peopleMode: "anonymous", placeMode: "name", includePhotos: false },
    personName: "同行人 1",
    content: "",
    place: { address: "", latitude: undefined, longitude: undefined, mapUrl: "" },
    photos: 0
  });

  const trustedOptions = buildSharePresetOptions("trusted");
  const trustedMemory = await buildMemorySharePayload({ state, memoryId: "m1", photos: [], options: trustedOptions.memory, appVersion: "test" });
  assert.strictEqual(trustedMemory.data.people[0].name, "真实姓名");
  assert.strictEqual(trustedMemory.data.memories[0].content, "私密正文");
  assert.strictEqual(trustedMemory.data.places[0].address, "详细门牌");
  assert.strictEqual(trustedMemory.data.places[0].latitude, undefined);
  assert.strictEqual(trustedMemory.data.places[0].longitude, undefined);

  const privatePlaces = buildPlacesSharePayload({ state, placeIds: ["l1"], options: privateOptions.place, appVersion: "test" });
  assert.deepStrictEqual({
    address: privatePlaces.data.places[0].address,
    latitude: privatePlaces.data.places[0].latitude,
    longitude: privatePlaces.data.places[0].longitude,
    mapUrl: privatePlaces.data.places[0].mapUrl,
    photos: privatePlaces.data.places[0].photos
  }, { address: "", latitude: undefined, longitude: undefined, mapUrl: "", photos: [] });

  console.log("Share privacy regression passed: private/trusted payload snapshots are safe.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
