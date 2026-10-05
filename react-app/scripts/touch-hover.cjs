const { assert } = require("./lib/browser.cjs");

exports.checkTouchHover = async function (browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 740 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5188');
    assert.equal(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), false);
    const filters = page.getByRole('group', { name: '按分类筛选', exact: true });
    const anniversary = filters.getByRole('button', { name: '纪念日', exact: true });
    const all = filters.getByRole('button', { name: '全部', exact: true });
    const background = () => anniversary.evaluate(el => getComputedStyle(el, '::after').backgroundColor);
    const unselected = await background();
    await anniversary.tap();
    assert.notEqual(await background(), unselected, 'the selected chip has a painted background');
    await all.tap();
    assert.equal(await background(), unselected, 'touch deselection restores the computed unselected background');

    // A touch engine may retain :hover after its synthesized pointer events.
    // Force that lingering selector to prove the capability guard wins too.
    const rect = await anniversary.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    assert.ok(await anniversary.evaluate(el => el.matches(':hover')), 'simulate a retained hover selector');
    assert.equal(await background(), unselected, 'retained :hover cannot repaint a touch chip');

    const hoverRules = await page.evaluate(() => {
      const found = [];
      const walk = (rules, guarded = false) => {
        for (const rule of rules) {
          const fineHover = guarded || (rule instanceof CSSMediaRule &&
            rule.conditionText === '(hover: hover) and (pointer: fine)');
          if (rule.selectorText?.includes(':hover')) {
            for (const selector of rule.selectorText.split(',').filter(selector => selector.includes(':hover')))
              found.push({ selector: selector.trim(), guarded: fineHover });
          }
          if (rule.cssRules) walk(rule.cssRules, fineHover);
        }
      };
      for (const sheet of document.styleSheets) walk(sheet.cssRules);
      return found;
    });
    assert.equal(hoverRules.length, 14, 'all fourteen hover selectors remain present');
    assert.deepEqual(hoverRules.filter(rule => !rule.guarded), [], 'every hover selector requires a fine hover pointer');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
};
