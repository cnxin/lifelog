const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { Solar, Lunar } = require("lunar-javascript");
const compiled = ts.transpileModule(fs.readFileSync("src/domain.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const domainModule = { exports: {} };
new Function("require", "exports", "module", compiled)(
  require,
  domainModule.exports,
  domainModule,
);
const {
  todayKey,
  validDate,
  dayDiff,
  nextOccurrence,
  dayStatus,
  compareDays,
  validateDay,
  parseBackup,
  makeBackup,
  extractLegacy,
} = domainModule.exports;
const day = (patch = {}) => ({
  id: "one",
  title: "在一起",
  date: "2024-05-20",
  category: "纪念日",
  repeat: "none",
  calendar: "solar",
  note: "",
  pinned: false,
  reminders: [],
  ...patch,
});

test("strict Gregorian validation rejects overflow and unsupported years", () => {
  for (const date of [
    "2025-02-29",
    "2024-04-31",
    "2026-1-01",
    "1899-12-31",
    "2100-01-01",
    "",
    null,
  ])
    assert.equal(validDate(date), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("today uses local calendar, not UTC date", () =>
  assert.equal(todayKey(new Date(2026, 8, 29, 0, 1)), "2026-09-29"));
test("DST and year transitions count calendar days", () => {
  assert.equal(dayDiff("2026-03-07", "2026-03-09"), 2);
  assert.equal(dayDiff("2026-10-31", "2026-11-02"), 2);
  assert.equal(dayDiff("2025-12-31", "2026-01-01"), 1);
});
test("past dates show elapsed days; future dates show countdown", () => {
  assert.deepEqual(dayStatus(day(), "2024-05-21"), {
    next: "2024-05-20",
    delta: -1,
    count: 1,
    label: "已经",
    elapsed: 1,
  });
  assert.equal(dayStatus(day(), "2024-05-19").label, "还有");
  assert.equal(dayStatus(day(), "2024-05-20").label, "就是今天");
});
test("annual rollover includes today", () => {
  const d = day({ repeat: "yearly" });
  assert.equal(nextOccurrence(d, "2026-05-20"), "2026-05-20");
  assert.equal(nextOccurrence(d, "2026-05-21"), "2027-05-20");
});
test("future annual start never repeats before its first occurrence", () =>
  assert.equal(
    nextOccurrence(day({ date: "2028-05-20", repeat: "yearly" }), "2026-01-01"),
    "2028-05-20",
  ));
test("Feb 29 clamps in common years and returns in leap years", () => {
  const d = day({ date: "2024-02-29", repeat: "yearly" });
  assert.equal(nextOccurrence(d, "2025-02-28"), "2025-02-28");
  assert.equal(nextOccurrence(d, "2025-03-01"), "2026-02-28");
  assert.equal(nextOccurrence(d, "2028-01-01"), "2028-02-29");
});
test("lunar New Year repeats in lunar calendar", () => {
  const d = day({ date: "2024-02-10", repeat: "yearly", calendar: "lunar" });
  assert.equal(nextOccurrence(d, "2025-01-01"), "2025-01-29");
  assert.equal(nextOccurrence(d, "2025-01-29"), "2025-01-29");
  assert.equal(nextOccurrence(d, "2025-01-30"), "2026-02-17");
});
test("lunar leap month falls back to regular month when absent", () => {
  const d = day({ date: "2023-03-22", repeat: "yearly", calendar: "lunar" });
  const next = nextOccurrence(d, "2024-01-01");
  assert.equal(next, Lunar.fromYmd(2024, 2, 1).getSolar().toYmd());
});
test("lunar last month can occur in following Gregorian year", () => {
  const source = Lunar.fromYmd(2023, 12, 8).getSolar().toYmd();
  const d = day({ date: source, repeat: "yearly", calendar: "lunar" });
  assert.equal(
    nextOccurrence(d, "2025-01-01"),
    Lunar.fromYmd(2024, 12, 8).getSolar().toYmd(),
  );
});
test("short lunar month clamps day 30 to 29", () => {
  const source = Lunar.fromYmd(2023, 12, 30).getSolar().toYmd();
  const d = day({ date: source, repeat: "yearly", calendar: "lunar" });
  const next = nextOccurrence(d, "2025-01-01");
  const [y, m, date] = next.split("-").map(Number);
  assert.equal(Solar.fromYmd(y, m, date).getLunar().getDay(), 29);
});
test("pinned first, then nearest upcoming, then most recent elapsed", () => {
  const list = [
    day({ id: "past", date: "2020-01-01" }),
    day({ id: "future", date: "2026-10-01" }),
    day({ id: "pin", pinned: true }),
    day({ id: "today", date: "2026-09-29" }),
  ];
  assert.deepEqual(
    list.sort((a, b) => compareDays(a, b, "2026-09-29")).map((x) => x.id),
    ["pin", "today", "future", "past"],
  );
});
test("backup roundtrip preserves every field", () =>
  assert.deepEqual(parseBackup(makeBackup([day()])).days, [day()]));
test("new backups reject duplicates, invalid entries and unknown versions atomically", () => {
  assert.throws(() => parseBackup(makeBackup([day(), day()])));
  assert.throws(() =>
    parseBackup(makeBackup([day(), day({ id: "bad", date: "oops" })])),
  );
  assert.throws(() => parseBackup({ ...makeBackup([]), version: 2 }));
  assert.throws(() => validateDay(day({ calendar: "lunar", repeat: "none" })));
  assert.throws(() => validateDay(day({ title: "  " })));
});
test("legacy people migrate birthdays and anniversaries with stable IDs", () => {
  const people = [
    {
      id: "p",
      name: "小林",
      birthday: "1998-08-01",
      favorite: true,
      anniversaries: [
        { title: "初次相遇", date: "2024-05-20" },
        { title: "坏日期", date: "2025-02-30" },
      ],
    },
  ];
  const result = parseBackup({
    schemaVersion: 3,
    data: { people, memories: [{}], places: [{}] },
  });
  assert.equal(result.days.length, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.legacy, true);
  assert.equal(result.days[0].title, "小林的生日");
  assert.equal(result.days[0].pinned, true);
  assert.deepEqual(result.days, extractLegacy({ people }).days);
  assert.deepEqual(extractLegacy({ state: { people } }).days, result.days);
});
test("invalid legacy structures are rejected or skipped without inventing dates", () => {
  assert.throws(() => parseBackup({ hello: "world" }));
  assert.equal(
    extractLegacy({ people: [null, { birthday: "2025-02-30" }] }).skipped,
    2,
  );
});
