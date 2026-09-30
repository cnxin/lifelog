const { pickDate } = require("./date-picker-helper.cjs");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
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
  const audit = async (label) => {
    await page.evaluate(await fs.readFile(require.resolve("axe-core"), "utf8"));
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          failure: n.failureSummary,
        })),
      })),
    );
    assert.deepEqual(violations, [], label);
  };
  const cell = (date) => page.locator(`.calendar-day[aria-label^="${date}"]`);
  const selected = () => page.locator('.calendar-day[data-selected="true"]');
  async function create(title, date, category, repeat, lunar = false) {
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill(title);
    await pickDate(page, date);
    await page
      .getByRole("group", { name: "分类", exact: true })
      .getByRole("radio", { name: category, exact: true })
      .check();
    if (repeat)
      await page
        .getByRole("checkbox", { name: "每年重复", exact: true })
        .check();
    if (lunar)
      await page.getByRole("radio", { name: "农历", exact: true }).check();
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  try {
    await fs.mkdir(".artifacts", { recursive: true });
    await page.clock.setFixedTime(new Date("2026-02-17T04:00:00Z"));
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5188");
    await page.getByRole("button", { name: "打开日历", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 1);
    assert.match(
      await selected().getAttribute("aria-label"),
      /2026年2月17日，农历正月初一，春节，今天/,
    );
    assert.equal(await page.locator(".calendar-empty").count(), 1);
    await audit("empty calendar");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "打开日历",
    );
    await create("团圆的日子", "2024-02-10", "纪念日", true, true);
    await create("妈妈的生日", "2020-02-17", "生日", true);
    await create("出发去旅行", "2026-02-18", "倒数日", false);
    await page.getByRole("button", { name: "打开日历", exact: true }).click();
    assert.equal(await selected().locator(".calendar-dots i").count(), 2);
    assert.match(
      await page.locator(".calendar-summary").textContent(),
      /本月 3 个日子 · 2 天有记录/,
    );
    assert.equal(await page.locator(".calendar-event").count(), 2);
    assert.match(
      await page.locator(".calendar-date-details").textContent(),
      /马年/,
    );
    await audit("populated calendar");
    // Keyboard grid navigation crosses week/month/year boundaries without losing focus.
    await selected().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await selected().getAttribute("aria-label"),
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
    );
    assert.match(await selected().getAttribute("aria-label"), /^2026年2月18日/);
    assert.equal(await page.locator(".calendar-event").count(), 1);
    await page.keyboard.press("PageUp");
    assert.match(await selected().getAttribute("aria-label"), /^2026年1月18日/);
    await page.keyboard.press("Shift+PageUp");
    assert.match(await selected().getAttribute("aria-label"), /^2025年1月18日/);
    await page.getByRole("button", { name: "今天", exact: true }).click();
    // A6 keeps the same calendar DOM below the editor instead of unmounting it.
    await page.evaluate(() => { window.calendarNode = document.querySelector(".calendar-modal"); });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "查看：团圆的日子", exact: true })
      .click();
    assert.equal(await page.locator("dialog[open]").count(), 2);
    await audit("calendar day detail");
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    assert.equal(await page.locator("dialog[open]").count(), 3);
    assert.ok(await page.evaluate(() => window.calendarNode === document.querySelector(".calendar-modal")), "calendar remains mounted under editor");
    assert.equal(
      await page.locator(".date-trigger").getAttribute("data-date"),
      "2024-02-10",
      "editing occurrence preserves source date",
    );
    await page.getByLabel("日子名称").fill("每年的团圆");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await page.getByRole("dialog", { name: "编辑这个日子", exact: true }).waitFor({ state: "hidden" });
    await page.getByRole("dialog", { name: "每年的团圆", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".detail-modal").waitFor({ state: "hidden" });
    assert.ok(await page.evaluate(() => window.calendarNode === document.querySelector(".calendar-modal")), "same calendar after saving");
    await page.getByRole("dialog", { name: "日历", exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 1);
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "查看：每年的团圆", exact: true })
        .count(),
      1,
    );
    assert.match(await selected().getAttribute("aria-label"), /^2026年2月17日/);
    // New records inherit the selected date; cancellation restores the calendar.
    await cell("2026年2月20日").click();
    await page
      .getByRole("button", { name: "在所选日期新增日子", exact: true })
      .click();
    assert.equal(
      await page.locator(".date-trigger").getAttribute("data-date"),
      "2026-02-20",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "记下一个日子", exact: true }).waitFor({ state: "hidden" });
    await page.getByRole("dialog", { name: "日历", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "在所选日期新增日子", exact: true })
      .click();
    await page.getByLabel("日子名称").fill("新的约定");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog", { name: "记下一个日子", exact: true }).waitFor({ state: "hidden" });
    await page.getByRole("dialog", { name: "日历", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "查看：新的约定", exact: true })
        .count(),
      1,
    );
    await page.getByRole("button", { name: "今天", exact: true }).click();
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page
          .locator(".modal")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${width}: no modal overflow`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (width === 390)
        await page
          .getByRole("dialog")
          .screenshot({ path: ".artifacts/calendar-mobile.png" });
      if (width === 1440)
        await page
          .getByRole("dialog")
          .screenshot({ path: ".artifacts/calendar-desktop.png" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
      document.documentElement.style.setProperty(
        "--safe-area-inset-top",
        "32px",
      );
      document.documentElement.style.setProperty(
        "--safe-area-inset-bottom",
        "24px",
      );
    });
    assert.ok(
      await page
        .locator(".modal")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      "large-text dialog fits screen",
    );
    await selected().focus();
    await page.keyboard.press("ArrowRight");
    assert.match(await selected().getAttribute("aria-label"), /^2026年2月18日/);
    await audit("200% calendar text");
    const bounds = await page.getByRole("dialog").boundingBox();
    assert.ok(bounds.y >= 32 && Math.abs(bounds.y + bounds.height - 844) <= 1, "sheet reaches viewport bottom");
    const bodyBounds = await page.locator(".modal-body").boundingBox();
    assert.ok(bodyBounds.y + bodyBounds.height <= 820, "sheet content clears bottom safe area");
    assert.ok(await page.getByRole("dialog").evaluate(el => parseFloat(getComputedStyle(el).paddingBottom) >= 44), "sheet includes safe-bottom padding");
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    assert.equal(
      await selected().evaluate((el) => getComputedStyle(el).outlineStyle),
      "solid",
    );
    await page.emulateMedia({
      forcedColors: "none",
      contrast: "more",
      reducedMotion: "reduce",
    });
    await audit("high contrast calendar");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => document.activeElement.getAttribute("aria-label") === "打开日历",
    );
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: legacy lunar/festival detail, recurring markers, keyboard navigation, add/edit return flow, focus, 320–1440px, 200% text, safe areas, forced/high contrast, axe.",
    );
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
