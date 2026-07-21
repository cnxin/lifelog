const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadUxMetrics() {
  const filePath = path.join(projectRoot, "src", "utils", "uxMetrics.ts");
  const source = fs.readFileSync(filePath, "utf8").replace(
    'import { APP_VERSION } from "../constants/version";',
    'const APP_VERSION = "0.1.0-test.metrics";'
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  new Function("require", "exports", "module", output)(require, module.exports, module);
  return module.exports;
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

global.localStorage = new MemoryStorage();
global.window = { dispatchEvent() {} };
global.Event = class Event { constructor(type) { this.type = type; } };

const metrics = loadUxMetrics();
const failures = [];
const valid = { event: "record_flow", mode: "quick", outcome: "saved", durationMs: 820 };

if (!metrics.validateUxMetricSample(valid)) failures.push("Valid record metric was rejected.");
for (const forbidden of ["query", "title", "personId", "placeId", "url", "photoName"]) {
  if (metrics.validateUxMetricSample({ ...valid, [forbidden]: "sensitive-value" })) {
    failures.push(`Forbidden field was accepted: ${forbidden}`);
  }
}

metrics.recordUxMetric(valid, new Date("2026-01-01T12:00:00.000Z"));
metrics.recordUxMetric(valid, new Date("2026-01-01T13:00:00.000Z"));
metrics.recordUxMetric({ event: "search_flow", resultCount: "1-5", outcome: "selected", durationMs: 4200 }, new Date("2026-01-02T12:00:00.000Z"));

const firstSnapshot = metrics.getUxMetricsSnapshot();
const recordAggregate = firstSnapshot.days[0]?.aggregates.find((item) => item.event === "record_flow");
if (recordAggregate?.count !== 2 || recordAggregate.durationTotalMs !== 1640 || recordAggregate.durationBuckets["under-1s"] !== 2) {
  failures.push(`Unexpected record aggregation: ${JSON.stringify(recordAggregate)}`);
}

for (let day = 0; day < 95; day += 1) {
  metrics.recordUxMetric(
    { event: "home_section", section: "homeLibrary", action: "open" },
    new Date(Date.UTC(2026, 1, day + 1, 12))
  );
}
const retained = metrics.getUxMetricsSnapshot();
if (retained.days.length !== 90) failures.push(`Expected 90 retained days, got ${retained.days.length}.`);

const exported = metrics.exportUxMetricsJson();
for (const sensitive of ["sensitive-value", "query", "title", "personId", "placeId", "photoName"]) {
  if (exported.includes(sensitive)) failures.push(`Export leaked forbidden content: ${sensitive}`);
}

metrics.clearUxMetrics();
if (metrics.getUxMetricsSummary().totalSamples !== 0) failures.push("Metrics were not cleared.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("UX metrics regression passed: strict schema, aggregation, retention, export, and clear.");
