const { chromium, assert, installAxe } = require('./lib/browser.cjs');
const { seed } = require('./baseline.cjs');
const fs = require('node:fs/promises');
const title = '我们在一起的日子';
async function stores(page) {
  return page.evaluate(async () => {
    const { db } = await import('/src/storage.ts');
    return { days: await db.days.toArray(), trash: await db.trash.toArray() };
  });
}
async function audit(page, label) {
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open], .toast[data-visible="true"]')]
    .every(el => getComputedStyle(el).opacity === '1'));
  await installAxe(page);
  const violations = await page.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  assert.deepEqual(violations, [], label);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' overflow');
}
exports.checkTrashUI = async function(browser) {
  for (const motion of ['reduce', 'no-preference']) for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: motion,
      colorScheme: scheme, timezoneId: 'Asia/Shanghai', hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
      await seed(page);
      await page.evaluate(() => localStorage.setItem('lifelog-days:celebrated', 'keep-this-marker'));
      const openDetail = () => page.locator('.day-grid').getByRole('button', { name: `查看：${title}`, exact: true }).click();
      await openDetail();
      const remove = page.getByRole('button', { name: '删除这个日子', exact: true });
      const size = await remove.boundingBox();
      assert.ok(size.height >= 44, 'detail deletion has >=44px height');
      assert.equal(await remove.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      await audit(page, 'detail delete '+motion+'/'+scheme);
      await remove.click();
      await page.locator('.detail-modal').waitFor({ state: 'hidden' });
      const toast = page.locator('.app-shell > .toast');
      await page.waitForFunction(() => document.querySelector('.app-shell > .toast').dataset.visible === 'true');
      assert.equal(await toast.innerText(), `已删除「${title}」\n撤销`);
      let state = await stores(page);
      assert.equal(state.days.length, 2); assert.equal(state.trash.length, 1);
      await audit(page, 'undo toast '+motion+'/'+scheme);
      await toast.getByRole('button', { name: '撤销', exact: true }).click();
      await page.locator('.day-card[data-id="baseline-anniversary"][data-highlight="true"]').waitFor();
      assert.equal(await toast.textContent(), '已恢复');
      state = await stores(page);
      assert.equal(state.days.length, 3); assert.equal(state.trash.length, 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('lifelog-days:celebrated')), 'keep-this-marker');
      // The editor uses the same recoverable delete function and confirmation.
      await openDetail();
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await page.getByRole('button', { name: '删除', exact: true }).click();
      assert.ok(await page.getByText('删除后可在「数据与备份」的最近删除里找回', { exact: false }).isVisible());
      await page.getByRole('button', { name: '确认删除', exact: true }).click();
      await page.locator('.editor-modal').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.querySelector('.app-shell > .toast').dataset.visible === 'true' && document.querySelector('.app-shell > .toast button'));
      await page.waitForTimeout(4500);
      assert.equal(await toast.getAttribute('data-visible'), 'true', 'undo remains for 5s even reduced-motion');
      await page.waitForTimeout(650);
      assert.equal(await toast.getAttribute('data-visible'), 'false', 'undo expires after 5s');
      await page.getByRole('button', { name: '数据与备份', exact: true }).click();
      const trash = page.locator('.recent-trash');
      await trash.getByRole('button', { name: `恢复：${title}`, exact: true }).waitFor();
      assert.ok(await trash.getByText('纪念日 · 删除于 刚刚', { exact: true }).isVisible());
      await audit(page, 'recent trash '+motion+'/'+scheme);
      await trash.getByRole('button', { name: `恢复：${title}`, exact: true }).click();
      await trash.getByText('没有最近删除的日子', { exact: true }).waitFor();
      assert.equal((await stores(page)).days.length, 3);
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await page.locator('dialog[open]').waitFor({ state: 'hidden' });
      await page.locator('.day-card[data-id="baseline-anniversary"][data-highlight="true"]').waitFor();
      await openDetail(); await page.getByRole('button', { name: '删除这个日子', exact: true }).click();
      await page.getByRole('button', { name: '数据与备份', exact: true }).click();
      await trash.getByRole('button', { name: '清空最近删除', exact: true }).click();
      assert.equal((await stores(page)).trash.length, 1, 'clear needs confirmation');
      await trash.getByRole('button', { name: '保留', exact: true }).click();
      assert.equal((await stores(page)).trash.length, 1);
      await trash.getByRole('button', { name: '清空最近删除', exact: true }).click();
      await trash.getByRole('button', { name: '确认清空', exact: true }).click();
      await trash.getByText('没有最近删除的日子', { exact: true }).waitFor();
      assert.equal((await stores(page)).trash.length, 0);
      await page.addStyleTag({ content: ':root{font-size:200% !important}' });
      await audit(page, 'empty trash 200% '+motion+'/'+scheme);
      await fs.mkdir('.artifacts/phase-l/l2/screenshots', { recursive: true });
      await page.screenshot({ path: `.artifacts/phase-l/l2/screenshots/trash-${motion}-${scheme}.png`, fullPage: true });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  await checkNativeSync(browser);
  console.log('PASS: detail/editor recoverable deletion, actionable five-second toast, undo/highlight, trash restore/confirm/purge, light/dark/reduced-motion/axe.');
};
async function checkNativeSync(browser) {
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  try {
    await page.addInitScript(() => {
      window.CapacitorCustomPlatform = { name: 'android' };
      window.__trashNative = { pending: [], calls: [], widgets: [], haptics: [] };
      window.Capacitor = { PluginHeaders: [{ name: 'WidgetBridge', methods: [{ name: 'update', rtype: 'promise' }, { name: 'consumeLaunchDayId', rtype: 'promise' }] }],
        nativePromise: async (plugin, method, options) => {
          if (plugin !== 'WidgetBridge') throw Error('unexpected bridge call');
          if (method === 'update') { window.__trashNative.widgets.push(JSON.parse(options.json)); return; }
          return { dayId: null };
        } };
    });
    await page.route('**/*local-notifications*', route => route.fulfill({ contentType: 'text/javascript', body: `
      const n=window.__trashNative; export const LocalNotifications={
        checkPermissions:async()=>({display:'granted'}),checkExactNotificationSetting:async()=>({exact_alarm:'denied'}),
        getPending:async()=>({notifications:n.pending}),createChannel:async()=>{},
        cancel:async()=>{n.calls.push('cancel');n.pending=[]},
        schedule:async({notifications})=>{n.calls.push('schedule');n.pending=notifications},
        addListener:async()=>({remove:async()=>{}})};` }));
    await page.route(/@capacitor(?:\/|_)haptics/, route => route.fulfill({ contentType: 'text/javascript', body: `
      export const ImpactStyle={Light:'LIGHT',Medium:'MEDIUM'};export const NotificationType={Success:'SUCCESS'};
      export const Haptics={impact:async({style})=>window.__trashNative.haptics.push(style),notification:async()=>{}};` }));
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+08:00'));
    await seed(page);
    await page.evaluate(async () => {
      const { db } = await import('/src/storage.ts');
      await db.days.update('baseline-anniversary', { date: '2099-06-01', repeat: 'none', reminders: [0, 1], reminderTime: '10:37' });
    });
    await page.reload();
    await page.waitForFunction(() => window.__trashNative.pending.some(n => n.extra.dayId === 'baseline-anniversary'));
    await page.locator('.day-grid').getByRole('button', { name: `查看：${title}`, exact: true }).click();
    await page.getByRole('button', { name: '删除这个日子', exact: true }).click();
    await page.waitForFunction(() => !window.__trashNative.pending.some(n => n.extra.dayId === 'baseline-anniversary') &&
      window.__trashNative.widgets.at(-1)?.featured?.id !== 'baseline-anniversary');
    assert.ok(await page.evaluate(() => window.__trashNative.calls.includes('cancel')), 'delete cancels notifications through changed/resync');
    assert.ok(await page.evaluate(() => window.__trashNative.haptics.includes('MEDIUM')), 'detail delete haptic medium');
    await page.locator('.app-shell > .toast').getByRole('button', { name: '撤销', exact: true }).click();
    await page.waitForFunction(() => window.__trashNative.pending.some(n => n.extra.dayId === 'baseline-anniversary') &&
      window.__trashNative.widgets.at(-1)?.featured?.id === 'baseline-anniversary');
    const restored = (await stores(page)).days.find(d => d.id === 'baseline-anniversary');
    assert.deepEqual(restored.reminders, [0, 1]);
    assert.equal(restored.reminderTime, '10:37');
    assert.ok(await page.locator('.day-card[data-id="baseline-anniversary"][data-highlight="true"]').isVisible());
  } finally { await page.close(); }
}
if (require.main === module) (async () => {
  const browser = await chromium.launch();
  try { await exports.checkTrashUI(browser); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
