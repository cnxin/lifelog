const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const source = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

const { normalizeNotionId } = loadTs("src/utils/notionIds.ts");

const cases = [
  ["https://www.notion.so/LifeLog-375f94b831b980fa8feddc0a65173bdc", "375f94b831b980fa8feddc0a65173bdc"],
  ["https://www.notion.so/375f94b831b980fa8feddc0a65173bdc?pvs=4", "375f94b831b980fa8feddc0a65173bdc"],
  ["375f94b8-31b9-80fa-8fed-dc0a65173bdc", "375f94b831b980fa8feddc0a65173bdc"],
  ["LifeLog 375f94b831b980fa8feddc0a65173bdc", "375f94b831b980fa8feddc0a65173bdc"]
];

let failures = 0;
for (const [input, expected] of cases) {
  const actual = normalizeNotionId(input);
  if (actual === expected) continue;
  failures += 1;
  console.error(`[normalizeNotionId] ${input} expected ${expected}, actual ${actual}`);
}

if (failures) {
  console.error(`Notion ID regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Notion ID regression passed: ${cases.length} cases.`);
