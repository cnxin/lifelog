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
    await page.getByLabel("日子名称").fill("日期选择测试");
    assert.equal(await page.locator("input[type=date]").count(), 0);
    await trigger.click();
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
    await picker.getByRole("button", { name: "选择今天", exact: true }).click();
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
