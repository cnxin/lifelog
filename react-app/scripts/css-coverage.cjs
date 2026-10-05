const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const postcss = require('postcss');
const { readStyles } = require('./lib/styles.cjs');
const { instrumentBrowser } = require('./lib/css-coverage.cjs');
const { seed, openState } = require('./baseline.cjs');

const suites = ['smoke', 'ui-polish', 'calendar', 'date-picker', 'controls', 'chrome', 'baseline'];
const normalize = selector => selector.replace(/\s+/g, ' ').replace(/\s*([>,+~])\s*/g, '$1').trim();
async function measureTour(browser) {
  for (const width of [360, 1024]) for (const media of [
    { reducedMotion: 'reduce', forcedColors: 'none' },
    { reducedMotion: 'reduce', forcedColors: 'active' },
    { reducedMotion: 'no-preference', forcedColors: 'none' },
  ]) for (const state of ['home', 'search', 'sort', 'detail', 'editor-date', 'calendar', 'data']) {
    const context = await browser.newContext({ viewport: { width, height: width === 360 ? 740 : 768 }, timezoneId: 'Asia/Shanghai', ...media });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      await openState(page, state);
      await page.waitForTimeout(media.reducedMotion === 'reduce' ? 0 : 300);
    } finally { await context.close(); }
  }
  return 42;
}

async function aggregate(directory, source = 'src/styles/index.css') {
  const hitSelectors = new Set();
  let sheets = 0, pageRecords = 0;
  for (const filename of await fs.readdir(directory)) {
    if (!filename.endsWith('.json')) continue;
    pageRecords++;
    for (const entry of JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'))) {
      sheets++;
      const css = postcss.parse(entry.text);
      css.walkRules(rule => {
        const start = rule.source.start.offset, end = rule.source.end.offset;
        if (entry.ranges.some(range => range.start < end && range.end > start))
          for (const selector of rule.selectors) hitSelectors.add(normalize(selector));
      });
    }
  }
  if (!sheets) throw new Error('No CSS coverage entries; refuse to infer unused rules.');
  const sourceFiles = [];
  function collect(file) {
    const text = require('node:fs').readFileSync(file, 'utf8');
    const imports = [...text.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)];
    if (imports.length) for (const item of imports) collect(path.resolve(path.dirname(file), item[1]));
    else sourceFiles.push({ file, text });
  }
  collect(path.resolve(source));
  const unused = [];
  let ruleCount = 0;
  for (const { file, text } of sourceFiles) postcss.parse(text).walkRules(rule => {
    ruleCount++;
    if (rule.selectors.some(selector => hitSelectors.has(normalize(selector)))) return;
    const conditions = [];
    for (let parent = rule.parent; parent; parent = parent.parent)
      if (parent.type === 'atrule') conditions.unshift('@' + parent.name + ' ' + parent.params);
    unused.push({ file: path.relative(process.cwd(), file), line: rule.source.start.line, selector: rule.selector, conditions,
      protectedMedia: conditions.some(condition => /forced-colors|prefers-contrast|prefers-reduced-transparency/.test(condition)),
      coverage: 0 });
  });
  const report = { measuredAt: new Date().toISOString(), source, ruleCount, pageRecords, sheets,
    suites: [...suites, 'offline'], supplementalTourStates: 42,
    aggregationNote: 'Conservative union of selectors hit in any context. Repeated selectors are retained if any occurrence was hit; unhit does not imply safe deletion.',
    unused };
  await fs.writeFile('.artifacts/css-unused.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS: CSS measurement only: ${pageRecords} page records, ${sheets} sheets, ${unused.length}/${ruleCount} conservatively unhit rules; no coverage threshold.`);
  return report;
}

async function child(suite, directory) {
  const base = suite === 'offline' ? (process.env.PREVIEW_URL || 'http://127.0.0.1:5189') : (process.env.BASE_URL || 'http://127.0.0.1:5188');
  const log = await fs.open(path.join(directory, suite + '.log'), 'w');
  try {
    await new Promise((resolve, reject) => {
      const processChild = spawn(process.execPath, [path.resolve('scripts', suite + '.cjs')], {
        env: { ...process.env, BASE_URL: base, CSS_COVERAGE_DIR: directory, CSS_COVERAGE_SUITE: suite,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${path.resolve('scripts/lib/coverage-preload.cjs')}` },
        stdio: ['ignore', log.fd, log.fd],
      });
      processChild.on('error', reject);
      processChild.on('exit', code => code === 0 ? resolve() : reject(new Error(`${suite} coverage run failed (${code}); see ${directory}/${suite}.log`)));
    });
  } finally { await log.close(); }
}

exports.measureTour = measureTour;
exports.aggregate = aggregate;
if (require.main === module) (async () => {
  const index = process.argv.indexOf('--source');
  const source = index >= 0 ? process.argv[index + 1] : 'src/styles/index.css';
  const directory = path.resolve('.artifacts/css-coverage/raw');
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
  for (const suite of [...suites, 'offline']) await child(suite, directory);
  const browser = await instrumentBrowser(await chromium.launch(), directory);
  try { await measureTour(browser); } finally { await browser.close(); }
  await aggregate(directory, source);
})().catch(error => { console.error(error); process.exitCode = 1; });
