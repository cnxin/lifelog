const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.LIFELOG_UI_PORT || 4174);
const externalUrl = process.env.LIFELOG_UI_BASE_URL;
const baseUrl = externalUrl || `http://127.0.0.1:${port}`;
let server;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer() {
  if (externalUrl) return;
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true
  });
}

function isReady() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForApp() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isReady()) return;
    await delay(500);
  }
  throw new Error(`UI preview did not become available at ${baseUrl}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert.ok(scrollWidth <= clientWidth, `${label} overflows horizontally: ${scrollWidth}px > ${clientWidth}px`);
}

async function testThemeTokens(browser) {
  const colors = [];
  for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ colorScheme, viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    colors.push(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface-canvas').trim()));
    await assertNoHorizontalOverflow(page, `${colorScheme} settings`);
    await page.close();
  }
  assert.notEqual(colors[0], colors[1], 'light and dark surface tokens must differ');
}

async function testDataManagementGroup(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const dataTab = page.locator('[role=tab]').nth(2);
  await dataTab.focus();
  await page.keyboard.press('Enter');
  await page.locator('.data-action-grid').waitFor();
  const group = await page.locator('.data-action-grid').evaluate((element) => ({
    className: element.className,
    rows: Array.from(element.children).map((row) => {
      const style = getComputedStyle(row);
      return { divider: style.borderBottomWidth, radius: style.borderRadius, shadow: style.boxShadow };
    })
  }));
  assert.match(group.className, /content-list/);
  assert.equal(group.rows.length, 6);
  assert.ok(group.rows.slice(0, -1).every((row) => row.divider === '1px' && row.radius === '0px' && row.shadow === 'none'));
  assert.equal(group.rows.at(-1).divider, '0px');
  await page.locator('.ux-metrics-card').waitFor();
  assert.equal(await page.locator('.ux-metrics-summary > span').count(), 4, 'UX metrics summary stays compact');
  await assertNoHorizontalOverflow(page, 'data management');
  await page.close();
}

async function testReminderGroup(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const reminderLabel = '\u63d0\u9192\u8bbe\u7f6e';
  const reminderButton = page.locator('button').filter({ hasText: reminderLabel });
  await reminderButton.waitFor();
  await reminderButton.click();
  await page.locator('.reminder-config-list').waitFor();
  const group = await page.locator('.reminder-config-list').evaluate((element) => ({
    overflow: getComputedStyle(element).overflow,
    rows: Array.from(element.children).map((row) => {
      const style = getComputedStyle(row);
      return { divider: style.borderBottomWidth, radius: style.borderRadius, shadow: style.boxShadow };
    })
  }));
  assert.equal(group.overflow, 'visible');
  assert.equal(group.rows.length, 4);
  assert.ok(group.rows.slice(0, -1).every((row) => row.divider === '1px' && row.radius === '0px' && row.shadow === 'none'));
  assert.equal(group.rows.at(-1).divider, '0px');
  assert.ok(await page.locator('.reminder-toggle').count() >= 4, 'reminder toggles remain available');
  assert.equal(await page.locator('.smart-prompt-category').count(), 5, 'all existing smart prompt categories are controllable');
  await assertNoHorizontalOverflow(page, 'reminder settings');
  await page.close();
}

async function testSearchReturn(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(() => window.dispatchEvent(new Event('lifelog:open-global-search')));
  const input = page.locator('.global-search-input input');
  await input.waitFor();
  await input.fill('小明');
  const result = page.locator('.global-search-result').first();
  await result.waitFor();
  await result.click();
  await page.locator('.search-result-focus').waitFor();
  await page.locator('.back-button').first().click();
  await page.locator('.global-search-panel').waitFor();
  assert.equal(await page.locator('.global-search-input input').inputValue(), '小明');
  assert.ok(!page.url().includes(encodeURIComponent('小明')), 'search query stays out of the URL');
  await assertNoHorizontalOverflow(page, 'search return');
  await page.close();
}

async function testSharePrivacyPresets(browser) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/memories`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.locator('.content-list--records .memory-card .place-tap').first().click();
    const actionLayout = await page.locator('.memory-reader-actions').evaluate((element) => {
      const actions = element.getBoundingClientRect();
      const nextSection = element.nextElementSibling.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        actionsBottom: Math.round(actions.bottom),
        nextSectionTop: Math.round(nextSection.top)
      };
    });
    assert.equal(actionLayout.position, 'static', 'memory actions stay in the reader card flow');
    assert.ok(actionLayout.actionsBottom <= actionLayout.nextSectionTop, 'memory actions do not overlap the next section');
    await page.locator('.memory-reader-actions button').filter({ hasText: '分享' }).click();
    await page.locator('.local-share-privacy-presets').waitFor();
    const presets = page.locator('.local-share-privacy-presets button');
    assert.equal(await presets.count(), 3);
    assert.match(await presets.first().getAttribute('class'), /active/, 'private preset is the default');
    const preview = page.locator('.local-share-field-preview');
    assert.match(await preview.innerText(), /公开姓名/);
    assert.match(await preview.innerText(), /精准定位/);
    await presets.nth(1).click();
    assert.match(await page.locator('.local-share-summary').innerText(), /人物姓名/);
    await presets.nth(2).click();
    await page.locator('.local-share-advanced-panel').waitFor();
    await assertNoHorizontalOverflow(page, `share privacy ${viewport.width}px`);
    await page.close();
  }
}

async function testLargeTextOverflow(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.addStyleTag({ content: 'html { font-size: 125% !important; }' });
  await page.locator('[role=tab]').nth(2).click();
  await page.locator('.data-action-grid').waitFor();
  await assertNoHorizontalOverflow(page, 'large text data management');
  await page.close();
}

