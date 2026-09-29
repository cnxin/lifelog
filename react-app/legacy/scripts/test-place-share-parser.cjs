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

const { parsePlaceShare } = loadTs("src/utils/placeShareParser.ts");
const { parsePlatformLinksText, platformLinksToText } = loadTs("src/utils/placeLinks.ts");
const { groupsToText, parseGroups, splitList, splitPreferenceItems } = loadTs("src/utils/text.ts");
const { placeCases, textCases } = require("./place-share-samples.cjs");

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

for (const item of placeCases) {
  const parsed = parsePlaceShare(item.input);
  for (const [key, expectedValue] of Object.entries(item.expected)) {
    assertEqual(`${item.label} ${key}`, parsed[key], expectedValue);
  }
}

for (const item of textCases) {
  assertEqual(item.label, runTextCase(item.actual, item.input), item.expected);
}

if (failures) {
  console.error(`Parser regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Parser regression passed: ${placeCases.length} place cases and ${textCases.length} text cases.`);

function runTextCase(type, input) {
  if (type === "parseGroups") return parseGroups(input);
  if (type === "splitPreferenceItems") return splitPreferenceItems(input);
  if (type === "splitList") return splitList(input);
  if (type === "groupsToText") return groupsToText(input);
  if (type === "platformLinksRoundTrip") return platformLinksToText(parsePlatformLinksText(input));
  if (type === "platformLinksParsed") return parsePlatformLinksText(input);
  throw new Error(`Unknown text case type: ${type}`);
}
