const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "exports", "module", code)(
    (name) => imports[name] || require(name),
    mod.exports,
    mod,
  );
  return mod.exports;
}
const domain = load("src/domain.ts");
const {
  monthCells,
  shiftDate,
  shiftMonth,
  monthOccurrences,
  calendarDateInfo,
} = load("src/calendar.ts", { "./domain": domain });
const day = (patch = {}) => ({
  id: "one",
  title: "纪念日",
  date: "2024-05-20",
  category: "纪念日",
  repeat: "none",
  calendar: "solar",
  note: "",
  pinned: false,
  ...patch,
});

test("calendar grid is Monday-first, stable six rows, with correct leap-month days", () => {
  const cells = monthCells("2026-02");
  assert.equal(cells.length, 42);
  assert.deepEqual(cells.slice(0, 7), [
    null,
    null,
    null,
    null,
    null,
    null,
    "2026-02-01",
  ]);
  assert.equal(cells.filter(Boolean).length, 28);
  assert.equal(monthCells("2024-02").filter(Boolean).length, 29);
  assert.equal(monthCells("2026-08")[35], "2026-08-31");
});
test("calendar navigation handles year boundaries, leap days and DST", () => {
  assert.equal(shiftDate("2026-03-08", 1), "2026-03-09");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftMonth("2024-01-31", 1), "2024-02-29");
  assert.equal(shiftMonth("2024-02-29", 12), "2025-02-28");
  assert.equal(shiftMonth("2026-01-31", -1), "2025-12-31");
});
test("calendar non-repeating days appear only on their original date", () => {
  assert.equal(
    monthOccurrences([day()], "2024-05").get("2024-05-20").length,
    1,
  );
  assert.equal(monthOccurrences([day()], "2026-05").size, 0);
});
test("calendar annual leap dates use the existing clamp and never appear before their start", () => {
  const d = day({ date: "2024-02-29", repeat: "yearly" });
  assert.ok(monthOccurrences([d], "2025-02").has("2025-02-28"));
  assert.ok(monthOccurrences([d], "2028-02").has("2028-02-29"));
  assert.equal(monthOccurrences([d], "2023-02").size, 0);
});
test("calendar lunar recurrences move with lunar months, not the source Gregorian date", () => {
  const d = day({ date: "2024-02-10", repeat: "yearly", calendar: "lunar" });
  assert.ok(monthOccurrences([d], "2025-01").has("2025-01-29"));
  assert.equal(monthOccurrences([d], "2025-02").size, 0);
  assert.ok(monthOccurrences([d], "2026-02").has("2026-02-17"));
});
test("calendar keeps multiple same-day records and sorts pinned first without mutating data", () => {
  const days = [day(), day({ id: "two", pinned: true })];
  assert.deepEqual(
    monthOccurrences(days, "2024-05")
      .get("2024-05-20")
      .map((d) => d.id),
    ["two", "one"],
  );
  assert.equal(days[0].id, "one");
});
test("calendar retains legacy lunar festival, solar term, zodiac and week detail", () => {
  const spring = calendarDateInfo("2026-02-17");
  assert.equal(spring.lunar, "农历正月初一");
  assert.equal(spring.cellText, "春节");
  assert.ok(spring.festivals.includes("春节"));
  assert.match(spring.ganZhi, /马年/);
  assert.match(spring.week, /^周二 · 第\d+周$/);
  assert.equal(calendarDateInfo("2026-04-05").term, "清明");
});
test("calendar supports the entire stored-date range at both edges", () => {
  for (const date of ["1901-01-01", "2099-12-31"]) {
    assert.ok(calendarDateInfo(date).lunar.startsWith("农历"));
    assert.ok(
      monthOccurrences(
        [day({ date, repeat: "yearly", calendar: "lunar" })],
        date.slice(0, 7),
      ).has(date),
    );
    assert.equal(monthCells(date.slice(0, 7)).filter(Boolean).length, 31);
  }
});
