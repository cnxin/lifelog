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
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        label + " dialog overflow",
      );
  }
  async function shot(name, bottom = false) {
    if (await page.locator("dialog[open]").count()) {
      await page.locator("dialog[open]").evaluate((el, bottom) => {
        el.scrollTop = bottom ? el.scrollHeight : 0;
      }, bottom);
      await page
        .locator("dialog[open]")
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
        .getByRole("button", { name: "编辑：妈妈的生日", exact: true })
        .click();
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
      await page.getByRole("button", { name: "关闭", exact: true }).click();
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
