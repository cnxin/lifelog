const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  const source = fs.readFileSync(filePath, "utf8").replace(
    'import { APP_VERSION } from "../constants/version";',
    'const APP_VERSION = "0.1.0-test.60";'
  );
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

const { compareVersions } = loadTs("src/utils/updateChecker.ts");

const cases = [
  ["0.1.0-test.61", "0.1.0-test.60", 1],
  ["v0.1.0-test.60", "0.1.0-test.60", 0],
  ["0.1.0-test.59", "0.1.0-test.60", -1],
  ["0.1.1", "0.1.0-test.60", 1],
  ["0.2.0", "0.1.9", 1]
];

let failures = 0;

for (const [left, right, expectedSign] of cases) {
  const actual = Math.sign(compareVersions(left, right));
  if (actual === expectedSign) continue;
  failures += 1;
  console.error(`[compareVersions ${left} vs ${right}] expected ${expectedSign}, actual ${actual}`);
}

if (failures) {
  console.error(`Update checker regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Update checker regression passed: ${cases.length} cases.`);
