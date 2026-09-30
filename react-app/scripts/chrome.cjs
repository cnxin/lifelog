const { pickDate } = require("./date-picker-helper.cjs");
// Browser layout simulation only: this does not certify Android device insets.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.BASE_URL || "http://127.0.0.1:5188";
  const inset = async (top, right, bottom, left) => {
    await page.evaluate(
      (values) => {
        ["top", "right", "bottom", "left"].forEach((side, i) => {
          document.documentElement.style.setProperty(
            `--safe-area-inset-${side}`,
            `${values[i]}px`,
          );
        });
      },
      [top, right, bottom, left],
    );
  };
  const noOverflow = async (label) => {
    await page.getByRole("button", { name: "排序方式", exact: true }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      label + ": horizontal overflow",
    );
  };
  const audit = async (label) => {
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
    assert.deepEqual(violations, [], label + ": accessibility");
  };
  try {
    await fs.mkdir(".artifacts", { recursive: true });
    await page.goto(base);
    await page.getByRole("button", { name: "新增日子", exact: true }).waitFor();
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("每一个平凡的日子，都值得好好记住");
    await pickDate(page, "2024-05-20");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.ok((await page.locator(".day-card").first().boundingBox()).y < 740, "first mobile card begins in the first viewport");
    assert.ok((await page.locator(".hero").boundingBox()).height <= 200, "populated mobile hero is compact");
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1, "mobile h1 remains accessible");
    assert.equal(await page.locator(".overview-side").isVisible(), false, "mobile hides duplicate statistics");
    await page.getByRole("button", { name: "打开搜索", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "搜索日子", exact: true });
    assert.ok(await search.evaluate(el => el === document.activeElement), "expanded search receives focus");
    await search.fill("平凡");
    await page.keyboard.press("Escape");
    assert.equal(await search.inputValue(), "平凡", "nonempty query stays expanded");
    await page.getByRole("button", { name: "清除搜索", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开搜索");
    assert.equal(await page.getByRole("searchbox", { name: "搜索日子" }).count(), 0, "clear collapses mobile search");
    await page.getByRole("button", { name: "打开搜索", exact: true }).click();
    await page.getByRole("button", { name: "收起搜索", exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开搜索");
    await page.setViewportSize({ width: 320, height: 740 });
    const lastChip = page.locator(".filters button").last();
    await lastChip.scrollIntoViewIfNeeded();
    const chip = await lastChip.boundingBox(), strip = await page.locator(".filters").boundingBox();
    assert.ok(chip.x >= strip.x && chip.x + chip.width <= strip.x + strip.width, "last chip can scroll into view at 320px");
    assert.ok(chip.width >= 44 && chip.height >= 44);
    await page.evaluate(async () => {
      const { db } = await import("/src/storage.ts");
      const source = (await db.days.toArray())[0];
      await db.days.bulkPut(Array.from({ length: 8 }, (_, index) => ({ ...source, id: "chrome-scroll-" + index, title: "列表滚动验收 " + index })));
    });
    await page.reload();
    await page.locator(".day-card").first().waitFor();

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      await noOverflow(`${width}px`);
      for (const selector of [
        ".header-add",
        ".header-backup",
        ".pin-button",
        ".filters button",
      ]) {
        const bounds = await page.locator(selector).first().boundingBox();
        assert.ok(
          bounds.width >= 44 && bounds.height >= 44,
          selector + ": touch target",
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await inset(32, 0, 24, 0);
    await page.evaluate(() => scrollTo(0, 420));
    await page.waitForFunction(() => Math.abs(document.querySelector(".toolbar").getBoundingClientRect().top - document.querySelector(".site-header").getBoundingClientRect().bottom) <= 1);
    const header = await page.locator(".site-header").boundingBox();
    const toolbar = await page.locator(".toolbar").boundingBox();
    assert.ok(Math.abs(toolbar.y - (header.y + header.height)) <= 1, "sticky list toolbar sits directly below header without overlap or gap");
    const add = await page.locator(".header-add").boundingBox();
    assert.equal(header.y, 0, "header stays at viewport top while scrolling");
    assert.ok(add.y >= 32, "toolbar clears status bar");
    assert.equal(
      await page
        .locator(".site-header")
        .evaluate((el) => getComputedStyle(el).paddingTop),
      "32px",
      "safe top applied once",
    );
    await audit("scrolled with safe-area");
    await page.screenshot({ path: ".artifacts/chrome-scrolled.png" });
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
      "modal locks background scroll",
    );
    const dialog = await page.getByRole("dialog").boundingBox();
    assert.ok(
      dialog.y >= 32 && Math.abs(dialog.y + dialog.height - 844) <= 1,
      "sheet reaches viewport bottom",
    );
    const modalBody = await page.locator(".modal-body").boundingBox();
    assert.ok(modalBody.y + modalBody.height <= 820, "sheet controls clear bottom safe area");
    assert.ok(await page.getByRole("dialog").evaluate(el => parseFloat(getComputedStyle(el).paddingBottom) >= 44), "sheet includes safe-bottom padding");
    await page.screenshot({ path: ".artifacts/chrome-editor.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "新增日子",
      "focus returns to sticky action",
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "",
      "body scroll restored",
    );

    // Landscape notch, bottom gesture area, and constrained height/keyboard approximation.
    await page.setViewportSize({ width: 844, height: 390 });
    await inset(0, 44, 21, 44);
    await page.evaluate(() => scrollTo(0, 0));
    await noOverflow("landscape");
    assert.ok((await page.locator(".brand").boundingBox()).x >= 44);
    const landscapeAdd = await page.locator(".header-add").boundingBox();
    assert.ok(landscapeAdd.x + landscapeAdd.width <= 800);
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    const shortDialog = await page.getByRole("dialog").boundingBox();
    assert.ok(shortDialog.height <= 369 && shortDialog.y >= 0);
    await page.getByLabel("日子名称").fill("横屏编辑");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    await page.setViewportSize({ width: 390, height: 844 });
    await inset(32, 0, 24, 0);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
      scrollTo(0, 0);
    });
    await noOverflow("200% text");
    await page.screenshot({
      path: ".artifacts/chrome-large-text.png",
      fullPage: true,
    });
    await audit("200% text");
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("大字号编辑");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );

    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
      contrast: "more",
    });
    await audit("dark system preference and high contrast");
    assert.equal(
      await page
        .locator(".site-header")
        .evaluate((el) => getComputedStyle(el).backdropFilter),
      "none",
    );
    await page.locator(".header-add").focus();
    await page.keyboard.down("Space");
    assert.equal(
      await page
        .locator(".header-add")
        .evaluate((el) => getComputedStyle(el).transform),
      "none",
      "reduced motion does not scale on press",
    );
    await page.keyboard.up("Space");
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: sticky header, safe-area simulation, landscape/short viewport, large text, touch targets, focus, modal scroll lock, contrast and reduced motion. Android device verification remains separate.",
    );
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
