// A separate dark round: existing light assertions and both baseline sets stay intact.
const { chromium, assert, installAxe } = require('./lib/browser.cjs');
const baseline = require('./baseline.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const directory = path.resolve('.artifacts/dark');
const audits = [];

async function audit(page, label) {
  await installAxe(page);
  const violations = await page.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  audits.push({ label, violations });
  assert.deepEqual(violations, [], label + ' dark axe including color-contrast');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' page overflow');
  assert.ok(await page.locator('dialog[open]').evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth + 1)), label + ' dialog overflow');
}

async function stateTour(browser) {
  for (const viewport of baseline.viewports) for (const state of baseline.states) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', colorScheme: 'dark' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await baseline.seed(page); await baseline.openState(page, state);
      const name = `${viewport.width}x${viewport.height}-${state}`;
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(21, 25, 26)');
      await audit(page, name);
      // Flush the first compositor capture before saving masked/scrolling chips.
      // This changes no product state, comparison or existing animation timer.
      await page.screenshot({ fullPage: true });
      await page.screenshot({ path: path.join(directory, name + '.png'), fullPage: true });
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const expected = JSON.parse(await fs.readFile(path.join('.artifacts/baseline', scheme, name + '.json'), 'utf8'));
        const actual = await baseline.snapshot(page);
        const diff = baseline.differences(expected, actual);
        assert.equal(diff.length, 0, `${name}: live switch to ${scheme}, ${diff.join('\n')}`);
      }
      assert.deepEqual(errors, [], name + ' browser errors');
    } finally { await context.close(); }
  }
}

async function lunarTour(browser) {
  for (const viewport of baseline.viewports) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Shanghai', colorScheme: 'dark', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await baseline.seed(page);
      await page.locator('.day-grid').getByRole('button', { name: '查看：妈妈的生日', exact: true }).click();
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await page.locator('.date-trigger').click(); await page.locator('.lunar-grid').waitFor();
      await page.getByLabel('年份', { exact: true }).fill('2025');
      await page.getByRole('button', { name: '闰六月', exact: true }).click();
      await audit(page, `${viewport.width} lunar leap-month editor`);
      await page.screenshot({ path: path.join(directory, `${viewport.width}-lunar.png`), fullPage: true });
      await page.getByRole('group', { name: '日期录入历法', exact: true }).getByRole('radio', { name: '公历', exact: true }).check();
      await page.getByRole('button', { name: '切换年月', exact: true }).click();
      await page.getByLabel('年份', { exact: true }).focus();
      await audit(page, `${viewport.width} month/year editor`);
      assert.equal(await page.getByLabel('年份', { exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.match(await page.getByLabel('年份', { exact: true }).evaluate(el => getComputedStyle(el).boxShadow), /rgb\(181, 205, 166\) 0px 0px 0px 2px/);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
}

async function particleTour(browser) {
  for (const [tone, category] of [['rose', '纪念日'], ['amber', '生日'], ['sage', '倒数日']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 740 }, timezoneId: 'Asia/Shanghai', colorScheme: 'dark', reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-05-20T12:00:00+08:00'));
      await page.addInitScript(() => {
        window.__particleColors = [];
        const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillStyle', { ...descriptor, set(value) {
          descriptor.set.call(this, value); window.__particleColors.push(descriptor.get.call(this));
        } });
      });
      await baseline.seed(page);
      await page.evaluate(async category => {
        const db = await new Promise(resolve => { const request = indexedDB.open('LifeLogDays'); request.onsuccess = () => resolve(request.result); });
        await new Promise((resolve, reject) => {
          const tx = db.transaction('days', 'readwrite'), store = tx.objectStore('days');
          store.clear(); store.put({ id: 'dark-particles', title: '今天值得庆祝', date: '2020-05-20', category, calendar: 'solar', repeat: 'yearly', pinned: true, note: '', reminders: [] });
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
        });
        db.close(); localStorage.removeItem('lifelog-days:celebrated');
      }, category);
      await page.reload(); const canvas = page.locator('.celebration-canvas'); await canvas.waitFor();
      const checkPaint = async scheme => {
        const foreground = await page.evaluate(tone => getComputedStyle(document.documentElement).getPropertyValue(`--${tone}-fg`).trim(), tone);
        await page.waitForFunction(color => window.__particleColors.includes(color.toLowerCase()), foreground);
        // Only sample frames after the new primary has actually been painted.
        // CSS/media dispatch can leave old-theme frames in the historical log.
        await page.evaluate(() => { window.__particleColors = []; });
        await page.waitForFunction(() => window.__particleColors.length > 0);
        const painted = await page.evaluate(tone => {
          const css = getComputedStyle(document.documentElement), main = css.getPropertyValue(`--${tone}-fg`).trim();
          const channels = main.slice(1).match(/../g).map(c => parseInt(c, 16));
          const mix = (target, amount) => '#' + channels.map(c => Math.round(c + (target - c) * amount).toString(16).padStart(2, '0')).join('');
          return { actual: [...new Set(window.__particleColors)], allowed: [main, mix(255, .2), mix(0, .15), css.getPropertyValue('--confetti-cream').trim()].map(c => c.toLowerCase()) };
        }, tone);
        assert.ok(painted.actual.length > 0, tone + ' ' + scheme + ' paints particles');
        assert.ok(painted.actual.every(c => painted.allowed.includes(c)), tone + ' ' + scheme + ' palette matches current tokens: ' + JSON.stringify(painted));
      };
      await checkPaint('dark');
      await page.evaluate(() => { window.__particleColors = []; });
      await page.emulateMedia({ colorScheme: 'light' });
      // Discard any already queued paint before the media change callback, then
      // inspect subsequent real frames; the animation duration is never mocked.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { window.__particleColors = []; resolve(); })));
      await checkPaint('light');
      assert.equal(await canvas.count(), 1, 'an in-flight celebration survives a theme switch');
      await page.emulateMedia({ reducedMotion: 'reduce' }); await canvas.waitFor({ state: 'hidden' });
      assert.equal(await canvas.count(), 0, 'reduced motion still cancels the directly painted effect');
    } finally { await context.close(); }
  }
}

(async () => {
  await fs.mkdir(directory, { recursive: true });
  const browser = await chromium.launch();
  try {
    await stateTour(browser); await lunarTour(browser); await particleTour(browser);
    // Reuse, without editing any assertion, the complete native reminder and
    // celebration checks in additional isolated dark contexts.
    const darkBrowser = {
      newPage: options => browser.newPage({ ...options, colorScheme: 'dark' }),
      newContext: options => browser.newContext({ ...options, colorScheme: 'dark' }),
    };
    await require('./reminders-ui.cjs').checkReminderUI(darkBrowser);
    await require('./celebrate-ui.cjs').checkCelebrationUI(darkBrowser);
    console.log('PASS: 14 dark state screenshots/axe audits, live light/dark baseline matches, lunar/year panels, 3 compiled celebration palettes, native reminders and reduced motion.');
  } finally {
    await browser.close();
    await fs.writeFile(path.join(directory, 'audits.json'), JSON.stringify(audits, null, 2) + '\n');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
