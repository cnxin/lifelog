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
    if (id === "@capacitor/local-notifications") {
      return { LocalNotifications: {} };
    }
    if (!id.startsWith(".")) return require(id);
    return loadTs(path.relative(projectRoot, path.resolve(path.dirname(filePath), `${id}.ts`)));
  };

  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { previewReminderSchedule, previewUpcomingReminders } = loadTs("src/utils/reminderScheduler.ts");

const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const people = [
  {
    id: "p1",
    name: "小林",
    relationship: "朋友",
    birthday: todayIso,
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [{ title: "生日", date: todayIso }],
    notes: ""
  }
];
const memories = [
  {
    id: "m1",
    title: "去年今天",
    date: `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    personIds: ["p1"],
    placeId: "",
    mood: "",
    content: "",
    tags: [],
    photos: []
  }
];
const settings = {
  birthdayEnabled: true,
  birthdayAdvanceDays: 7,
  birthdayTime: "09:00",
  anniversaryEnabled: true,
  anniversaryAdvanceDays: 3,
  anniversaryTime: "09:00",
  contactEnabled: false,
  contactIntervalDays: 30,
  contactTime: "20:00",
  memoryEnabled: true,
  memoryTime: "21:00"
};

const summary = previewReminderSchedule(people, memories, settings);
const upcoming = previewUpcomingReminders(people, memories, settings, { days: 7, limit: 6 });
const failures = [];

if (summary.totalGenerated < 2 || summary.scheduledCount < 2) {
  failures.push(`Unexpected reminder summary: ${JSON.stringify(summary)}`);
}

if (!upcoming.some((item) => item.type === "生日" && item.title.includes("生日"))) {
  failures.push(`Missing birthday preview: ${JSON.stringify(upcoming)}`);
}

if (!upcoming.some((item) => item.type === "回忆" && item.title.includes("年前的今天"))) {
  failures.push(`Missing memory preview: ${JSON.stringify(upcoming)}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Reminder preview regression passed: ${upcoming.length} upcoming item(s).`);
