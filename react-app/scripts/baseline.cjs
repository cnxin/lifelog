// Immutable alpha.8 evidence. Capture is explicit; verify never rewrites a baseline.
const { chromium } = require("./lib/browser.cjs");
const { assert } = require("./lib/browser.cjs");
const fs = require('node:fs/promises');
const path = require('node:path');
const { isDeepStrictEqual, inspect } = require('node:util');

const selectors = [
  'body', '.site-header', '.header-inner', '.brand', '.brand-icon', '.brand-label',
  '.brand-cn', '.brand-caption', '.header-actions', '.header-backup', '.header-add',
  '.app-shell', 'main', '.page-heading', '.heading-date', '.subtitle', '.overview',
  '.hero', '.hero-kicker', '.hero-link', '.hero-count', '.hero-caption', '.hero-bottom',
  '.overview-side', '.summary-card', '.summary-title', '.little-note', '.days-section',
  '.section-heading', '.toolbar', '.filters', '.filters button', '.search-toggle',
  '.search', '.search input', '.sort-button', '.sort-menu', '[role="menuitemradio"]',
  '.day-grid', '.day-card', '.card-main', '.card-category', '.card-count', '.card-date',
  '.pin-button', '.modal', '.modal-heading', '.modal-body', '.modal-heading button',
  '.editor-modal', '.editor-fields', '.editor-fields input', '.editor-fields textarea', '.date-field',
  '.date-trigger', '.date-picker', '.calendar-grid', '.calendar-modal', '.detail-modal',
  '.data-actions',
];
const properties = ['color', 'background-color', 'border-color', 'font-size', 'font-weight',
  'line-height', 'padding', 'margin', 'border-radius', 'box-shadow', 'opacity', 'transform'];
assert.equal(selectors.length, 60);
assert.equal(properties.length, 12);
const fixtures = [
  { id: 'baseline-anniversary', title: '我们在一起的日子', date: '2020-05-20', category: '纪念日',
    repeat: 'yearly', calendar: 'solar', note: '一起走过的路，都值得记得。', pinned: true, reminders: [] },
  { id: 'baseline-birthday', title: '妈妈的生日', date: '1970-09-30', category: '生日',
    repeat: 'yearly', calendar: 'lunar', note: '记得订蛋糕', pinned: false, reminders: [] },
  { id: 'baseline-countdown', title: '第一次独自出发', date: '2023-08-12', category: '倒数日',
    repeat: 'none', calendar: 'solar', note: '旅途中的光', pinned: false, reminders: [] },
];
const states = ['home', 'search', 'sort', 'detail', 'editor-date', 'calendar', 'data'];
const viewports = [{ width: 360, height: 740 }, { width: 1024, height: 768 }];

async function seed(page) {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5188');
  await page.getByRole('button', { name: '新增日子', exact: true }).waitFor();
  await page.evaluate(async days => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('LifeLogDays');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('days', 'readwrite');
      const store = tx.objectStore('days');
      store.clear();
      for (const day of days) store.put(day);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, fixtures);
  await page.reload();
  await page.locator('.day-card').first().waitFor();
}

