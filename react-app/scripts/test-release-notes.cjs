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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filePath, module);

  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

const packageJson = require("../package.json");
const { getReleaseNote, RELEASE_NOTES } = loadTs("src/constants/releaseNotes.ts");

const current = getReleaseNote(packageJson.version);
const failures = [];

if (!current || current.version !== packageJson.version) {
  failures.push(`Missing release note for current version ${packageJson.version}`);
}

for (const note of RELEASE_NOTES) {
  if (!note.version || !note.date || !note.title) {
    failures.push(`Incomplete release note metadata: ${JSON.stringify(note)}`);
  }
  if (!Array.isArray(note.highlights) || note.highlights.length < 2) {
    failures.push(`Release note ${note.version} should include at least 2 highlights`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Release notes regression passed: ${RELEASE_NOTES.length} versions, current ${packageJson.version}.`);
