// K4: real rendered geometry and interactions; these checks also run in gates.
const { assert, installAxe } = require('./lib/browser.cjs');
const { seed } = require('./baseline.cjs');

module.exports = async function checkToolbarSearch(browser) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 },
      hasTouch: true, isMobile: true, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      const toggle = page.locator('.search-toggle'), row = page.locator('.toolbar-row');
      const input = page.getByRole('searchbox', { name: '搜索日子', exact: true });
      const original = await row.boundingBox();
      assert.equal(await page.locator('.toolbar-search').count(), 0, 'closed search row is unmounted');
      await toggle.click();
      await input.waitFor();
      assert.ok(await input.evaluate(el => el === document.activeElement), 'open focuses input');
      const geometry = await page.evaluate(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        return { search: box('.toolbar-search'), row: box('.toolbar-row'), toolbar: box('.toolbar'), card: box('.day-card') };
      });
      assert.ok(geometry.search.height >= 44 && geometry.row.height >= 44, 'both rows are visible');
      assert.ok(geometry.search.bottom <= geometry.row.y, 'search and chip row do not overlap');
      assert.equal(geometry.search.x, geometry.row.x, 'two rows align horizontally');
      assert.equal(geometry.search.width, geometry.row.width, 'search fills its own row');
      assert.ok(geometry.toolbar.bottom <= geometry.card.y, 'expanded toolbar does not cover first card');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      const activeColors = await toggle.evaluate(el => {
        const css = getComputedStyle(el), sort = getComputedStyle(document.querySelector('.sort-button'));
        return [css.backgroundColor, sort.backgroundColor, css.color, sort.color];
      });
      assert.equal(activeColors[0], activeColors[1], 'active search uses selected control background');
      assert.equal(activeColors[2], activeColors[3], 'active search uses green icon color');
      assert.equal(await page.locator('.list-tools .search').count(), 0, 'mobile search is not inside action row');
      const anniversary = page.locator('.toolbar .filters').getByRole('button', { name: '纪念日', exact: true });
      await anniversary.click();
      assert.equal(await anniversary.getAttribute('aria-pressed'), 'true', 'chip still selects while search is open');
      assert.equal(await page.locator('.day-card').count(), 1, 'anniversary chip actually filters records');
      assert.match(await page.locator('.day-card').innerText(), /我们在一起的日子/);
      const last = page.locator('.toolbar .filters button').last();
      await last.scrollIntoViewIfNeeded();
      const lastBox = await last.boundingBox(), strip = await page.locator('.toolbar .filters').boundingBox();
      assert.ok(lastBox.x >= strip.x && lastBox.x + lastBox.width <= strip.x + strip.width, 'chips still scroll to the last category');
      await anniversary.click();
      await input.fill('不存在的日子');
      await page.locator('.no-results').waitFor();
      assert.equal(await page.locator('.toolbar-search').isVisible(), true, 'nonempty query keeps search row open');
      await page.getByRole('button', { name: '清除搜索', exact: true }).click();
      await page.locator('.toolbar-search').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('.search-toggle'));
      assert.equal((await row.boundingBox()).y, original.y, 'X restores original chip row y');
      assert.equal(await page.locator('.day-card').count(), 1, 'X clears query but keeps category');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.click();
      assert.equal(await input.inputValue(), '', 'X cleared query');
      await input.fill('一起');
      await input.press('Escape');
      await page.locator('.toolbar-search').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('.search-toggle'));
      assert.equal((await row.boundingBox()).y, original.y, 'Escape with query restores original row y');
      await toggle.click();
      assert.equal(await input.inputValue(), '', 'Escape clears nonempty query');
      await input.fill('一起');
      await toggle.click();
      await page.locator('.toolbar-search').waitFor({ state: 'detached' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'toggle closes an expanded search');
      await toggle.click();
      assert.equal(await input.inputValue(), '', 'toggle close also clears query');
      const motion = await page.locator('.toolbar-search').evaluate(el => getComputedStyle(el).transitionDuration);
      assert.ok(motion.split(',').every(v => parseFloat(v) === 0), 'reduced motion disables search transition');
      await installAxe(page);
      const violations = await page.evaluate(async () => (await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
      })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], scheme + ' expanded search accessibility');
      await page.screenshot({ path: '.artifacts/k4-search-' + scheme + '.png' });
      await input.press('Escape');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.locator('.list-tools .search').waitFor();
      assert.equal(await page.locator('.toolbar-row, .toolbar-search, .search-toggle').count(), 0, 'desktop keeps original single-row structure');
      assert.equal(await input.count(), 1, 'desktop has exactly one permanent search');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // A separate non-reduced-motion context checks actual entry/exit transitions.
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await seed(page);
    const samples = await page.evaluate(async () => {
      const toggle = document.querySelector('.search-toggle');
      toggle.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const row = document.querySelector('.toolbar-search'), css = getComputedStyle(row);
      const opening = { height: parseFloat(css.maxHeight), opacity: parseFloat(css.opacity),
        duration: css.transitionDuration, animations: row.getAnimations().map(a => a.transitionProperty) };
      await new Promise(resolve => setTimeout(resolve, 200));
      const openHeight = row.getBoundingClientRect().height;
      toggle.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const closing = { inert: row.hasAttribute('inert'), ariaHidden: row.getAttribute('aria-hidden'),
        animations: row.getAnimations().map(a => a.transitionProperty), focused: document.activeElement === toggle };
      await new Promise(resolve => setTimeout(resolve, 200));
      return { opening, openHeight, closing, removed: !document.querySelector('.toolbar-search') };
    });
    assert.ok(samples.opening.duration.split(',').every(v => parseFloat(v) === .16), 'entry/exit use 160ms');
    assert.ok(samples.opening.animations.includes('max-height') && samples.opening.animations.includes('opacity'), 'entry animates height and opacity');
    assert.equal(samples.openHeight, 44, 'expanded search input retains shared height');
    assert.ok(samples.closing.animations.includes('max-height') && samples.closing.animations.includes('opacity'), 'exit animates before removing DOM');
    assert.equal(samples.closing.inert, true, 'closing row cannot take input');
    assert.equal(samples.closing.ariaHidden, 'true', 'closing row leaves accessibility tree');
    assert.equal(samples.closing.focused, true, 'exit restores toggle focus');
    assert.equal(samples.removed, true, 'exit removes row');
    await fsEvidence(samples);
  } finally { await context.close(); }
};

async function fsEvidence(samples) {
  await require('node:fs/promises').writeFile('.artifacts/k4-search-motion.json', JSON.stringify(samples, null, 2) + '\n');
}