async function testHomePriority(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.locator('.home-composer').waitFor();
  await page.locator('.onboarding-checklist').waitFor();
  assert.equal(await page.locator('.onboarding-step').count(), 3, 'fresh Demo seed still enters the three-step onboarding flow');
  const initial = await page.locator('.home-composer').evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderStyle: style.borderStyle, shadow: style.boxShadow, backgroundImage: style.backgroundImage };
  });
  const queue = await page.locator('.today-queue-card').evaluate((element) => element.className);
  assert.equal(initial.borderStyle, 'solid');
  assert.equal(initial.shadow, 'none');
  assert.equal(initial.backgroundImage, 'none');
  assert.ok(!queue.includes('open'), 'today queue starts collapsed');
  await page.locator('.today-queue-summary').click();
  const rows = await page.locator('.today-action-card').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { divider: style.borderBottomWidth, radius: style.borderRadius, shadow: style.boxShadow };
  }));
  assert.ok(rows.length > 0, 'expanded queue shows actionable reminders');
  assert.ok(rows.every((row, index) => row.radius === '0px' && row.shadow === 'none' && (index === rows.length - 1 || row.divider === '1px')));
  await assertNoHorizontalOverflow(page, 'home');
  await page.close();
}

async function testRecordCardSpacing(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const route of ['/people', '/places', '/memories']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const list = page.locator('.content-list--records');
    await list.waitFor();
    const result = await list.evaluate((element) => {
      const rows = Array.from(element.querySelectorAll('.list-row')).slice(0, 2);
      const rects = rows.map((row) => row.getBoundingClientRect());
      return {
        gap: rects.length > 1 ? Math.round(rects[1].top - rects[0].bottom) : null,
        rows: rows.map((row) => ({ radius: getComputedStyle(row).borderRadius, shadow: getComputedStyle(row).boxShadow }))
      };
    });
    assert.equal(result.gap, 8, `${route} keeps an 8px gap between record cards`);
    assert.ok(result.rows.every((row) => row.radius === '18px' && row.shadow !== 'none'));
  }
  await page.close();
}

async function testFabMenuSizing(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const onboardingLater = page.locator('.onboarding-later');
  await onboardingLater.waitFor();
  await onboardingLater.click();
  await page.locator('.onboarding-checklist').waitFor({ state: 'detached' });
  await page.locator('.fab').waitFor({ state: 'visible' });
  await page.locator('.fab').click();
  await page.locator('.fab-menu button').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  const actions = await page.locator('.fab-menu button').evaluateAll((buttons) => buttons.map((button) => ({
    width: Math.round(button.getBoundingClientRect().width),
    height: Math.round(button.getBoundingClientRect().height),
    labelWidth: Math.round(button.querySelector('.fab-menu-label').getBoundingClientRect().width),
    labelHeight: Math.round(button.querySelector('.fab-menu-label').getBoundingClientRect().height),
    iconWidth: Math.round(button.querySelector('.fab-menu-icon').getBoundingClientRect().width),
    iconCenter: Math.round(button.querySelector('.fab-menu-icon').getBoundingClientRect().x + button.querySelector('.fab-menu-icon').getBoundingClientRect().width / 2),
    smallCount: button.querySelectorAll('small').length
  })));
  const fabCenter = await page.locator('.fab').evaluate((button) => Math.round(button.getBoundingClientRect().x + button.getBoundingClientRect().width / 2));
  assert.ok(actions.length >= 2, 'quick add offers multiple actions');
  assert.ok(actions.every((action) => action.width === 208), `quick add widths: ${JSON.stringify(actions)}`);
  assert.ok(actions.every((action) => action.width === actions[0].width && action.height === actions[0].height));
  assert.ok(actions.every((action) => action.labelWidth === actions[0].labelWidth && action.labelHeight === actions[0].labelHeight && action.iconWidth === actions[0].iconWidth));
  assert.ok(actions.every((action) => action.iconCenter === fabCenter), 'quick add icons align with the main add button');
  assert.ok(actions.every((action) => action.smallCount === 0), 'quick add actions only show concise labels');
  await page.close();
}

async function testPlaceDetailGroups(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/places`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const placeTap = page.locator('.place-card .place-tap').first();
  await placeTap.waitFor();
  await placeTap.click();
  await page.locator('.place-detail-info-list').waitFor();
  const rows = await page.locator('.place-detail-info-list').evaluate((element) => Array.from(element.children).map((row) => {
    const style = getComputedStyle(row);
    return { divider: style.borderBottomWidth, radius: style.borderRadius, shadow: style.boxShadow };
  }));
  assert.equal(rows.length, 6);
  assert.ok(rows.slice(0, -1).every((row) => row.divider === '1px' && row.radius === '0px' && row.shadow === 'none'));
  assert.equal(rows.at(-1).divider, '0px');
  const timelines = await page.locator('.memory-timeline-content-list').evaluateAll((elements) => elements.map((element) => ({
    rows: element.children.length,
    shadow: getComputedStyle(element).boxShadow
  })));
  assert.ok(timelines.length > 0 && timelines.every((timeline) => timeline.rows > 0 && timeline.shadow === 'none'));
  await assertNoHorizontalOverflow(page, 'place detail');
  await page.close();
}

async function main() {
  startServer();
  let browser;
  try {
    await waitForApp();
    browser = await chromium.launch({ headless: true });
    await testThemeTokens(browser);
    await testHomePriority(browser);
    await testRecordCardSpacing(browser);
    await testFabMenuSizing(browser);
    await testPlaceDetailGroups(browser);
    await testSearchReturn(browser);
    await testSharePrivacyPresets(browser);
    await testDataManagementGroup(browser);
    await testReminderGroup(browser);
    await testLargeTextOverflow(browser);
    console.log('Content-first UI acceptance passed.');
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
