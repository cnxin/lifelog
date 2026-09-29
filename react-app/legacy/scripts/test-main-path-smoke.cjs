const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
  let source = fs.readFileSync(filePath, "utf8").replace(
    /export const APP_VERSION = __APP_VERSION__;/g,
    'export const APP_VERSION = "0.1.0-test.smoke";'
  );
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
    const resolved = path.resolve(path.dirname(filePath), id);
    const candidates = [`${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, "index.ts")];
    const target = candidates.find(fs.existsSync);
    if (!target) throw new Error(`Cannot resolve ${id} from ${relativeFile}`);
    return loadTs(path.relative(projectRoot, target));
  };
  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

function makeFormData(entries) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((item) => formData.append(key, item));
    else formData.set(key, value);
  }
  return formData;
}

async function main() {
  const failures = [];
  const { seedData } = loadTs("src/data/seedData.ts");
  const { buildMemoryFromFormData } = loadTs("src/utils/lifelogHelpers.ts");
  const { normalizeSearchText, parseSearchQuery, rankSearchResults, keyword } = loadTs("src/utils/globalSearch.ts");
  const { normalizeBackupPayload } = loadTs("src/utils/lifelogBackup.ts");
  const { buildBackupImportPreview } = loadTs("src/utils/backupHealth.ts");
  const { buildSearchResultRouteState, getSearchReturnQuery, isSearchResultFocus } = loadTs("src/utils/searchNavigation.ts");
  const { defaultAppSettings, defaultReminderSettings } = loadTs("src/types/index.ts");

  const memory = buildMemoryFromFormData({
    formData: makeFormData({
      memoryId: "smoke-memory",
      memoryMode: "quick",
      title: "和小明在海底捞庆祝",
      content: "固定种子的主路径回归记录",
      date: "2026-07-19",
      personIds: ["p1"],
      placeIds: ["l1"],
      mood: "开心",
      tags: "主路径"
    }),
    people: seedData.people,
    places: seedData.places,
    settings: defaultAppSettings
  });
  const state = { ...seedData, memories: [...seedData.memories, memory] };
  if (memory.id !== "smoke-memory" || memory.personIds[0] !== "p1" || memory.placeIds[0] !== "l1") {
    failures.push(`Quick save normalization failed: ${JSON.stringify(memory)}`);
  }

  const searchResult = {
    id: memory.id,
    kind: "memory",
    title: memory.title,
    subtitle: memory.content,
    meta: memory.date,
    path: `/memories/${memory.id}`,
    searchText: normalizeSearchText([memory.title, memory.content, "小明", "海底捞", ...memory.tags].join(" ")),
    keywords: [keyword("标题", memory.title), keyword("正文", memory.content), keyword("人物", "小明"), keyword("地点", "海底捞")].filter(Boolean),
    scoreBase: 11,
    date: memory.date,
    personNames: ["小明"]
  };
  const query = parseSearchQuery("@小明 2026-07-19");
  const results = rankSearchResults([searchResult], query);
  if (results.length !== 1 || results[0].id !== memory.id) failures.push("Saved memory was not found by person and date search.");

  const routeState = buildSearchResultRouteState("memory", memory.id, query.raw);
  if (!isSearchResultFocus(routeState, "memory", memory.id) || getSearchReturnQuery(routeState) !== query.raw) {
    failures.push(`Search return state was not recoverable: ${JSON.stringify(routeState)}`);
  }
  if (searchResult.path.includes(query.raw) || searchResult.path.includes(encodeURIComponent(query.raw))) {
    failures.push(`Search query leaked into result URL: ${searchResult.path}`);
  }

  const backup = {
    schemaVersion: 3,
    version: 3,
    storage: "indexeddb",
    exportedAt: "2026-07-19T12:00:00.000Z",
    appVersion: "0.1.0-test.smoke",
    data: state,
    settings: defaultAppSettings,
    reminderSettings: defaultReminderSettings,
    placeMergeHistory: [],
    photos: [],
    integrity: {
      people: state.people.length,
      places: state.places.length,
      memories: state.memories.length,
      anniversaryPlans: state.anniversaryPlans.length,
      photos: 0
    }
  };
  const preview = buildBackupImportPreview(backup, seedData);
  const normalized = await normalizeBackupPayload(backup);
  if (preview.memoriesDelta !== 1 || !normalized.state.memories.some((item) => item.id === memory.id)) {
    failures.push(`Backup preview/normalization lost saved memory: ${JSON.stringify({ preview, count: normalized.state.memories.length })}`);
  }

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("Main path smoke passed: seed, quick save, search return, backup preview, and import normalization.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
