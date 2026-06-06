const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const source = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8")
    .replace('import { buildPlaceDisplayName } from "./placeMeta";', 'const { buildPlaceDisplayName } = require("./placeMeta");')
    .replace('import { getMemoryPlaceIds } from "./memoryPlaces";', 'const { getMemoryPlaceIds } = require("./memoryPlaces");')
    .replace('import { notionRequest, testNotionConnection } from "./notionClient";', 'const { notionRequest, testNotionConnection } = require("./notionClient");');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  function localRequire(id) {
    if (id === "./placeMeta") return { buildPlaceDisplayName: (place) => place.storeName || place.name || place.mall || "未命名地点" };
    if (id === "./memoryPlaces") return { getMemoryPlaceIds: (memory) => memory.placeIds?.length ? memory.placeIds : memory.placeId ? [memory.placeId] : [] };
    if (id === "./notionIds") return loadTs("src/utils/notionIds.ts");
    if (id === "./notionClient") return loadTs("src/utils/notionClient.ts");
    if (id === "@capacitor/core") {
      return {
        Capacitor: { isNativePlatform: () => false },
        CapacitorHttp: { request: async () => ({ status: 500, data: {} }) }
      };
    }
    return require(id);
  }
  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const {
  buildMemoryProperties,
  buildPersonProperties,
  syncLifeLogToNotion
} = loadTs("src/utils/notionSync.ts");
const {
  getNotionRecordSyncMeta
} = loadTs("src/utils/notionStatus.ts");

const state = {
  people: [{
    id: "p1",
    name: "测试人物",
    relationship: "朋友",
    favorite: true,
    preferences: [{ category: "饮食", items: ["咖啡"] }],
    dislikes: [],
    anniversaries: [],
    notes: "备注"
  }],
  places: [{
    id: "pl1",
    name: "测试咖啡",
    country: "中国",
    province: "",
    city: "杭州",
    area: "西湖",
    mall: "测试商场",
    storeName: "测试咖啡",
    category: "咖啡",
    rating: 4.5,
    address: "测试路 1 号",
    mapUrl: "https://example.invalid/map",
    sourceUrl: "",
    platformLinks: [],
    photos: [],
    desc: "",
    tags: ["安静"],
    favorite: false
  }],
  memories: [{
    id: "m1",
    title: "一次测试",
    date: "2026-06-04",
    personIds: ["p1"],
    placeId: "pl1",
    placeIds: ["pl1"],
    mood: "开心",
    content: "正文",
    tags: ["测试"],
    photos: ["photo1"]
  }],
  anniversaryPlans: []
};

const settings = {
  enabled: true,
  mode: "manual-token",
  token: "secret_test",
  workspaceName: "",
  workspaceBotName: "",
  parentPageId: "page_parent",
  peopleDatabaseId: "db_people",
  placesDatabaseId: "",
  memoriesDatabaseId: "",
  plansDatabaseId: "",
  apiVersion: "2022-06-28"
};

let failures = 0;

const peopleSchema = {
  id: "db_people",
  title: [{ plain_text: "People" }],
  properties: {
    Name: { type: "title" },
    "LifeLog ID": { type: "rich_text" },
    Relationship: { type: "select" },
    Favorite: { type: "checkbox" },
    Preferences: { type: "rich_text" },
    Notes: { type: "rich_text" },
    "Updated At": { type: "date" }
  }
};

function assert(condition, label, detail) {
  if (condition) return;
  failures += 1;
  console.error(`[${label}] ${detail || "assertion failed"}`);
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function buildFetcher(options = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith("/users/me")) {
      return response(200, { name: "LifeLog Bot", bot: { workspace_name: "Test Space" } });
    }
    if (url.includes("/databases/db_people")) {
      return response(200, peopleSchema);
    }
    if (url.includes("/pages/old-page")) {
      return options.page404 ? response(404, { message: "not found" }) : response(200, { id: "old-page" });
    }
    if (url.endsWith("/pages")) {
      return response(200, { id: options.createdPageId || "new-page" });
    }
    return response(404, { message: "unexpected url" });
  };
  fetcher.calls = calls;
  return fetcher;
}