async function openState(page, state) {
  const button = name => page.getByRole('button', { name, exact: true });
  if (state === 'search') {
    const toggle = page.locator('.search-toggle');
    if (await toggle.isVisible()) await toggle.click();
    else await page.getByLabel('搜索日子').focus();
  }
  if (state === 'sort') await page.locator('.sort-button').click();
  if (state === 'detail' || state === 'editor-date') {
    await page.locator('.day-grid').getByRole('button', { name: '查看：我们在一起的日子', exact: true }).click();
    if (state === 'editor-date') {
      await button('编辑').click();
      await page.locator('.date-trigger').click();
      await page.locator('.date-picker').waitFor();
    }
  }
  if (state === 'calendar') await button('打开日历').click();
  if (state === 'data') await button('数据与备份').click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function snapshot(page) {
  return page.evaluate(({ selectors, properties }) => {
    // Normalize unstable identifiers and Vite's transport-only module loader.
    // Vite moves the loader into <head> in production and adds HMR timestamps in dev.
    // No product element, product attribute, text, geometry or computed style is omitted.
    const clone = document.body.cloneNode(true);
    for (const loader of clone.querySelectorAll('script[type="module"][src]')) loader.remove();
    const ids = new Map();
    const normalizeId = value => value.replace(/«r[\da-z]+»|:r[\da-z]+:|_r_[\da-z]+_/g, match => {
      if (!ids.has(match)) ids.set(match, `react-id-${ids.size + 1}`);
      return ids.get(match);
    });
    for (const element of clone.querySelectorAll('*')) {
      for (const name of ['id', 'name', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
        if (element.hasAttribute(name)) element.setAttribute(name, normalizeId(element.getAttribute(name)));
      }
      if (element.hasAttribute('style')) {
        element.style.removeProperty('--drag-y');
        const transition = element.style.getPropertyValue('view-transition-name');
        if (transition) element.style.setProperty('view-transition-name', transition.replace(/day-[\w-]+/, 'day-id'));
        if (!element.getAttribute('style')) element.removeAttribute('style');
      }
    }
    const rect = element => {
      const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
      return { x, y, width, height, top, right, bottom, left };
    };
    return {
      html: clone.innerHTML.trim(),
      styles: Object.fromEntries(selectors.map(selector => [selector, [...document.querySelectorAll(selector)]
        .map(element => Object.fromEntries(properties.map(property => [property, getComputedStyle(element).getPropertyValue(property)])))])),
      clickable: [...document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [role="menuitemradio"], [role="radio"], [tabindex="0"]')]
        .map(element => ({ tag: element.tagName, role: element.getAttribute('role'), className: element.className,
          label: element.getAttribute('aria-label') || element.textContent, rect: rect(element) })),
    };
  }, { selectors, properties });
}

function differences(expected, actual, location = '$', output = []) {
  if (isDeepStrictEqual(expected, actual)) return output;
  if (typeof expected === 'string' && typeof actual === 'string') {
    let start = 0, end = 0;
    while (start < expected.length && start < actual.length && expected[start] === actual[start]) start++;
    while (end < expected.length - start && end < actual.length - start &&
      expected[expected.length - end - 1] === actual[actual.length - end - 1]) end++;
    output.push(`${location} @ character ${start}\n- ${inspect(expected.slice(start, expected.length - end), { maxStringLength: null })}\n+ ${inspect(actual.slice(start, actual.length - end), { maxStringLength: null })}`);
  } else if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      differences(expected[key], actual[key], `${location}.${key}`, output);
    }
  } else output.push(`${location}\n- ${inspect(expected, { maxStringLength: 1000 })}\n+ ${inspect(actual, { maxStringLength: 1000 })}`);
  return output;
}

async function runBaseline(browser, { capture = false, scheme = 'light', screenshotDir } = {}) {
  const directory = path.resolve('.artifacts/baseline', scheme);
  if (capture) await fs.mkdir(directory, { recursive: true });
  let count = 0;
  for (const viewport of viewports) for (const state of states) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', colorScheme: scheme });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      await openState(page, state);
      const actual = await snapshot(page);
      assert.deepEqual(errors, [], `${state} browser errors`);
      const name = `${viewport.width}x${viewport.height}-${state}`;
      const file = path.join(directory, name + '.json');
      if (capture) await fs.writeFile(file, JSON.stringify(actual, null, 2) + '\n');
      else {
        const expected = JSON.parse(await fs.readFile(file, 'utf8'));
        const diff = differences(expected, actual);
        assert.equal(diff.length, 0, `${name}: ${diff.length} differences\n${diff.join('\n')}`);
      }
      if (screenshotDir) {
        await fs.mkdir(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, name + '.png'), fullPage: true });
      }
      count++;
    } finally { await context.close(); }
  }
  console.log(`PASS: baseline ${capture ? 'capture' : 'verify'} ${count} ${scheme} states, 60 selectors × 12 properties + DOM + clickable geometry.`);
  return count;
}

exports.runBaseline = runBaseline;
exports.fixtures = fixtures;
exports.openState = openState;
exports.seed = seed;
exports.selectors = selectors;
if (require.main === module) (async () => {
  const browser = await chromium.launch();
  try { await runBaseline(browser, { capture: process.argv.includes('--capture'),
    scheme: process.argv.includes('--scheme') ? process.argv[process.argv.indexOf('--scheme') + 1] : 'light' }); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
