const real = require('playwright');
const strict = require('node:assert/strict');
const fs = require('node:fs');
const { instrumentBrowser } = require('./css-coverage.cjs');
let passed = 0;
let axeSource, axeInstallRequests = 0, axeSourceInjections = 0;
const axeVersion = require('axe-core/package.json').version;
const methods = new Map();
const count = result => {
  if (result && typeof result.then === 'function') return result.then(value => { passed++; return value; });
  passed++;
  return result;
};

// Forward exactly to Node's strict assertions. Counting never catches a failure.
const assert = new Proxy(strict, {
  apply(target, receiver, args) { return count(Reflect.apply(target, receiver, args)); },
  get(target, key) {
    const value = Reflect.get(target, key);
    if (typeof value !== 'function' || key === 'AssertionError') return value;
    if (!methods.has(key)) methods.set(key, (...args) => count(Reflect.apply(value, target, args)));
    return methods.get(key);
  },
});

const chromium = {
  async launch(options) {
    const browser = process.env.GATES_BROWSER_WS
      ? await real.chromium.connect(process.env.GATES_BROWSER_WS)
      : await real.chromium.launch(options);
    return process.env.CSS_COVERAGE_DIR ? instrumentBrowser(browser, process.env.CSS_COVERAGE_DIR) : browser;
  },
};

// Keep every audit/run/options/assertion at its original call site. Loading
// the same library again into an unchanged document is redundant; navigation
// creates a new window and naturally requires reinjection. No scan is cached.
async function installAxe(page) {
  axeInstallRequests++;
  if (await page.evaluate(() => window.axe?.version) === axeVersion) return;
  axeSource ??= fs.readFileSync(require.resolve('axe-core'), 'utf8');
  await page.evaluate(axeSource);
  axeSourceInjections++;
}

process.on('exit', code => {
  if (process.env.GATES_STATS_PATH) fs.writeFileSync(process.env.GATES_STATS_PATH,
    JSON.stringify({ assertionsPassed: passed, axeInstallRequests, axeSourceInjections, exitCode: code }));
});

exports.chromium = chromium;
exports.assert = assert;
exports.installAxe = installAxe;