async function run() {
  const personProps = buildPersonProperties(state.people[0]);
  assert(personProps["名称"].title[0].text.content === "测试人物", "person title", JSON.stringify(personProps["名称"]));
  assert(personProps["喜好档案"].rich_text[0].text.content.includes("饮食"), "person preferences", JSON.stringify(personProps["喜好档案"]));

  const memoryProps = buildMemoryProperties(state.memories[0], state);
  assert(memoryProps["照片数量"].number === 1, "memory photo count", JSON.stringify(memoryProps["照片数量"]));
  assert(memoryProps["关联人物"].rich_text[0].text.content === "测试人物", "memory people fallback", JSON.stringify(memoryProps["关联人物"]));

  const createFetcher = buildFetcher();
  const first = await syncLifeLogToNotion({ state, settings, mappings: [], fetcher: createFetcher });
  assert(first.synced === 1 && first.created === 1 && first.failed === 0, "first sync summary", JSON.stringify(first));
  assert(first.byType.person.total === 1 && first.byType.person.created === 1, "first sync type summary", JSON.stringify(first.byType));
  assert(first.byType.place.total === 0 && first.byType.memory.total === 0, "unconfigured type summary", JSON.stringify(first.byType));
  assert(first.mappings[0].notionPageId === "new-page", "mapping page id", JSON.stringify(first.mappings[0]));
  assert(createFetcher.calls.some((call) => call.url.endsWith("/pages") && call.init.method === "POST"), "create call", JSON.stringify(createFetcher.calls));
  const createBody = createFetcher.calls.find((call) => call.url.endsWith("/pages")).body;
  assert(createBody.properties.Name.title[0].text.content === "测试人物", "english schema alias", JSON.stringify(createBody.properties));
  assert(createBody.properties.Preferences.rich_text[0].text.content.includes("饮食"), "english schema preference alias", JSON.stringify(createBody.properties));
  assert(!("生日" in createBody.properties) && !("Birthday" in createBody.properties), "schema filter", JSON.stringify(createBody.properties));

  const skip = await syncLifeLogToNotion({ state, settings, mappings: first.mappings, fetcher: buildFetcher() });
  assert(skip.synced === 0 && skip.skipped === 1, "skip unchanged", JSON.stringify(skip));
  assert(skip.byType.person.total === 1 && skip.byType.person.skipped === 1, "skip type summary", JSON.stringify(skip.byType));

  const rebuildFetcher = buildFetcher({ page404: true, createdPageId: "rebuilt-page" });
  const rebuild = await syncLifeLogToNotion({
    state,
    settings,
    mappings: [{ ...first.mappings[0], notionPageId: "old-page", lastSyncHash: "stale" }],
    fetcher: rebuildFetcher
  });
  assert(rebuild.created === 1 && rebuild.mappings[0].notionPageId === "rebuilt-page", "rebuild deleted page", JSON.stringify(rebuild));
  assert(rebuild.byType.person.created === 1 && rebuild.byType.person.failed === 0, "rebuild type summary", JSON.stringify(rebuild.byType));

  const schemaNetwork = await syncLifeLogToNotion({
    state,
    settings,
    mappings: [],
    fetcher: async (url) => {
      if (url.endsWith("/users/me")) return response(200, { name: "LifeLog Bot", bot: { workspace_name: "Test Space" } });
      throw new Error("schema fetch failed");
    }
  });
  assert(schemaNetwork.failed === 1 && schemaNetwork.diagnostic?.path === "/databases/db_people", "schema diagnostic", JSON.stringify(schemaNetwork));
  assert(schemaNetwork.byType.person.total === 0 && schemaNetwork.byType.person.failed === 0, "preflight failure type summary", JSON.stringify(schemaNetwork.byType));

  const targetedFetcher = buildFetcher();
  const targeted = await syncLifeLogToNotion({
    state,
    settings,
    mappings: [],
    options: { targets: [{ entityType: "person", entityId: "p1" }] },
    fetcher: targetedFetcher
  });
  assert(targeted.total === 1 && targeted.byType.person.total === 1, "targeted sync total", JSON.stringify(targeted));
  assert(targeted.byType.place.total === 0 && targeted.byType.memory.total === 0, "targeted sync excludes other types", JSON.stringify(targeted.byType));

  const lightweightFetcher = buildFetcher();
  const lightweight = await syncLifeLogToNotion({
    state,
    settings: { ...settings, workspaceName: "Cached Space", workspaceBotName: "Cached Bot" },
    mappings: [],
    options: { targets: [{ entityType: "person", entityId: "p1" }], connectionMode: "targeted" },
    fetcher: lightweightFetcher
  });
  assert(lightweight.synced === 1 && lightweight.failed === 0, "targeted lightweight sync", JSON.stringify(lightweight));
  assert(!lightweightFetcher.calls.some((call) => call.url.endsWith("/users/me")), "targeted skips user probe", JSON.stringify(lightweightFetcher.calls));
  assert(lightweight.workspaceName === "Cached Space", "targeted keeps cached workspace", JSON.stringify(lightweight));

  const syncedMeta = getNotionRecordSyncMeta({
    enabled: true,
    entityType: "person",
    entityId: "p1",
    mappings: [{ ...first.mappings[0], lastError: "" }],
    queue: []
  });
  assert(syncedMeta.status === "synced", "sync status mapped", JSON.stringify(syncedMeta));
  const queuedMeta = getNotionRecordSyncMeta({
    enabled: true,
    entityType: "person",
    entityId: "p1",
    mappings: [{ ...first.mappings[0], lastError: "" }],
    queue: [{ id: "person:p1", entityType: "person", entityId: "p1", targetLabel: "人物：测试人物", status: "pending", attempts: 0, queuedAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }]
  });
  assert(queuedMeta.status === "pending", "sync status queue priority", JSON.stringify(queuedMeta));
  const failedMeta = getNotionRecordSyncMeta({
    enabled: true,
    entityType: "person",
    entityId: "p1",
    mappings: [{ ...first.mappings[0], lastError: "" }],
    queue: [{ id: "person:p1", entityType: "person", entityId: "p1", targetLabel: "人物：测试人物", status: "failed", attempts: 1, queuedAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:01:00.000Z", lastError: "blocked" }]
  });
  assert(failedMeta.status === "failed" && failedMeta.lastError === "blocked", "sync status failed priority", JSON.stringify(failedMeta));

  const itemFailure = await syncLifeLogToNotion({
    state,
    settings,
    mappings: [],
    fetcher: async (url, init) => {
      if (url.endsWith("/users/me")) return response(200, { name: "LifeLog Bot", bot: { workspace_name: "Test Space" } });
      if (url.includes("/databases/db_people")) {
        return response(200, {
          id: "db_people",
          title: [{ plain_text: "People" }],
          properties: peopleSchema.properties
        });
      }
      if (url.endsWith("/pages") && init.method === "POST") return response(403, { message: "create blocked" });
      return response(404, { message: "unexpected url" });
    }
  });
  assert(itemFailure.failed === 1 && itemFailure.failedItems.length === 1, "failed item captured", JSON.stringify(itemFailure));
  assert(itemFailure.failedItems[0].entityType === "person" && itemFailure.failedItems[0].message.includes("create blocked"), "failed item detail", JSON.stringify(itemFailure.failedItems));

  if (failures) {
    console.error(`Notion sync regression failed: ${failures} mismatch(es).`);
    process.exit(1);
  }

  console.log("Notion sync regression passed: mapping, schema filtering, create, skip and deleted-page rebuild.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
