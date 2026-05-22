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

  const localRequire = (id) => {
    if (!id.startsWith(".")) return require(id);
    return loadTs(path.relative(projectRoot, path.resolve(path.dirname(filePath), `${id}.ts`)));
  };

  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const {
  buildDefaultQuickMemoryTitle,
  buildMemoryContentTemplates,
  buildQuickMemoryTemplates,
  formatPeopleLabel
} = loadTs("src/utils/quickMemoryContext.ts");

const cases = [
  {
    label: "person and place default title",
    actual: buildDefaultQuickMemoryTitle({ personNames: ["小林"], placeName: "湖滨银泰" }),
    expected: "和小林在湖滨银泰"
  },
  {
    label: "person default title",
    actual: buildDefaultQuickMemoryTitle({ personNames: ["小林"], placeName: "" }),
    expected: "和小林见了一面"
  },
  {
    label: "place default title",
    actual: buildDefaultQuickMemoryTitle({ personNames: [], placeName: "天目里" }),
    expected: "去了天目里"
  },
  {
    label: "two people label",
    actual: formatPeopleLabel(["小林", "阿周"]),
    expected: "小林和阿周"
  },
  {
    label: "many people label",
    actual: formatPeopleLabel(["小林", "阿周", "老王"]),
    expected: "小林等3人"
  },
  {
    label: "person and place templates",
    actual: buildQuickMemoryTemplates(["小林"], "湖滨银泰"),
    expected: ["和小林在湖滨银泰", "和小林去了湖滨银泰", "在湖滨银泰和小林聊了聊", "和小林的一次见面"]
  },
  {
    label: "empty templates",
    actual: buildQuickMemoryTemplates([], ""),
    expected: []
  },
  {
    label: "content templates with person and place",
    actual: buildMemoryContentTemplates(["小林"], "湖滨银泰"),
    expected: [
      "和小林在湖滨银泰：",
      "和小林聊到：",
      "湖滨银泰这次体验：",
      "今天发生了：\n下次可以：",
      "值得记住的是：\n当时的感受："
    ]
  }
];

let failures = 0;

for (const item of cases) {
  if (JSON.stringify(item.actual) === JSON.stringify(item.expected)) continue;
  failures += 1;
  console.error(`[${item.label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(item.expected)}`);
  console.error(`  actual:   ${JSON.stringify(item.actual)}`);
}

if (failures) {
  console.error(`Quick memory context regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Quick memory context regression passed: ${cases.length} cases.`);
