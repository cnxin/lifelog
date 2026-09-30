// Isolated fixture data: never reads or writes the user's browser profile.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 1000 },
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const days = [
    {
      id: "review1",
      title: "我们在一起的日子",
      date: "2020-05-20",
      category: "纪念日",
      repeat: "yearly",
      calendar: "solar",
      note: "一起走过的路，都值得记得。",
      pinned: true,
    },
    {
      id: "review2",
      title: "妈妈的生日",
      date: "1970-09-30",
      category: "生日",
      repeat: "yearly",
      calendar: "lunar",
      note: "记得订蛋糕",
      pinned: false,
    },
    {
      id: "review3",
      title: "第一次独自出发去看很远很远的世界与新的朋友们相遇",
      date: "1901-01-01",
      category: "倒数日",
      repeat: "none",
      calendar: "solar",
      note: "averylongunbrokenword".repeat(12),
      pinned: false,
    },
  ];
  const file = {
    name: "test.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "lifelog-days", version: 1, days }),
    ),
  };
  async function audit(label) {
    await page.evaluate(await fs.readFile(require.resolve("axe-core"), "utf8"));
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    );
    assert.deepEqual(violations, [], label);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      label + " page overflow",
    );
    if (await page.locator("dialog[open]").count())
      assert.ok(
        await page
          .locator("dialog[open]")
          .evaluateAll((elements) => elements.every(el => el.scrollWidth <= el.clientWidth + 1)),
        label + " dialog overflow",
      );
  }
  async function shot(name, bottom = false) {
    if (await page.locator("dialog[open]").count()) {
      await page.locator("dialog[open]").last().evaluate((el, bottom) => {
        el.scrollTop = bottom ? el.scrollHeight : 0;
      }, bottom);
      await page
        .locator("dialog[open]")
        .last()
        .screenshot({ path: ".artifacts/ui-review/" + name + ".png" });
    } else
      await page
        .locator("main")
        .screenshot({ path: ".artifacts/ui-review/" + name + ".png" });
  }
  try {
    await fs.mkdir(".artifacts/ui-review", { recursive: true });
    await page.clock.setFixedTime(new Date("2026-09-30T12:00:00+08:00"));
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5188");
    await audit("empty home");
    await page.getByRole('button', {name: '新增日子', exact: true}).click();
    assert.ok(await page.locator('.editor-modal').evaluate(el =>
      el === document.activeElement && !el.querySelector('input:focus, textarea:focus, select:focus')),
      'new editor focuses the dialog, not an input');
    await page.keyboard.press('Tab');
    assert.ok(await page.getByLabel('日子名称').evaluate(el => el === document.activeElement), 'first Tab enters the title field');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state: 'hidden'});
    // D3: real pointer input, isolated fixtures, both motion preferences.
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      await page.setViewportSize({ width: 390, height: 740 });
      const editor = page.locator('.editor-modal');
      const openEditor = async () => {
        await page.getByRole('button', {name: '新增日子', exact: true}).click();
        await editor.waitFor();
        await page.waitForFunction(() => {
          const el = document.querySelector('.editor-modal');
          return Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42) < .5;
        });
      };
      const startHeading = async () => {
        const box = await editor.locator('.modal-heading').boundingBox();
        const start = { x: box.x + box.width / 2, y: box.y + 2 };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        return start;
      };
      await openEditor();
      let start = await startHeading();
      await page.mouse.move(start.x, start.y + 140, {steps: 10});
      const dragging = await editor.evaluate(el => ({
        dragging: el.dataset.dragging, y: parseFloat(el.style.getPropertyValue('--drag-y')),
        backdrop: parseFloat(getComputedStyle(el, '::backdrop').opacity),
        transition: getComputedStyle(el).transitionDuration,
      }));
      assert.equal(dragging.dragging, 'true', 'vertical heading gesture captures the pointer');
      assert.ok(Math.abs(dragging.y - 140) < .5, 'sheet tracks the finger without a transition');
      assert.ok(Math.abs(dragging.backdrop - (1 - 140 / 740)) < .01, 'backdrop fades with drag distance');
      assert.equal(dragging.transition, '0s');
      await page.mouse.up();
      await editor.waitFor({state: 'hidden'});
      assert.equal(await page.locator('dialog[open]').count(), 0, `${motion}: 140px heading drag dismisses`);

      await openEditor();
      start = await startHeading();
      await page.mouse.move(start.x, start.y + 40, {steps: 5});
      // Pause beyond the velocity window: this is a short drag, not a flick.
      await page.waitForTimeout(140);
      await page.mouse.up();
      assert.ok(await editor.evaluate(el => el.open), `${motion}: 40px slow drag stays open`);
      assert.equal(await editor.evaluate(el => el.style.getPropertyValue('--drag-y')), '0px');
      assert.equal(await editor.getAttribute('data-dragging'), null);
      if (motion === 'reduce') assert.equal(await editor.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      await page.waitForFunction(() => Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.editor-modal')).transform).m42) < .5);

      start = await startHeading();
      await page.mouse.move(start.x, start.y - 140, {steps: 5});
      assert.equal(await editor.evaluate(el => el.style.getPropertyValue('--drag-y')), '-24px', 'upward heading drag is damped and capped');
      await page.waitForTimeout(140);
      await page.mouse.up();
      assert.ok(await editor.evaluate(el => el.open), 'upward dragging cannot dismiss');
      await page.waitForFunction(() => Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.editor-modal')).transform).m42) < .5);

      await editor.locator('.date-trigger').click();
      const body = editor.locator('.modal-body');
      await body.evaluate(el => { el.scrollTop = 50; });
      assert.ok(await body.evaluate(el => el.scrollTop > 0), 'scroll fixture really has scrolled content');
      const box = await body.boundingBox();
      await page.mouse.move(box.x + 2, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 2, box.y + 152, {steps: 8});
      await page.mouse.up();
      assert.ok(await editor.evaluate(el => el.open), 'downward body drag with scrollTop > 0 does not close');
      assert.equal(await editor.getAttribute('data-dragging'), null, 'scrolled body is not captured');
      await editor.getByRole('button', {name: '关闭', exact: true}).click();
      await editor.waitFor({state: 'hidden'});

      await page.setViewportSize({ width: 761, height: 900 });
      await openEditor();
      start = await startHeading();
      await page.mouse.move(start.x, start.y + 140, {steps: 8});
      await page.mouse.up();
      assert.ok(await editor.evaluate(el => el.open), 'desktop dialog does not enable sheet dragging');
      assert.equal(await editor.evaluate(el => el.style.getPropertyValue('--drag-y')), '');
      await page.keyboard.press('Escape');
      await editor.waitFor({state: 'hidden'});
    }
    // Chromium touch events exercise implicit capture transfer and native
    // directional scrolling, which page.mouse alone cannot cover.
    const touchPage = await browser.newPage({viewport: {width: 390, height: 740},
      hasTouch: true, isMobile: true, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai'});
    touchPage.on('pageerror', e => errors.push(e.message));
    try {
      await touchPage.goto(process.env.BASE_URL || 'http://127.0.0.1:5188');
      const cdp = await touchPage.context().newCDPSession(touchPage);
      const editor = touchPage.locator('.editor-modal'), body = editor.locator('.modal-body');
      const open = async () => {
        await touchPage.getByRole('button', {name: '新增日子', exact: true}).click();
        await editor.locator('.date-trigger').click();
        await body.evaluate(el => { el.scrollTop = 0; });
        await touchPage.waitForTimeout(100);
      };
      const swipe = async (x, y, dy) => {
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]});
        for (let i = 1; i <= 10; i++) {
          await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: y + dy * i / 10, id: 1}]});
          await touchPage.waitForTimeout(18);
        }
        const during = await editor.evaluate(el => ({dragging: el.dataset.dragging,
          y: el.style.getPropertyValue('--drag-y'), scroll: el.querySelector('.modal-body').scrollTop}));
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await touchPage.waitForTimeout(180);
        return during;
      };
      await open();
      let box = await body.boundingBox();
      let during = await swipe(box.x + 2, box.y + 14, 140);
      assert.equal(during.dragging, 'true', 'body-at-top touch retains capture after transferring from the child');
      assert.equal(during.y, '140px');
      assert.equal(await touchPage.locator('dialog[open]').count(), 0, 'body-at-top downward touch dismisses');
      await open();
      box = await body.boundingBox();
      during = await swipe(box.x + 2, box.y + 240, -140);
      assert.equal(during.dragging, undefined, 'upward body touch is left to native scrolling');
      assert.ok(await body.evaluate(el => el.scrollTop > 0), 'upward touch actually scrolls content');
      await body.evaluate(el => { el.scrollTop = 200; });
      await touchPage.waitForTimeout(50);
      box = await body.boundingBox();
      during = await swipe(box.x + 2, box.y + 14, 140);
      assert.equal(during.dragging, undefined, 'scrolled body retains native downward panning');
      assert.ok(await body.evaluate(el => el.scrollTop < 200), 'native downward touch actually scrolls back');
      assert.ok(await editor.evaluate(el => el.open), 'native body scrolling cannot dismiss');
      await editor.getByRole('button', {name: '关闭', exact: true}).click();
      await editor.waitFor({state: 'hidden'});
    } finally {
      await touchPage.close();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByRole("button", { name: "数据与备份", exact: true }).click();
    await page.getByLabel("选择备份文件").setInputFiles(file);
    await page
      .getByRole("button", { name: "确认合并导入", exact: true })
      .click();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    for (const [width, scale] of [
      [320, 1],
      [390, 1],
      [768, 1],
      [1440, 1],
      [320, 2],
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      const style = await page.addStyleTag({
        content: ":root {font-size:" + scale * 100 + "% !important}",
      });
      const label = width + "-" + scale;
      await audit(label + " home");
      if (width === 1440) {
        const cards = await page.locator(".day-card").evaluateAll((els) =>
          els.map((el) => ({
            count: el.querySelector(".card-count").getBoundingClientRect().top,
            footer: el.querySelector(".card-bottom").getBoundingClientRect()
              .top,
          })),
        );
        assert.ok(
          cards.every((card) => Math.abs(card.count - cards[0].count) < 1),
          "desktop countdowns align across long and short titles",
        );
        assert.ok(
          cards.every((card) => Math.abs(card.footer - cards[0].footer) < 1),
          "desktop footers align",
        );
      }
      if (width === 390 || width === 1440) await shot(label + "-home");
      if (width === 390) {
        const widths = await page
          .locator(".day-card")
          .last()
          .evaluate((el) => ({
            copy: el.querySelector(".card-copy").getBoundingClientRect().width,
            count: el.querySelector(".card-count").getBoundingClientRect()
              .width,
          }));
        assert.ok(
          widths.copy > widths.count,
          "title receives more room than countdown",
        );
      }
      await page
        .locator(".day-grid")
        .getByRole("button", { name: "查看：妈妈的生日", exact: true })
        .click();
      await audit(label + " detail");
      assert.ok(await page.locator(".detail-count").evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.getByRole("button", { name: "编辑", exact: true }).click();
      assert.ok(await page.locator('.editor-modal').evaluate(el =>
        el === document.activeElement && !el.querySelector('input:focus, textarea:focus, select:focus')),
        'existing editor also focuses the dialog, not an input');
      await audit(label + " editor");
      const geometry = await page.evaluate(() => {
        const r = (selector) =>
          document.querySelector(selector).getBoundingClientRect();
        return {
          repeatWidth: r(".repeat-calendar .choice-options").width,
          fieldWidth: r(".editor-fields").width,
          optional: r(".optional").left,
          label: r(".field-label").left,
          close: r(".modal-heading button").width,
        };
      });
      assert.ok(
        geometry.repeatWidth <= Math.min(192 * scale, geometry.fieldWidth) + 1,
        "repeat choice stays compact",
      );
      assert.ok(
        geometry.optional > geometry.label,
        "optional caption follows label",
      );
      assert.ok(geometry.close >= 44, "close button is never squeezed");
      if (width === 390 || width === 1440) await shot(label + "-editor");
      await page.locator(".date-trigger").click();
      await page.getByRole("button", { name: "切换年月", exact: true }).click();
      const year = page.getByLabel("年份", { exact: true });
      assert.ok(
        (await year.boundingBox()).width <= 96 * scale + 1,
        "year input stays compact",
      );
      await audit(label + " year chooser");
      if (width === 390) await shot(label + "-year");
      await page.getByRole("button", { name: "收起", exact: true }).click();
      await page.getByRole("button", { name: "删除", exact: true }).click();
      await page
        .getByRole("button", { name: "确认删除", exact: true })
        .scrollIntoViewIfNeeded();
      await audit(label + " delete confirmation");
      if (scale === 2) await shot(label + "-delete", true);
      await page.getByRole("button", { name: "保留", exact: true }).click();
      await page.locator(".editor-modal").getByRole("button", { name: "关闭", exact: true }).click();
      await page.locator(".editor-modal").waitFor({ state: "hidden" });
      await page.locator(".detail-modal").getByRole("button", { name: "关闭", exact: true }).click();
      await page.locator(".detail-modal").waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "数据与备份", exact: true })
        .click();
      await audit(label + " backup");
      assert.ok(
        await page
          .locator(".data-actions button > svg")
          .evaluateAll((els) =>
            els.every((el) => el.getBoundingClientRect().width >= 19.5),
          ),
        "backup icons retain their width",
      );
      if (width === 390) await shot(label + "-backup");
      await page.getByLabel("选择备份文件").setInputFiles(file);
      await page
        .getByRole("button", { name: "确认合并导入", exact: true })
        .scrollIntoViewIfNeeded();
      await audit(label + " import preview");
      const buttons = await page
        .locator(".import-preview .button-row button")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect(),
              p = el.closest(".import-preview").getBoundingClientRect();
            return r.left >= p.left && r.right <= p.right;
          }),
        );
      assert.ok(buttons.every(Boolean), "import buttons stay inside preview");
      if (scale === 2) await shot(label + "-import", true);
      await page.getByRole("button", { name: "取消", exact: true }).click();
      await page.getByRole("button", { name: "关闭", exact: true }).click();
      await page.getByRole("button", { name: "打开日历", exact: true }).click();
      await audit(label + " calendar");
      if (width === 390) await shot(label + "-calendar");
      await page.getByRole("button", { name: "关闭", exact: true }).click();
      await style.evaluate((el) => el.remove());
    }
    await page.getByRole("button", { name: "打开搜索", exact: true }).click();
    await page.getByRole("searchbox", { name: "搜索日子" }).fill("不存在的日子");
    await audit("no results");
    await page.getByRole("button", { name: "查看全部", exact: true }).click();
    assert.equal(
      await page.locator(".day-card").count(),
      3,
      "review leaves all fixture records intact",
    );
    // Long elapsed counts must fit in the hero, not merely be clipped by its overflow.
    await page
      .getByRole("button", { name: "取消置顶：我们在一起的日子", exact: true })
      .click();
    await page
      .getByRole("button", { name: "置顶：" + days[2].title, exact: true })
      .click();
    await page.addStyleTag({ content: ":root {font-size:200% !important}" });
    const countFits = await page
      .locator(".hero-count strong")
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          p = el.closest(".hero").getBoundingClientRect();
        return r.right <= p.right && el.scrollWidth <= el.clientWidth + 1;
      });
    assert.ok(countFits, "long hero count is not clipped at large text");
    await audit("large hero count");
    assert.deepEqual(errors, []);
    await require('./reminders-ui.cjs').checkReminderUI(browser);
    console.log(
      "PASS: UI polish across empty/populated home, long titles/counts, editor, compact repeat/year fields, delete/import buttons, backup icon alignment, calendar, no results, 320–1440px, 200% text, axe.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
