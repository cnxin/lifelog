// K6: real header-search geometry and interactions; these checks also run in gates.
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
      const toggle = page.locator('.header-search'), row = page.locator('.toolbar-row');
      const input = page.getByRole('searchbox', { name: '搜索日子', exact: true });
      const original = await row.boundingBox();
      const originalHeader = await page.locator('.site-header').boundingBox();
      const closedGeometry = await page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height}; };
        const header = document.querySelector('.header-inner'), brand = document.querySelector('.brand');
        const actions = [...document.querySelectorAll('.header-actions button')];
        const strip = document.querySelector('.filters'), chips = [...strip.querySelectorAll('button')];
        const add = document.querySelector('.header-add span'), range = document.createRange();
        range.selectNodeContents(add);
        return { header:rect(header), brand:rect(brand), actions:actions.map(rect),
          add:rect(add), text:range.getBoundingClientRect().toJSON(), textValue:add.textContent,
          overflow:getComputedStyle(add).textOverflow, pageWidth:document.documentElement.scrollWidth,
          strip:rect(strip), chips:chips.map(rect), mask:getComputedStyle(strip).maskImage };
      });
      assert.equal(closedGeometry.actions.length, 3, 'compact header has search, backup and add');
      for (const action of closedGeometry.actions) {
        assert.ok(action.top >= closedGeometry.brand.top && action.bottom <= closedGeometry.brand.bottom, 'brand and all three actions stay on one row');
        assert.ok(action.left >= closedGeometry.brand.right && action.right <= 360, 'header actions do not overlap brand or overflow');
      }
      assert.equal(closedGeometry.actions[0].width, 36, 'header search visual width 36px');
      assert.equal(closedGeometry.actions[0].height, 36, 'header search visual height 36px');
      assert.equal(closedGeometry.pageWidth, 360, '360px header does not overflow viewport');
      assert.equal(closedGeometry.textValue, '新增');
      assert.ok(closedGeometry.text.width <= closedGeometry.add.width && closedGeometry.text.left >= closedGeometry.add.left && closedGeometry.text.right <= closedGeometry.add.right, 'add text fits without truncation by real text geometry');
      assert.notEqual(closedGeometry.overflow, 'ellipsis', 'add label is not ellipsized');
      for (const chip of closedGeometry.chips.slice(0, 3)) {
        assert.ok(chip.left >= closedGeometry.strip.left && chip.right <= closedGeometry.strip.right, 'first three chips fully inside strip');
      }
      assert.ok(closedGeometry.chips[3].left < closedGeometry.strip.right && closedGeometry.chips[3].right > closedGeometry.strip.right, 'fourth chip enters the fade and is clipped');
      assert.match(closedGeometry.mask, /linear-gradient/, 'right-edge fade remains');
      assert.equal(await page.locator('.toolbar-search').count(), 0, 'closed search row is unmounted');
      await toggle.click();
      await input.waitFor();
      assert.ok(await input.evaluate(el => el === document.activeElement), 'open focuses input');
      // ResizeObserver delivers after layout, not synchronously with React mount.
      await page.waitForFunction(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-offset')) === document.querySelector('.site-header').getBoundingClientRect().height);
      const geometry = await page.evaluate(() => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        return { search: box('.toolbar-search .search'), searchRow: box('.toolbar-search'), row: box('.toolbar-row'), toolbar: box('.toolbar'), card: box('.day-card'),
          header: box('.site-header'), headerInner: box('.header-inner'), shell: box('.app-shell'),
          offset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-offset')),
          stickyTop: parseFloat(getComputedStyle(document.querySelector('.toolbar')).top),
          insideHeader: document.querySelector('.site-header').contains(document.querySelector('.toolbar-search')) };
      });
      assert.ok(geometry.search.height >= 44 && geometry.row.height >= 44, 'both rows are visible');
      assert.ok(geometry.search.bottom <= geometry.row.y, 'search and chip row do not overlap');
      assert.equal(geometry.search.x, geometry.row.x, 'two rows align horizontally');
      assert.equal(geometry.search.width, geometry.row.width, 'search fills its own row');
      assert.ok(geometry.toolbar.bottom <= geometry.card.y, 'expanded toolbar does not cover first card');
      assert.ok(geometry.insideHeader && geometry.headerInner.bottom <= geometry.searchRow.y && geometry.searchRow.bottom <= geometry.header.bottom, 'search is the bottom row of sticky header');
      assert.ok(geometry.header.bottom <= geometry.shell.y, 'search row precedes app shell');
      assert.equal(geometry.offset, geometry.header.height, 'ResizeObserver updates header offset to expanded height');
      assert.equal(geometry.stickyTop, geometry.header.height, 'toolbar sticky top follows expanded header');
      assert.ok(geometry.header.height > originalHeader.height, 'search increases sticky header height');
      await page.evaluate(() => scrollTo(0, 1000));
      const stuck = await page.evaluate(() => ({header:document.querySelector('.site-header').getBoundingClientRect().bottom,
        toolbar:document.querySelector('.toolbar').getBoundingClientRect().top}));
      assert.ok(Math.abs(stuck.header - stuck.toolbar) <= 1, 'scrolled toolbar sticks directly below expanded header');
      await page.evaluate(() => scrollTo(0, 0));
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
      await page.waitForFunction(() => document.activeElement === document.querySelector('.header-search'));
      assert.equal((await row.boundingBox()).y, original.y, 'X restores original chip row y');
      assert.equal(await page.locator('.day-card').count(), 1, 'X clears query but keeps category');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.click();
      assert.equal(await input.inputValue(), '', 'X cleared query');
      await input.fill('一起');
      await input.press('Escape');
      await page.locator('.toolbar-search').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement === document.querySelector('.header-search'));
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
      await page.screenshot({ path: '.artifacts/k6-search-' + scheme + '.png' });
      await input.press('Escape');
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.locator('.list-tools .search').waitFor();
      assert.equal(await page.locator('.toolbar-row, .toolbar-search, .header-search, .search-toggle').count(), 0, 'desktop keeps original single-row structure');
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
      const toggle = document.querySelector('.header-search');
      toggle.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const row = document.querySelector('.toolbar-search'), css = getComputedStyle(row);
      const opening = { height: parseFloat(css.maxHeight), opacity: parseFloat(css.opacity),
        duration: css.transitionDuration, animations: row.getAnimations().map(a => a.transitionProperty) };
      await new Promise(resolve => setTimeout(resolve, 200));
      const openHeight = row.querySelector('.search').getBoundingClientRect().height;
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
  await require('node:fs/promises').writeFile('.artifacts/k6-search-motion.json', JSON.stringify(samples, null, 2) + '\n');
}
