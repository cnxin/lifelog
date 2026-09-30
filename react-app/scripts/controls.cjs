const { pickDate } = require("./date-picker-helper.cjs");
const { hitTarget } = require('./hit-target.cjs');
// Isolated browser profile: never touches the user's local records.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
    assert.deepEqual(violations, [], label);
  };
  const inputAppearance = async (input, shell = input, multiline = false) => {
    await input.focus();
    const appearance = await shell.evaluate((el) => {
      const css = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const field = el.matches('input, textarea') ? el : el.querySelector('input');
      return {
        height: rect.height, radius: css.borderRadius, border: css.borderWidth,
        borderColor: css.borderColor, background: css.backgroundColor,
        padding: css.paddingInlineStart, fontSize: getComputedStyle(field).fontSize,
        outline: getComputedStyle(field).outlineStyle, shadow: css.boxShadow,
        placeholder: field.hasAttribute('placeholder')
          ? getComputedStyle(field, '::placeholder').color
          : null,
        placeholderToken: css.getPropertyValue('--input-placeholder').trim(),
        ring: css.getPropertyValue('--input-focus-ring').trim(),
      };
    });
    if (!multiline) assert.equal(appearance.height, 44, 'shared input height');
    assert.equal(appearance.radius, '12px');
    assert.equal(appearance.border, '1px');
    assert.equal(appearance.borderColor, 'rgb(128, 155, 116)');
    assert.equal(appearance.background, 'rgb(255, 255, 255)');
    assert.equal(appearance.padding, '14px');
    assert.equal(appearance.fontSize, '15px');
    assert.equal(appearance.placeholderToken, '#9aa394');
    if (appearance.placeholder !== null)
      assert.equal(appearance.placeholder, 'rgb(154, 163, 148)');
    assert.equal(appearance.outline, 'none', 'input outline replaced, not doubled');
    assert.match(appearance.shadow, /rgb\(97, 118, 80\) 0px 0px 0px 2px/);
    const luminance = (hex) => {
      const values = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
        .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
    };
    for (const background of ['#ffffff', '#fcfdfb', '#f7f8fa']) {
      const levels = [luminance(appearance.ring), luminance(background)].sort((a,b) => a-b);
      assert.ok((levels[1] + .05) / (levels[0] + .05) >= 3,
        'solid focus ring >=3:1 against input and adjacent backgrounds');
    }
  };
  try {
    await fs.mkdir(".artifacts", { recursive: true });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5188");
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("我们的纪念日");
    await inputAppearance(page.getByLabel('日子名称'));
    const firstRing = await page.getByLabel('日子名称').evaluate(el => {
      const input = el.getBoundingClientRect(), body = el.closest('.modal-body').getBoundingClientRect();
      return input.top - 3 >= body.top && input.left - 3 >= body.left;
    });
    assert.ok(firstRing, 'first input focus ring is not clipped by the modal body');
    await inputAppearance(page.locator('.editor-fields textarea'), undefined, true);
    await pickDate(page, "2024-05-20");
    await page.locator('.date-trigger').click();
    await page.getByRole('button', {name: '切换年月', exact: true}).click();
    await inputAppearance(page.getByLabel('年份', {exact: true}));
    await page.getByRole('button', {name: '收起', exact: true}).click();
    const category = page.getByRole("group", { name: "分类", exact: true });
    const radios = category.getByRole("radio");
    assert.equal(await radios.count(), 3);
    await category.getByRole("radio", { name: "生日", exact: true }).check();
    await page.keyboard.press("ArrowRight");
    assert.ok(
      await category
        .getByRole("radio", { name: "倒数日", exact: true })
        .isChecked(),
      "native arrow-key navigation",
    );
    await page.keyboard.press("ArrowLeft");
    assert.ok(
      await category
        .getByRole("radio", { name: "生日", exact: true })
        .isChecked(),
    );
    const repeat = page.getByRole("checkbox", {
      name: "每年重复",
      exact: true,
    });
    const pin = page.getByRole("checkbox", {
      name: "置顶这个日子",
      exact: true,
    });
    await repeat.focus();
    await page.keyboard.press("Space");
    assert.ok(await repeat.isChecked(), "space toggles repeat");
    await page.getByRole("radio", { name: "农历", exact: true }).check();
    // The full label is a touch target, not just the 24px visual checkbox.
    await page.locator("#pin-label").click();
    assert.ok(await pin.isChecked());
    await pin.focus();
    await page.keyboard.press("Space");
    assert.equal(await pin.isChecked(), false, "space unchecks pin");
    await page.locator("#pin-help").click();
    assert.ok(await pin.isChecked(), "helper text toggles checkbox");
    await repeat.uncheck();
    assert.equal(
      await page.getByRole("radio", { name: "农历", exact: true }).count(),
      0,
    );
    await repeat.check();
    assert.ok(
      await page.getByRole("radio", { name: "公历", exact: true }).isChecked(),
      "repeat off resets calendar",
    );
    await page.getByRole("radio", { name: "农历", exact: true }).check();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page
          .locator(".modal")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${width}: no editor overflow`,
      );
      const rows = await page
        .locator(".check-row")
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().height),
        );
      assert.ok(
        rows.every((height) => height >= 48),
        "checkbox rows have 48px touch targets",
      );
      const boxes = await page
        .getByRole("dialog")
        .getByRole("radio")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { width: r.width, height: r.height };
          }),
        );
      for (const box of boxes)
        assert.ok(box.width >= 44 && box.height >= 44, "radio target >=44px");
      if (width === 390)
        await page
          .getByRole("dialog")
          .screenshot({ path: ".artifacts/controls-editor-mobile.png" });
      if (width === 1440)
        await page
          .getByRole("dialog")
          .screenshot({ path: ".artifacts/controls-editor-desktop.png" });
    }
    await audit("editor controls accessibility");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    assert.ok(
      await page
        .locator(".modal")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      "200% editor overflow",
    );
    await audit("200% editor accessibility");
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    assert.notEqual(
      await repeat.evaluate(
        (el) => getComputedStyle(el, "::after").borderBottomColor,
      ),
      await repeat.evaluate((el) => getComputedStyle(el).backgroundColor),
      "forced colors checkmark stays visible",
    );
    assert.equal(
      await repeat.evaluate((el) => getComputedStyle(el).transitionDuration),
      "0s",
      "no checkbox motion",
    );
    await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page
      .locator(".day-grid")
      .getByRole("button", { name: "查看：我们的纪念日", exact: true })
      .click();
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    assert.ok(
      await page.getByRole("radio", { name: "生日", exact: true }).isChecked(),
    );
    assert.ok(await repeat.isChecked());
    assert.ok(await pin.isChecked());
    assert.ok(
      await page.getByRole("radio", { name: "农历", exact: true }).isChecked(),
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    // Every filter has equal geometry and centered icon+text, regardless of selection.
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const buttons = page
        .getByRole("group", { name: "按分类筛选" })
        .getByRole("button");
      for (let selected = 0; selected < 4; selected++) {
        await buttons.nth(selected).click();
        assert.equal(
          await buttons.nth(selected).getAttribute("aria-pressed"),
          "true",
        );
        const positions = await buttons.evaluateAll((els) =>
          els.map((el) => {
            const box = el.getBoundingClientRect();
            const icon = el.querySelector("svg").getBoundingClientRect();
            const text = [...el.childNodes].find(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
            );
            const range = document.createRange();
            range.selectNodeContents(text);
            const label = range.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              offset: Math.abs(
                (icon.left + label.right) / 2 - (box.left + box.right) / 2,
              ),
            };
          }),
        );
        for (const p of positions) {
          assert.ok(
            Math.abs(p.width - positions[0].width) <= 1,
            `${width}: equal filter widths`,
          );
          assert.equal(p.height, positions[0].height, "equal filter heights");
          assert.ok(p.offset <= 1, `${width}: icon+text centered`);
        }
      }
      if (width === 390) {
        await buttons.nth(2).click();
        await page
          .locator(".days-section")
          .screenshot({ path: ".artifacts/controls-filters-mobile.png" });
      }
    }
    // Sorting stays content-sized; only the search field absorbs spare space.
    for (const width of [320, 390, 600, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width <= 760) {
        const select = page.getByRole("button", { name: "排序方式", exact: true });
        await select.waitFor();
        await page.getByRole('button', {name: '打开搜索', exact: true}).waitFor();
        assert.equal(await select.count(), 1);
        const filter = await page.locator(".filters").boundingBox();
        const toggle = await page.locator(".search-toggle").boundingBox();
        const sorting = await select.boundingBox();
        const toggleHit = await hitTarget(page.locator('.search-toggle'));
        const sortingHit = await hitTarget(select);
        assert.ok(toggleHit.width >= 44 && toggleHit.height >= 44 && toggleHit.painted, 'search hit area >=44px, including pseudo-element');
        assert.ok(sortingHit.width >= 44 && sortingHit.height >= 44 && sortingHit.painted, 'sort hit area >=44px, including pseudo-element');
        assert.ok(Math.abs(toggle.y - sorting.y) <= 1, "mobile actions share one row");
        assert.ok(filter.x + filter.width <= toggle.x, "chips do not overlap actions");
        assert.ok(sorting.x + sorting.width <= width, "mobile sort fits viewport");
        await page.mouse.click(sorting.x + sorting.width / 2, sorting.y - 3);
        await page.getByRole('menu', {name: '排序方式', exact: true}).waitFor();
        await page.keyboard.press('Escape');
        await page.mouse.click(toggle.x + toggle.width / 2, toggle.y - 3);
        await page.getByRole('searchbox', {name: '搜索日子', exact: true}).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('button', {name: '打开搜索', exact: true}).waitFor();
        continue;
      }
      await page.getByRole("button", { name: "排序方式", exact: true }).waitFor();
      await page.getByRole("searchbox", { name: "搜索日子", exact: true }).waitFor();
      const layout = await page.evaluate(() => {
        const box = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
          };
        };
        return {
          sort: box(".sort"),
          search: box(".search"),
          tools: box(".list-tools"),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(layout.overflow, false, "no toolbar overflow");
      await inputAppearance(page.getByRole('searchbox', {name: '搜索日子', exact: true}), page.locator('.search'));
      assert.ok(layout.sort.width <= 240, "sorting does not stretch");
      assert.ok(
        Math.abs(layout.sort.right - layout.tools.right) < 1,
        "sorting is right aligned",
      );
      assert.equal(
        layout.search.height,
        44,
        "search uses the shared 44px input height",
      );
      if (width >= 600)
        assert.ok(
          Math.abs((layout.sort.y + layout.sort.height / 2) -
            (layout.search.y + layout.search.height / 2)) < 1,
          "search and sorting share a centered row when space permits",
        );
      else
        assert.ok(
          layout.sort.y >= layout.search.y + layout.search.height,
          "narrow screens wrap sorting",
        );
      if (width === 390 || width === 1440)
        await page
          .locator(".days-section")
          .screenshot({ path: ".artifacts/sort-" + width + ".png" });
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.getByRole("button", { name: "排序方式", exact: true }).waitFor();
    await page.getByRole("button", { name: "打开搜索", exact: true }).waitFor();
    const largeText = await page.addStyleTag({
      content: ":root { font-size: 200% !important; }",
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "sorting fits at 200% text",
    );
    await audit("large-text toolbar accessibility");
    await largeText.evaluate((el) => el.remove());
    const sortButton = page.getByRole("button", { name: "排序方式", exact: true });
    const menu = page.getByRole("menu", { name: "排序方式", exact: true });
    assert.equal(await sortButton.getAttribute("aria-haspopup"), "menu");
    await sortButton.click();
    assert.equal(await sortButton.getAttribute("aria-expanded"), "true");
    const nearby = menu.getByRole("menuitemradio", { name: "临近优先", exact: true });
    const byDate = menu.getByRole("menuitemradio", { name: "日期从新到旧", exact: true });
    assert.ok(await nearby.evaluate(el => el === document.activeElement));
    await page.keyboard.press("ArrowDown");
    assert.ok(await byDate.evaluate(el => el === document.activeElement));
    await page.keyboard.press("ArrowUp");
    assert.ok(await nearby.evaluate(el => el === document.activeElement));
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await menu.waitFor({ state: "hidden" });
    assert.ok(await sortButton.evaluate(el => el === document.activeElement));
    await page.setViewportSize({ width: 768, height: 1000 });
    await sortButton.click();
    assert.equal(await byDate.getAttribute("aria-checked"), "true", "sorting survives breakpoint change");
    assert.ok(await byDate.evaluate(el => el === document.activeElement));
    await audit("sort menu accessibility");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
    assert.ok(await sortButton.evaluate(el => el === document.activeElement));
    await sortButton.click();
    await page.locator("#days-title").click();
    await menu.waitFor({ state: "hidden" });
    assert.ok(await sortButton.evaluate(el => el === document.activeElement), "outside close returns focus");
    await sortButton.click();
    await nearby.click();
    await sortButton.click();
    assert.equal(await nearby.getAttribute("aria-checked"), "true");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("select").count(),
      0,
      "both layouts use custom sorting without native dropdowns",
    );
    await audit("filter accessibility");
    assert.deepEqual(errors, []);
    await require('./touch-hover.cjs').checkTouchHover(browser);
    await require('./reminders-ui.cjs').checkReminderUI(browser);
    console.log(
      "PASS: category/calendar keyboard radios, rounded repeat/pin checkboxes and sort radios, label taps, repeat reset, persisted values, 320–1440px equal centered filters, 200% text, forced colors, reduced motion, axe.",
    );
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
