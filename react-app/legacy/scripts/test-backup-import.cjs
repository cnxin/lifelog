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
    const resolved = path.resolve(path.dirname(filePath), id);
    const fileTarget = `${resolved}.ts`;
    const indexTarget = path.join(resolved, "index.ts");
    return loadTs(path.relative(projectRoot, fs.existsSync(fileTarget) ? fileTarget : indexTarget));
  };

  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { normalizeBackupPayload } = loadTs("src/utils/lifelogBackup.ts");

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

async function run() {
  const payload = {
    schemaVersion: 3,
    version: 3,
    storage: "indexeddb",
    exportedAt: "2026-05-26T15:11:33.610Z",
    appVersion: "0.1.0-test.77",
    data: {
      people: [],
      places: [],
      memories: [
        {
          id: "memory-current",
          title: "with photo",
          date: "2026-05-26",
          personIds: [],
          placeId: "",
          placeIds: [],
          mood: "daily",
          content: "",
          tags: [],
          photos: ["photo-1"]
        }
      ],
      anniversaryPlans: []
    },
    settings: {},
    reminderSettings: {},
    placeMergeHistory: [],
    photos: [
      {
        id: "photo-1",
        memoryId: "memory-stale",
        originalDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4OQAAAABJRU5ErkJggg==",
        thumbnailDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4OQAAAABJRU5ErkJggg==",
        width: 1,
        height: 1,
        fileSize: 5,
        mimeType: "image/png",
        uploadedAt: "2026-05-26T15:00:00.000Z",
        order: 0
      }
    ],
    integrity: {
      people: 0,
      places: 0,
      memories: 1,
      anniversaryPlans: 0,
      photos: 1
    }
  };

  const backup = await normalizeBackupPayload(payload);
  assertEqual("keeps photo count after stale memoryId repair", backup.photos.length, 1);
  assertEqual("repairs photo memoryId from memory photos list", backup.photos[0].memoryId, "memory-current");
  assertEqual("keeps memory photo reference", backup.state.memories[0].photos, ["photo-1"]);

  const unsafePayload = {
    ...payload,
    photos: [
      {
        id: "broken-photo",
        memoryId: "memory-current",
        originalDataUrl: "not-a-data-url",
        thumbnailDataUrl: "not-a-data-url",
        width: 1,
        height: 1,
        fileSize: 5,
        mimeType: "text/plain",
        uploadedAt: "2026-05-26T15:00:00.000Z",
        order: 0
      }
    ],
    integrity: {
      people: 0,
      places: 0,
      memories: 1,
      anniversaryPlans: 0,
      photos: 1
    }
  };

  let strictFailed = false;
  try {
    await normalizeBackupPayload(unsafePayload);
  } catch {
    strictFailed = true;
  }
  assertEqual("strict import fails on unreadable photo", strictFailed, true);

  const safeBackup = await normalizeBackupPayload(unsafePayload, { safeMode: true });
  assertEqual("safe import skips unreadable photo", safeBackup.photos.length, 0);
  assertEqual("safe import keeps memory without invalid photo", safeBackup.state.memories[0].photos, []);
  assertEqual("safe import records warnings", safeBackup.warnings.length > 0, true);

  if (failures) {
    console.error(`Backup import regression failed: ${failures} mismatch(es).`);
    process.exit(1);
  }
  console.log("Backup import regression passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
