const fs = require('node:fs/promises');
const { assert, installAxe } = require('./lib/browser.cjs');
const { seed } = require('./baseline.cjs');

exports.checkTapHighlight = async function (browser) {
  const results = [];
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 740 },
      hasTouch: true, isMobile: true, colorScheme: scheme,
      reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai',
    });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
      const targets = [];
      const check = async (locator, label) => {
        assert.ok(await locator.count() > 0, `${scheme}: ${label} exists`);
        const first = locator.first();
        await first.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true });
        const highlights = await locator.evaluateAll(elements => elements.map(element =>
          [null, '::before', '::after'].map(pseudo =>
            getComputedStyle(element, pseudo).getPropertyValue('-webkit-tap-highlight-color'))));
        for (const values of highlights)
          assert.deepEqual(values, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
            `${scheme}: ${label} and pseudo-elements have transparent touch highlight`);
        await first.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
        targets.push({ label, count: highlights.length, highlights });
      };
      const audit = async label => {
        await installAxe(page);
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
        assert.deepEqual(violations, [], `${scheme}: ${label}`);
      };
      await page.getByRole('button', { name: '新增日子', exact: true }).click();
      const repeat = page.getByRole('checkbox', { name: '每年重复', exact: true });
      await repeat.check();
      const row = page.locator('.check-row').filter({ has: repeat });
      await check(page.locator('.check-row'), 'checkbox labels after touch pointerdown');
      await check(page.locator('.choice-option'), 'category/calendar segmented labels');
      const geometry = await row.evaluate(element => {
        const css = getComputedStyle(element);
        return { radius: css.borderRadius, margin: css.marginInline, padding: css.paddingInline,
          duration: css.transitionDuration, height: element.getBoundingClientRect().height };
      });
      assert.equal(geometry.radius, '12px');
      assert.equal(geometry.margin, '-8px');
      assert.equal(geometry.padding, '8px');
      assert.equal(geometry.duration, '0s', 'reduced motion removes row transition');
      assert.ok(geometry.height >= 48, 'row touch height is not reduced');

      await row.scrollIntoViewIfNeeded();
      const bounds = await row.boundingBox();
      await page.mouse.move(bounds.x + 24, bounds.y + 16);
      await page.mouse.down();
      assert.equal(await row.evaluate(el => el.matches(':active')), true, 'real pointer press activates the label');
      assert.match(await row.evaluate(el => getComputedStyle(el).backgroundColor), /\/ 0\.08\)/,
        'pressed row uses the eight-percent theme-token wash');
      await page.mouse.up();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.equal(await row.evaluate(el => getComputedStyle(el).transitionDuration), '0.16s');
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.keyboard.press('Tab');
      await repeat.focus();
      const focus = await repeat.evaluate(element => {
        const css = getComputedStyle(element), surface = getComputedStyle(element.closest('.modal')).backgroundColor;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const pixel = color => {
          context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const luminance = rgb => {
          const c = rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
        };
        const solid = getComputedStyle(document.documentElement).getPropertyValue('--input-focus-ring').trim();
        const levels = [luminance(pixel(solid)), luminance(pixel(surface))].sort((a, b) => a - b);
        return { visible: element.matches(':focus-visible'), outline: css.outlineStyle, shadow: css.boxShadow,
          surface, solid, contrast: (levels[1] + .05) / (levels[0] + .05) };
      });
      assert.equal(focus.visible, true, 'keyboard focus reaches the checkbox');
      assert.equal(focus.outline, 'none', 'no doubled normal-mode outline');
      assert.match(focus.shadow, /0px 0px 0px 2px/);
      assert.match(focus.shadow, /\/ 0\.35\) 0px 0px 0px 3px/);
      assert.ok(focus.contrast >= 3, 'C4 solid inner focus ring has at least 3:1 surface contrast');
      await audit('touch editor and focused checkbox accessibility');
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal(await repeat.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      assert.equal(await repeat.evaluate(el => getComputedStyle(el).outlineWidth), '2px');
      await page.emulateMedia({ forcedColors: 'none' });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '打开日历', exact: true }).click();
      await check(page.locator('.calendar-day'), 'calendar dates');
      await page.locator('.calendar-day[aria-label*="个日子："]').first().click();
      await check(page.locator('.calendar-event'), 'calendar events');
      await check(page.locator('.calendar-events li'), 'event list containers');
      await audit('touch calendar accessibility');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '排序方式', exact: true }).click();
      await check(page.locator('.sort-menu [role="menuitemradio"]'), 'sort menu items');
      await audit('touch sort-menu accessibility');
      assert.deepEqual(errors, []);
      results.push({ scheme, geometry, focus, targets });
    } finally { await context.close(); }
  }
  await fs.mkdir('.artifacts', { recursive: true });
  await fs.writeFile('.artifacts/tap-highlight-controls.json', JSON.stringify(results, null, 2) + '\n');
};
