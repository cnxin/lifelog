const { chromium, assert, installAxe } = require('./lib/browser.cjs');
const fs = require('node:fs/promises');
const { seed } = require('./baseline.cjs');

exports.checkYearsUI = async function (browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 },
    timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
    await seed(page);
    const hero = page.locator('.hero-elapsed');
    assert.equal(await hero.textContent(), '一起走过 2329 天');
    for (const [width, size] of [[320,100],[360,100],[1024,100],[320,200]]) {
      await page.setViewportSize({ width, height: 900 });
      const font = await page.addStyleTag({ content: `:root{font-size:${size}% !important}` });
      const card = page.locator('.day-card').first();
      const label = card.locator('.years-label');
      assert.equal(await label.textContent(), '即将 7 周年');
      assert.ok(await hero.isVisible(), 'hero elapsed label remains visible on compact layouts');
      const geometry = await label.evaluate(el => {
        const rect=el.getBoundingClientRect(),card=el.closest('.day-card').getBoundingClientRect();
        return { rect:rect.toJSON(),card:card.toJSON(),fits:rect.left>=card.left&&rect.right<=card.right,
          pageFits:document.documentElement.scrollWidth<=innerWidth,contentFits:el.scrollWidth<=el.clientWidth+1 };
      });
      assert.ok(geometry.fits && geometry.contentFits && geometry.pageFits, `years badge real geometry at ${width}/${size}`);
      await installAxe(page);
      const violations=await page.evaluate(async()=>(await window.axe.run(document,
        {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
      assert.deepEqual(violations, [], `years labels axe at ${width}/${size}`);
      await fs.mkdir('.artifacts/years', { recursive:true });
      await page.screenshot({ path:`.artifacts/years/card-${width}-${size}.png`, fullPage:true });
      await fs.writeFile(`.artifacts/years/card-${width}-${size}.json`, JSON.stringify(geometry,null,2)+'\n');
      await font.evaluate(el=>el.remove());
    }
    await page.locator('.day-grid').getByRole('button',{name:'查看：我们在一起的日子',exact:true}).click();
    assert.equal(await page.locator('.detail-years').textContent(),'即将 7 周年');
    assert.deepEqual(errors,[]);
    console.log('PASS: years badge/hero/details, real card geometry, 320/360/1024/200% text, axe, screenshots.');
  } finally { await context.close(); }
};
if (require.main === module) (async()=>{
  const browser=await chromium.launch();
  try { await exports.checkYearsUI(browser); } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
