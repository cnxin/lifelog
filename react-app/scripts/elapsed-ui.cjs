const { chromium, assert, installAxe } = require('./lib/browser.cjs');
const { seed } = require('./baseline.cjs');
const fs = require('node:fs/promises');
exports.checkElapsedUI = async function(browser) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: 'reduce', colorScheme: scheme, timezoneId: 'Asia/Shanghai' });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      assert.equal(await page.locator('.card-elapsed').count(), 2, 'only past yearly cards');
      const card = page.locator('.day-card[data-id="baseline-anniversary"]');
      const bottom = card.locator('.card-bottom');
      assert.equal(await bottom.locator('span').first().textContent(), '下次 · 2027.05.20');
      assert.equal(await bottom.locator('.card-elapsed').textContent(), '一起走过 2329 天');
      assert.equal(await page.locator('.hero-elapsed').textContent(), '一起走过 2329 天');
      for (const [width, size] of [[320, 100], [360, 100], [412, 100], [430, 100], [1024, 100], [360, 200]]) {
        await page.setViewportSize({ width, height: 900 });
        const style = await page.addStyleTag({ content: `:root{font-size:${size}% !important}` });
        const geometry = await bottom.evaluate(el => {
          const [left, right, chevron] = el.children, r = right.getBoundingClientRect(), l = left.getBoundingClientRect(), c = chevron.getBoundingClientRect(), b = el.getBoundingClientRect();
          const css = getComputedStyle(right);
          return { left: l.toJSON(), right: r.toJSON(), chevron: c.toJSON(), bottom: b.toJSON(),
            ellipsis: css.textOverflow, whitespace: css.whiteSpace, lineHeight: parseFloat(css.lineHeight),
            clipped: right.scrollWidth > right.clientWidth, pageFits: document.documentElement.scrollWidth <= innerWidth };
        });
        assert.equal(geometry.whitespace, 'nowrap'); assert.equal(geometry.ellipsis, 'ellipsis');
        assert.ok(geometry.left.right <= geometry.right.left + 1 && geometry.right.right <= geometry.chevron.left + 1, 'next / elapsed / chevron order, no overlap');
        assert.ok(geometry.right.height <= geometry.lineHeight + 1, 'elapsed stays one line');
        assert.ok(geometry.chevron.right <= geometry.bottom.right + 1 && geometry.pageFits, 'chevron and card fit');
        if (size === 200) assert.ok(geometry.clipped, 'narrow enlarged elapsed text really ellipsizes');
        await fs.mkdir('.artifacts/phase-l/l4/geometry', { recursive: true });
        await fs.writeFile(`.artifacts/phase-l/l4/geometry/${scheme}-${width}-${size}.json`, JSON.stringify(geometry, null, 2));
        await style.evaluate(el => el.remove());
      }
      await page.setViewportSize({ width: 360, height: 740 });
      await card.getByRole('button', { name: '查看：我们在一起的日子', exact: true }).click();
      const elapsed = page.locator('.detail-elapsed');
      assert.equal(await elapsed.textContent(), '一起走过 2329 天');
      assert.equal(await elapsed.locator('strong').evaluate(el => getComputedStyle(el).fontWeight), '600');
      assert.equal(await elapsed.evaluate(el => getComputedStyle(el).fontSize), '14px');
      const yearsBox = await page.locator('.detail-years').boundingBox(), elapsedBox = await elapsed.boundingBox();
      assert.ok(elapsedBox.y >= yearsBox.y + yearsBox.height, 'elapsed row follows years without overlap');
      await installAxe(page);
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => v.id)), []);
      await fs.mkdir('.artifacts/phase-l/l4/screenshots', { recursive: true });
      await page.screenshot({ path: `.artifacts/phase-l/l4/screenshots/detail-${scheme}.png`, fullPage: true });
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await page.evaluate(async () => {
        const { db } = await import('/src/storage.ts');
        await db.days.update('baseline-anniversary', { date: '2026-10-05' });
      });
      await page.reload();
      await card.waitFor();
      assert.equal(await card.locator('.card-elapsed').count(), 0, 'source today: pure helper supports zero but UI strictly hides');
      await page.evaluate(async () => { const { db } = await import('/src/storage.ts'); await db.days.update('baseline-anniversary', { date: '2027-10-05' }); });
      await page.reload(); await card.waitFor();
      assert.equal(await card.locator('.card-elapsed').count(), 0, 'future origin hidden');
      assert.equal(await page.locator('.hero-elapsed').count(), 0, 'future hero preserves existing copy');
    } finally { await context.close(); }
  }
  console.log('PASS: elapsed copy/strict conditions, one-line clipping, 320–1024/200% real geometry, detail years ordering/weight/axe.');
};
if (require.main === module) (async () => { const browser = await chromium.launch();
  try { await exports.checkElapsedUI(browser); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
