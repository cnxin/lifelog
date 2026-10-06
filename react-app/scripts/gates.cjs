const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const port = 5189;
const base = `http://127.0.0.1:${port}`;
const directory = path.join(root, '.artifacts/gates');
const suites = ['smoke', 'ui-polish', 'calendar', 'date-picker', 'controls', 'chrome', 'offline', 'baseline', 'css-coverage'];
const reference = require('./gates-reference.json');

// H3's half-time goal measured that refactor, not future feature acceptance.
// Timing stays observable; only actual suite failures determine the exit code.
function timingInformation(durationMs) {
  const timingWarningThresholdSeconds = 180;
  return { timingPolicy: 'informational', timingWarningThresholdSeconds,
    timingWarning: durationMs > timingWarningThresholdSeconds * 1000 };
}

function printTiming(report, logger = console) {
  logger.log(`TOTAL ${(report.durationMs / 1000).toFixed(2)}s; prior eight gates ${report.referenceSeconds ?? 'unmeasured'}s; timing is informational`);
  if (report.timingWarning) logger.warn(`WARNING: gates total exceeds ${report.timingWarningThresholdSeconds}s; timing warning only, exit code unchanged.`);
}

async function requireFreePort() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => reject(new Error(`Port ${port} is occupied or unavailable (${error.code}); gates will not reuse it or choose another port.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function run(name, command, args, environment = {}) {
  const started = performance.now();
  await fs.rm(path.join(directory, name + '.json'), { force: true });
  const log = await fs.open(path.join(directory, name + '.log'), 'w');
  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: root,
        env: { ...process.env, ...environment }, stdio: ['ignore', log.fd, log.fd] });
      const timeout = setTimeout(() => { child.kill('SIGTERM'); }, 180000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timeout); resolve(code ?? signal); });
    });
  } finally { await log.close(); }
  let assertionsPassed = 0;
  let stats = {};
  try { stats = JSON.parse(await fs.readFile(path.join(directory, name + '.json'), 'utf8')); assertionsPassed = stats.assertionsPassed; } catch {}
  const result = { name, exitCode, assertionsPassed, axeAudits: stats.axeInstallRequests || 0,
    axeSourceInjections: stats.axeSourceInjections || 0,
    durationMs: Math.round(performance.now() - started), result: exitCode === 0 ? 'PASS' : 'FAIL' };
  if (name === 'node-unit') {
    const text = await fs.readFile(path.join(directory, name + '.log'), 'utf8');
    result.testsPassed = Number(text.match(/(?:ℹ|#) pass (\d+)/)?.[1] || 0);
  }
  return result;
}

async function fixtureMiddleware(vite) {
  // Only data/kernel fixture imports use this middleware. The UI still loads dist.
  const source = await vite.createServer({ configFile: false, root,
    // Keep optimizer URLs below /node_modules/, one of the fixture routes.
    cacheDir: path.join(root, 'node_modules/.vite/gate-fixtures'),
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { entries: [], noDiscovery: true, include: ['dexie', 'lunar-javascript', '@capacitor/core', 'react', 'lucide-react'] },
  });
  const assets = await fs.readdir(path.join(root, 'dist/assets'));
  const imports = {};
  for (const filename of assets.filter(name => name.endsWith('.js'))) {
    const text = await fs.readFile(path.join(root, 'dist/assets', filename), 'utf8');
    for (const [name, packageName] of [['Haptics', 'haptics'], ['LocalNotifications', 'local-notifications']]) {
      if (new RegExp('as ' + name + '[,}]').test(text)) imports['/assets/' + filename] = '/assets/' + filename + '?__lifelog_fixture=/node_modules/@capacitor/' + packageName + '.js';
    }
  }
  if (Object.keys(imports).length !== 2) {
    await source.close();
    throw new Error('Cannot identify both native plugin chunks for unchanged browser mock routes.');
  }
  const index = (await fs.readFile(path.join(root, 'dist/index.html'), 'utf8'))
    .replace('<head>', '<head><script type="importmap">' + JSON.stringify({ imports }) + '</script>');
  // Alias only module URLs, preserving real compiled bytes and existing test mocks.
  return { source, plugin: {
    name: 'lifelog-gate-fixtures',
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url, base).pathname;
        if (/^\/(?:src\/|node_modules\/|@vite\/|@id\/|@fs\/)/.test(pathname)) return source.middlewares(request, response, next);
        if (pathname === '/' || pathname === '/index.html') {
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(index);
        } else next();
      });
    },
  } };
}

async function main() {
  process.chdir(root);
  const started = performance.now();
  await requireFreePort(); // Fail before tests/build; never kill/reuse an occupied listener.
  await fs.mkdir(directory, { recursive: true });
  await fs.rm(path.join(directory, 'report.json'), { force: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const build = await run('build', npm, ['run', 'build']);
  if (build.exitCode !== 0) throw new Error(`build failed; see ${directory}/build.log`);
  const results = [build];
  const vite = await import('vite');
  let fixture, preview, browserServer, unit;
  const coverageDirectory = path.join(directory, 'coverage');
  await fs.rm(coverageDirectory, { recursive: true, force: true });
  await fs.mkdir(coverageDirectory, { recursive: true });
  try {
    fixture = await fixtureMiddleware(vite);
    preview = await vite.preview({ root, configLoader: 'runner', plugins: [fixture.plugin],
      preview: { host: '127.0.0.1', port, strictPort: true } });
    browserServer = await chromium.launchServer({ headless: true });
    // Unit tests read only sources and isolated fixtures. Their work overlaps
    // initial browser navigation, not the CPU-heavy TypeScript compiler.
    unit = run('node-unit', npm, ['test']);
    let cursor = 0;
    const browserResults = new Array(suites.length);
    // Deterministic FIFO start order, bounded independent contexts, ordered summary.
    const workers = Number(process.env.GATES_WORKERS || 3);
    if (!Number.isInteger(workers) || workers < 1 || workers > 4) throw new Error('GATES_WORKERS must be 1..4');
    await Promise.all(Array.from({ length: workers }, async () => {
      while (cursor < suites.length) {
        const position = cursor++;
        const name = suites[position];
        console.log(`START ${position + 1}/${suites.length} ${name}`);
        const result = await run(name, process.execPath, [path.join(root, 'scripts', name + '.cjs')], {
          BASE_URL: base, GATES_BROWSER_WS: browserServer.wsEndpoint(),
          GATES_STATS_PATH: path.join(directory, name + '.json'),
          CSS_COVERAGE_DIR: coverageDirectory, CSS_COVERAGE_SUITE: name,
          GATES_MEASURE_ONLY: name === 'css-coverage' ? '1' : '',
        });
        browserResults[position] = result;
      }
    }));
    results.unshift(await unit);
    results.push(...browserResults);
    // Some longer suites may finish after the measurement tour. Include their
    // coverage only after every independent context has been closed.
    await require('./css-coverage.cjs').aggregate(coverageDirectory);
  } finally {
    if (unit) await unit;
    if (browserServer) await browserServer.close();
    if (preview) await preview.close();
    if (fixture) await fixture.source.close();
  }
  const durationMs = Math.round(performance.now() - started);
  const referenceSeconds = reference.durationSeconds;
  const report = { completedAt: new Date().toISOString(), port, chromiumProcessesLaunched: 1,
    startOrder: suites, scheduling: `FIFO start order; at most ${process.env.GATES_WORKERS || 3} suites, isolated contexts; summary in fixed suite order.`,
    productUi: 'dist; test-only source fixture endpoints and native module URL aliases; assertions and production bytes unchanged',
    results, durationMs, referenceSeconds,
    ratioToReference: referenceSeconds ? durationMs / (referenceSeconds * 1000) : null,
    ...timingInformation(durationMs) };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  for (const result of results) console.log(`${result.result.padEnd(4)} ${result.name.padEnd(14)} ${String(result.assertionsPassed || result.testsPassed || 0).padStart(4)} assertions/tests  ${(result.durationMs / 1000).toFixed(2)}s`);
  printTiming(report);
  if (results.some(result => result.exitCode !== 0)) throw new Error('One or more gate suites failed; inspect .artifacts/gates/*.log');
}

exports.timingInformation = timingInformation;
exports.printTiming = printTiming;
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
