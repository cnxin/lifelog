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
const { anniversaryOccurrenceLabel, anniversaryYearLabel } = loadTs("src/utils/date.ts");

const today = new Date();
const todayIso = formatDateValue(today);
const futureAnniversary = formatDateValue(addDays(today, 6));
const firstAnniversary = formatDateValue(today);
const milestoneStart = formatDateValue(addDays(today, -97));
const people = [
  {
    id: "p1",
    name: "小林",
    relationship: "朋友",
    birthday: todayIso,
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [
      { title: "生日", date: todayIso },
      { title: "相识日", date: futureAnniversary }
    ],
    notes: ""
  },
  {
    id: "p2",
    name: "小周",
    relationship: "朋友",
    birthday: "",
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [{ title: "第一次见面", date: firstAnniversary }],
    notes: ""
  },
  {
    id: "p3",
    name: "小顾",
    relationship: "朋友",
    birthday: "",
    favorite: false,
    preferences: [],
    dislikes: [],
    anniversaries: [
      {
        title: "相识日",
        date: milestoneStart,
        milestoneMode: "custom",
        milestoneDays: [100],
        milestoneCounting: "elapsed"
      }
    ],
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
const upcoming = previewUpcomingReminders(people, memories, settings, { days: 7, limit: 10 });
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

const futureAnniversaryPreview = upcoming.find((item) => item.type === "纪念日" && item.sourceId === "p1" && item.title.includes("相识日"));
if (!futureAnniversaryPreview?.body.includes("还有 6 天") || !futureAnniversaryPreview.body.includes("提前 3 天提醒")) {
  failures.push(`Anniversary preview should use target-day distance, got: ${JSON.stringify(futureAnniversaryPreview)}`);
}

if (futureAnniversaryPreview?.sourcePath !== `/people/p1?anniversary=${encodeURIComponent(`相识日|${futureAnniversary}`)}#anniversaries`) {
  failures.push(`Anniversary preview should link to the person's anniversaries, got: ${JSON.stringify(futureAnniversaryPreview)}`);
}

const firstAnniversaryPreview = upcoming.find((item) => item.type === "纪念日" && item.title.includes("第一次见面"));
if (!firstAnniversaryPreview?.body.includes("首次纪念日")) {
  failures.push(`First anniversary should use explicit label, got: ${JSON.stringify(firstAnniversaryPreview)}`);
}

const milestonePreview = upcoming.find((item) => item.type === "纪念日" && item.title.includes("满 100 天"));
if (!milestonePreview?.body.includes("还有 3 天") || !milestonePreview.body.includes("满 100 天") || !milestonePreview.body.includes("提前 3 天提醒")) {
  failures.push(`Milestone preview should show target-day distance, got: ${JSON.stringify(milestonePreview)}`);
}

if (milestonePreview?.sourcePath !== `/people/p3?anniversary=${encodeURIComponent(`相识日|${milestoneStart}`)}#anniversaries`) {
  failures.push(`Milestone preview should link to the person's anniversaries, got: ${JSON.stringify(milestonePreview)}`);
}

if (anniversaryYearLabel(futureAnniversary) !== "未满 1 周年") {
  failures.push(`Current anniversary label should describe elapsed years, got: ${anniversaryYearLabel(futureAnniversary)}`);
}

if (anniversaryOccurrenceLabel(futureAnniversary, addDays(today, 6)) !== "首次纪念日") {
  failures.push(`Occurrence anniversary label should describe target occurrence, got: ${anniversaryOccurrenceLabel(futureAnniversary, addDays(today, 6))}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Reminder preview regression passed: ${upcoming.length} upcoming item(s).`);

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
