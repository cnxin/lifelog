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
  buildCalendarItemsForDateRange,
  buildCalendarMonthDays,
  groupCalendarItemsByDate
} = loadTs("src/utils/calendarItems.ts");

const days = buildCalendarMonthDays(new Date(2026, 4, 1));
const range = { start: days[0].dateKey, end: days[days.length - 1].dateKey };
const state = {
  people: [
    {
      id: "p1",
      name: "王芳媛",
      relationship: "朋友",
      birthday: "",
      favorite: false,
      preferences: [],
      dislikes: [],
      anniversaries: [
        {
          title: "订婚",
          date: "2025-06-01",
          milestoneMode: "custom",
          milestoneDays: [365],
          milestoneCounting: "elapsed"
        }
      ],
      notes: ""
    }
  ],
  places: [],
  memories: []
};

const items = buildCalendarItemsForDateRange(range.start, range.end, state, () => "未关联人物", () => "未关联地点");
const grouped = groupCalendarItemsByDate(items);
const failures = [];

if (range.start !== "2026-04-27" || range.end !== "2026-06-07") {
  failures.push(`Unexpected May 2026 calendar range: ${JSON.stringify(range)}`);
}

if (!grouped["2026-06-01"]?.some((item) => item.title === "王芳媛 · 订婚")) {
  failures.push(`Missing next-month anniversary on 2026-06-01: ${JSON.stringify(grouped["2026-06-01"])}`);
}

if (!grouped["2026-06-01"]?.some((item) => item.title === "王芳媛 · 订婚 满 365 天")) {
  failures.push(`Missing milestone anniversary on 2026-06-01: ${JSON.stringify(grouped["2026-06-01"])}`);
}

const anniversaryTargets = (grouped["2026-06-01"] || [])
  .filter((item) => item.type === "person")
  .map((item) => item.target);
if (!anniversaryTargets.every((target) => target.includes("anniversary=%E8%AE%A2%E5%A9%9A%7C2025-06-01#anniversaries"))) {
  failures.push(`Anniversary calendar targets should include the specific anniversary key: ${JSON.stringify(anniversaryTargets)}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Calendar items regression passed: cross-month anniversary is visible.");
