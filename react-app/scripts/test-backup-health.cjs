const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/import type .*?;\n/g, "");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
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

const { buildBackupImportPreview } = loadTs("src/utils/backupHealth.ts");

const preview = buildBackupImportPreview({
  data: {
    people: [],
    places: [],
    memories: [
      {
        id: "memory-current",
        photos: ["photo-repair", "photo-missing"]
      }
    ]
  },
  photos: [
    { id: "photo-repair", memoryId: "memory-stale" },
    { id: "photo-extra", memoryId: "memory-current" },
    { id: "photo-ignored", memoryId: "memory-stale" }
  ]
});

const failures = [];
if (preview.repairedPhotos !== 1) failures.push(`Expected 1 repaired photo, got ${preview.repairedPhotos}`);
if (preview.ignoredPhotos !== 1) failures.push(`Expected 1 ignored photo, got ${preview.ignoredPhotos}`);
if (preview.missingPhotoRefs !== 1) failures.push(`Expected 1 missing photo ref, got ${preview.missingPhotoRefs}`);
if (preview.extraPhotoRefs !== 1) failures.push(`Expected 1 extra photo ref, got ${preview.extraPhotoRefs}`);
if (preview.issueCount !== 4) failures.push(`Expected 4 issues, got ${preview.issueCount}: ${preview.issues.join("; ")}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Backup health regression passed.");
