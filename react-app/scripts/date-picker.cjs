const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { pickDate } = require("./date-picker-helper.cjs");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 },
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const trigger = page.locator(".date-trigger");
  const picker = page.getByRole("region", { name: "选择日期", exact: true });
  const audit = async () => {
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
    assert.deepEqual(violations, []);
  };
  try {
    await page.clock.install({ time: new Date("2026-09-30T12:00:00+08:00") });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5188");
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    assert.ok(await page.locator('.editor-modal').evaluate(el =>
      el === document.activeElement && !el.querySelector('input:focus, textarea:focus, select:focus')),
      'opening the editor does not auto-focus an input');
    await page.keyboard.press('Tab');
    assert.ok(await page.getByLabel('日子名称').evaluate(el => el === document.activeElement), 'first Tab focuses the title');
    await page.getByLabel("日子名称").fill("日期选择测试");
    assert.equal(await page.locator("input[type=date]").count(), 0);
    await trigger.click();
    // Real geometry in a short phone viewport, including the trigger and label.
    await page.setViewportSize({ width: 360, height: 740 });
    await page.keyboard.press('Escape');
    await trigger.click();
    const geometry = await page.evaluate(() => {
      const box = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return {top: r.top, bottom: r.bottom, height: r.height};
      };
      return {
        body: box('.modal-body'), trigger: box('.date-trigger'),
        label: box('.date-field-label'), panel: box('.date-picker'),
        nav: box('.date-picker-toolbar'), footer: box('.date-picker-footer'),
        cells: [...document.querySelectorAll('.date-picker .calendar-day')]
          .map(el => el.getBoundingClientRect().height),
        number: getComputedStyle(document.querySelector('.date-picker .calendar-number')).fontSize,
        lunar: getComputedStyle(document.querySelector('.date-picker .calendar-lunar')).fontSize,
      };
    });
    assert.ok(geometry.trigger.top >= geometry.body.top, 'expanded date trigger stays inside scroller');
    assert.ok(geometry.label.top >= geometry.body.top, 'date label stays visible above the trigger');
    assert.ok(geometry.panel.height <= 440, 'compact date panel <=440px');
    assert.equal(geometry.nav.height, 40);
    assert.equal(geometry.footer.height, 44);
    assert.ok(geometry.cells.every(height => height === 52), 'date cells are 52px');
    assert.equal(geometry.number, '15px');
    assert.equal(geometry.lunar, '10.5px');
    await picker.getByRole('button', {name: '上个月', exact: true}).click();
    const sixRows = await page.evaluate(() => {
      const panel = document.querySelector('.date-picker').getBoundingClientRect();
      const footer = document.querySelector('.editor-footer').getBoundingClientRect();
      return {height: panel.height, bottom: panel.bottom, actionsTop: footer.top};
    });
    assert.ok(sixRows.height <= 440, 'six-week month also fits the panel budget');
    assert.ok(sixRows.bottom <= sixRows.actionsTop, 'six-week date panel clears sticky save actions');
    await page.keyboard.press('Escape');
    await trigger.click();
    await page.setViewportSize({ width: 390, height: 1000 });
    assert.equal(await page.locator("dialog[open]").count(), 1);
    assert.equal(
      await page.locator(":focus").getAttribute("data-date"),
      "2026-09-30",
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator(":focus").getAttribute("data-date"),
      "2026-10-01",
    );
    assert.equal(
      await trigger.getAttribute("data-date"),
      "2026-09-30",
      "browsing does not commit a date",
    );
    await page.keyboard.press("Escape");
    assert.equal(await picker.count(), 0);
    assert.equal(
      await page.getByRole("dialog").count(),
      1,
      "Escape only collapses the picker",
    );
    assert.ok(await trigger.evaluate((el) => el === document.activeElement));
    await pickDate(page, "1992-02-29");
    assert.equal(await trigger.getAttribute("data-date"), "1992-02-29");
    await trigger.click();
    await page.keyboard.press("Shift+PageDown");
    assert.equal(
      await page.locator(":focus").getAttribute("data-date"),
      "1993-02-28",
    );
    await page.keyboard.press("Enter");
    assert.equal(await trigger.getAttribute("data-date"), "1993-02-28");
    // Both endpoints, no out-of-range navigation.
    for (const [date, disabled, key] of [
      ["1901-01-01", "上个月", "ArrowLeft"],
      ["2099-12-31", "下个月", "ArrowRight"],
    ]) {
      await pickDate(page, date);
      await trigger.click();
      assert.ok(
        await picker
          .getByRole("button", { name: disabled, exact: true })
          .isDisabled(),
      );
      await page.keyboard.press(key);
      assert.equal(
        await page.locator(":focus").getAttribute("data-date"),
        date,
      );
      await page.keyboard.press("Escape");
    }
    await trigger.click();
    await picker.getByRole("button", { name: "切换年月", exact: true }).click();
    await page.getByLabel("年份", { exact: true }).fill("1899");
    assert.equal(
      await page
        .getByLabel("年份", { exact: true })
        .getAttribute("aria-invalid"),
      "true",
    );
    assert.ok(
      await page
        .getByRole("group", { name: "月份", exact: true })
        .getByRole("button")
        .first()
        .isDisabled(),
    );
    await page.getByLabel("年份", { exact: true }).fill("2026");
    await audit();
    await page
      .getByRole("group", { name: "月份", exact: true })
      .getByRole("button", { name: "2月", exact: true })
      .click();
    assert.match(
      await picker
        .locator('[data-date="2026-02-17"]')
        .getAttribute("aria-label"),
      /农历正月初一，春节/,
    );
    await picker.getByRole("button", { name: "今天", exact: true }).click();
    assert.equal(await trigger.getAttribute("data-date"), "2026-09-30");
    await trigger.click();
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `no dialog overflow at ${width}`,
      );
      await audit();
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.addStyleTag({ content: ":root {font-size:200% !important;}" });
    assert.ok(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "large text stays inside dialog",
    );
    await page.evaluate(() =>
      document.querySelector("style:last-of-type")?.remove(),
    );
    await page.emulateMedia({ forcedColors: "active" });
    await audit();
    await page.emulateMedia({ forcedColors: "none" });
    await page.setViewportSize({ width: 390, height: 1100 });
    await page.getByRole("dialog").evaluate((el) => (el.scrollTop = 0));
    await fs.mkdir(".artifacts", { recursive: true });
    await page.screenshot({ path: ".artifacts/date-picker-mobile.png" });
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.screenshot({ path: ".artifacts/date-picker-desktop.png" });
    await picker.getByRole("button", { name: "收起", exact: true }).click();
    assert.ok(await trigger.evaluate((el) => el === document.activeElement));
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page.locator(".day-grid").getByRole("button", { name: /查看.*日期选择测试/ }).click();
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    assert.equal(
      await trigger.getAttribute("data-date"),
      "2026-09-30",
      "date persisted after reload",
    );
    // A quick month click interrupts the opening scroll. Cover normal motion
    // too, and simulate old WebViews that ignore the container option.
    for (const motion of ['no-preference', 'reduce']) {
      for (const oldOptions of [false, true]) {
        const regression = await browser.newPage({
          viewport: {width: 360, height: 740}, timezoneId: 'Asia/Shanghai', reducedMotion: motion,
        });
        regression.on('pageerror', error => errors.push(error.message));
        try {
          if (oldOptions) await regression.addInitScript(() => {
            const native = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function(options) {
              if (options && typeof options === 'object')
                return native.call(this, {block: options.block, inline: options.inline, behavior: options.behavior});
              return native.call(this, options);
            };
          });
          await regression.goto(process.env.BASE_URL || 'http://127.0.0.1:5188');
          await regression.locator('.header-add').click();
          await regression.getByLabel('日子名称').fill('快速切月几何回归');
          await pickDate(regression, '2026-09-30');
          await regression.locator('.date-trigger').click();
          await regression.locator('.date-picker').getByRole('button', {name: '上个月', exact: true}).click();
          // Check after animation completion, not an early, transient passing box.
          await regression.waitForTimeout(800);
          const bounds = await regression.evaluate(() => {
            const rect = selector => {
              const r = document.querySelector(selector).getBoundingClientRect();
              return {top: r.top, bottom: r.bottom, height: r.height};
            };
            return {trigger: rect('.date-trigger'), label: rect('.date-field-label'),
              body: rect('.modal-body'), panel: rect('.date-picker'), actions: rect('.editor-footer'),
              outerScroll: document.querySelector('.modal').scrollTop};
          });
          assert.ok(bounds.trigger.top >= bounds.body.top, `${motion}/${oldOptions}: trigger stays visible after rapid month change`);
          assert.ok(bounds.label.top >= bounds.body.top, 'date label stays visible after interrupted opening scroll');
          assert.ok(bounds.panel.height <= 440 && bounds.panel.bottom <= bounds.actions.top, 'six-week panel remains compact and clears save actions');
          assert.equal(bounds.outerScroll, 0, 'date alignment does not scroll the hidden outer dialog and clip its heading');
        } finally {
          await regression.close();
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "Date picker passed: selection, lunar labels, keyboard, bounds, cancellation, persistence, responsive layout, large type, forced colors, axe.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
