// M2: real browser hit testing; contexts never share the author's browser data.
const { assert, installAxe } = require('./lib/browser.cjs');
const { seed, fixtures } = require('./baseline.cjs');
const TODAY = '2026-10-05';
const KEY = 'lifelog-days:celebrated';

exports.checkHeroUI = async function (browser) {
  for (const colorScheme of ['light', 'dark']) for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 },
      timezoneId: 'Asia/Shanghai', colorScheme, reducedMotion });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00+08:00`));
      // Suppress only the already-tested automatic celebration, not manual replay.
      await page.addInitScript(({ key, marker }) => localStorage.setItem(key, marker),
        { key: KEY, marker: `${fixtures[0].id}:${TODAY}` });
      await seed(page);
      const audit = async label => {
        // Check the settled surface, not the partially transparent entrance.
        await page.waitForFunction(() => {
          const dialog = document.querySelector('dialog[open]');
          if (!dialog) return true;
          const style = getComputedStyle(dialog);
          return style.opacity === '1' && Math.abs(new DOMMatrixReadOnly(style.transform).m42) < .5;
        });
        await installAxe(page);
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
        assert.deepEqual(violations, [], `${label}: axe`);
      };
      const closeDetail = async () => {
        await page.keyboard.press('Escape');
        await page.locator('.detail-modal').waitFor({ state: 'hidden' });
      };
      for (const width of [360, 412, 1024]) for (const today of [false, true]) {
        await page.setViewportSize({ width, height: width === 1024 ? 768 : 740 });
        const featured = { ...fixtures[0], ...(today ? { date: TODAY, repeat: 'none' } : {}) };
        await page.evaluate(async days => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('LifeLogDays');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          await new Promise((resolve, reject) => {
            const tx = db.transaction('days', 'readwrite'), store = tx.objectStore('days');
            store.clear(); for (const day of days) store.put(day);
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
          });
          db.close();
        }, [featured, ...fixtures.slice(1)]);
        await page.reload();
        const hero = page.locator('.hero'), link = hero.locator('.hero-link');
        await link.waitFor();
        const label = `${colorScheme}/${reducedMotion}/${width}/${today ? 'today' : 'next'}`;
        assert.equal(await link.getAttribute('aria-label'), `查看：${featured.title}`, `${label}: featured accessible name`);
        assert.equal(await hero.locator('button button').count(), 0, `${label}: no nested buttons`);
        const layout = await hero.evaluate(el => {
          const rect = el.getBoundingClientRect(), link = el.querySelector('.hero-link');
          const pseudo = getComputedStyle(link, '::after');
          return { width: rect.width, height: rect.height, targetWidth: parseFloat(pseudo.width),
            targetHeight: parseFloat(pseudo.height), position: pseudo.position,
            orbit: getComputedStyle(el.querySelector('.hero-orbit')).pointerEvents,
            dot: getComputedStyle(el.querySelector('.hero-dot')).pointerEvents,
            tagZ: getComputedStyle(el.querySelector('.hero-tag')).zIndex,
            countZ: getComputedStyle(el.querySelector('.hero-count')).zIndex };
        });
        assert.equal(layout.position, 'absolute');
        assert.ok(Math.abs(layout.width - layout.targetWidth) < .5, `${label}: stretched width equals hero`);
        assert.ok(Math.abs(layout.height - layout.targetHeight) < .5, `${label}: stretched height equals hero`);
        assert.equal(layout.orbit, 'none'); assert.equal(layout.dot, 'none');
        assert.equal(layout.tagZ, '1'); assert.equal(layout.countZ, '1');
        await link.focus(); await page.keyboard.press('Tab');
        if (today) {
          assert.ok(await hero.locator('button.hero-count').evaluate(el => el === document.activeElement),
            `${label}: Tab moves from details to replay`);
          await page.keyboard.press('Tab');
        }
        assert.ok(await page.evaluate(() => !!document.activeElement.closest('.days-section')),
          `${label}: next Tab enters the list section`);
        await link.focus(); await page.keyboard.press('Enter');
        await page.locator('.detail-modal').waitFor();
        assert.equal(await page.locator('.detail-modal h2').textContent(), featured.title, `${label}: Enter opens featured`);
        await closeDetail();
        if (today) {
          await hero.locator('button.hero-count').click();
          if (reducedMotion === 'no-preference') await hero.locator('.celebration-canvas').waitFor();
          assert.equal(await hero.locator('.celebration-canvas').count(), reducedMotion === 'reduce' ? 0 : 1,
            `${label}: replay respects motion preference`);
          assert.equal(await page.locator('dialog[open]').count(), 0, `${label}: replay never opens details`);
        }
        const box = await hero.boundingBox(), point = { x: box.x + box.width - 12, y: box.y + box.height - 12 };
        assert.ok(await hero.evaluate((el, p) => {
          const inside = r => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
          return !inside(el.querySelector('.hero-link').getBoundingClientRect()) &&
            !inside(el.querySelector('.hero-count').getBoundingClientRect()) &&
            document.elementFromPoint(p.x, p.y) === el.querySelector('.hero-link');
        }, point), `${label}: bottom-right whitespace hits the stretched button, not title/count`);
        await page.mouse.move(point.x, point.y); await page.mouse.down();
        await page.waitForTimeout(150);
        const pressed = await hero.evaluate(el => {
          const style = getComputedStyle(el), reference = document.createElement('div');
          reference.style.backgroundColor = 'color-mix(in srgb, var(--tint) 96%, #000)';
          el.append(reference);
          const expected = getComputedStyle(reference).backgroundColor; reference.remove();
          return { active: el.matches(':has(.hero-link:active)'), color: style.backgroundColor,
            expected, transform: style.transform, duration: style.transitionDuration,
            titleBackground: getComputedStyle(el.querySelector('.hero-link')).backgroundColor };
        });
        await page.mouse.up();
        assert.ok(pressed.active, `${label}: whitespace press activates details button`);
        assert.equal(pressed.color, pressed.expected, `${label}: whole tone darkens exactly 4%`);
        assert.equal(pressed.transform, 'none', `${label}: card never scales`);
        assert.equal(pressed.duration, reducedMotion === 'reduce' ? '0s' : '0.12s', `${label}: motion policy`);
        assert.equal(pressed.titleBackground, 'rgba(0, 0, 0, 0)', `${label}: no separate title press box`);
        await page.locator('.detail-modal').waitFor();
        assert.equal(await page.locator('.detail-modal h2').textContent(), featured.title,
          `${label}: card whitespace opens the featured record`);
        await audit(`${label} details`); await closeDetail(); await audit(`${label} home`);
      }
      assert.deepEqual(errors, [], 'M2 browser errors');
    } finally { await context.close(); }
  }
  console.log('PASS: M2 whole-hero hits, independent replay, keyboard order, 4% tone press without scale, 120ms/reduced motion and axe at 360/412/1024, light/dark.');
};
