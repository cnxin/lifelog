const { installAxe } = require("./lib/browser.cjs");
const { pickDate } = require("./date-picker-helper.cjs");
const { hitTarget } = require('./hit-target.cjs');
// Browser layout simulation only: this does not certify Android device insets.
const { chromium } = require("./lib/browser.cjs");
const { assert } = require("./lib/browser.cjs");
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
    await installAxe(page);
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

    // M1: measure the footer against the card, including room left by a taller card.
    const heroGeometry = () => page.locator(".hero").evaluate(el => {
      const card = el.getBoundingClientRect();
      const footer = el.querySelector(".hero-bottom").getBoundingClientRect();
      const count = el.querySelector(".hero-count").getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        height: card.height,
        display: style.display,
        direction: style.flexDirection,
        paddingBottom: parseFloat(style.paddingBottom),
        bottomGap: card.bottom - footer.bottom,
        numberToDivider: footer.top - count.bottom,
      };
    });
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      for (const width of [360, 412]) {
        await page.setViewportSize({ width, height: 740 });
        const geometry = await heroGeometry();
        const label = `${colorScheme} hero at ${width}px`;
        assert.equal(geometry.display, "flex", `${label}: flex layout`);
        assert.equal(geometry.direction, "column", `${label}: vertical layout`);
        assert.equal(geometry.paddingBottom, 24, `${label}: requested card padding`);
        assert.ok(Math.abs(geometry.bottomGap - geometry.paddingBottom) <= .5,
          `${label}: footer sits at the bottom padding`);
        assert.ok(geometry.numberToDivider >= 0 && geometry.numberToDivider <= 32,
          `${label}: no unnecessary space above the divider`);

        try {
          await page.locator(".hero").evaluate((el, height) => {
            el.style.minHeight = `${height + 24}px`;
          }, geometry.height);
          const stretched = await heroGeometry();
          assert.ok(Math.abs(stretched.bottomGap - stretched.paddingBottom) <= .5,
            `${label}: a taller card still anchors the footer`);
          assert.ok(Math.abs(stretched.numberToDivider - geometry.numberToDivider - 24) <= .5,
            `${label}: extra room goes between the count and divider`);
        } finally {
          await page.locator(".hero").evaluate(el => el.style.removeProperty("min-height"));
        }
      }
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.getByRole("button", { name: "打开搜索", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "搜索日子", exact: true });
    assert.ok(await search.evaluate(el => el === document.activeElement), "expanded search receives focus");
    await search.fill("平凡");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "打开搜索");
    assert.equal(await page.getByRole("searchbox", { name: "搜索日子" }).count(), 0, "Escape clears nonempty query and collapses mobile search");
    await page.getByRole("button", { name: "打开搜索", exact: true }).click();
    assert.equal(await search.inputValue(), "", "Escape cleared the query");
    await search.fill("平凡");
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
    const lastChipHit = await hitTarget(lastChip);
    assert.ok(lastChipHit.width >= 44 && lastChipHit.height >= 44 && lastChipHit.painted, 'scrolled chip retains an unclipped 44px hit area');
    for (const width of [320, 360, 412, 430]) {
      await page.setViewportSize({ width, height: 740 });
      await page.locator('.filters').evaluate(el => { el.scrollLeft = 0; });
      await page.waitForFunction(() => document.querySelector('.filters').dataset.atEnd === 'false');
      const stripStyle = await page.locator('.filters').evaluate(el => {
        const css = getComputedStyle(el);
        const first = el.firstElementChild.getBoundingClientRect();
        const hero = document.querySelector('.hero').getBoundingClientRect();
        return { background: css.backgroundColor, border: css.borderWidth,
          paddingTop: css.paddingTop, paddingBottom: css.paddingBottom,
          paddingLeft: css.paddingLeft, paddingRight: css.paddingRight,
          gap: css.gap, shadow: css.boxShadow, mask: css.maskImage,
          firstLeft: first.left, heroLeft: hero.left };
      });
      assert.equal(stripStyle.background, 'rgba(0, 0, 0, 0)', 'strip has no visual background');
      assert.equal(stripStyle.border, '0px');
      assert.equal(stripStyle.shadow, 'none');
      assert.equal(stripStyle.paddingTop, '0px');
      assert.equal(stripStyle.paddingBottom, '0px');
      assert.equal(stripStyle.paddingLeft, '4px');
      assert.equal(stripStyle.paddingRight, '4px');
      assert.equal(stripStyle.gap, '8px');
      assert.match(stripStyle.mask, /linear-gradient/, 'overflow has a trailing fade');
      if (width >= 360) assert.ok(Math.abs(stripStyle.firstLeft - stripStyle.heroLeft) <= .5,
        `first chip aligns with hero at ${width}px using actual rectangles`);
      await page.locator('.filters').evaluate(el => { el.scrollLeft = el.scrollWidth; });
      await page.waitForFunction(() => document.querySelector('.filters').dataset.atEnd === 'true');
      assert.equal(await page.locator('.filters').evaluate(el => getComputedStyle(el).maskImage), 'none',
        'trailing fade disappears at the scroll end');
      const last = await lastChip.boundingBox(), bounds = await page.locator('.filters').boundingBox();
      assert.ok(last.x >= bounds.x && last.x + last.width <= bounds.x + bounds.width,
        `last chip is fully visible at ${width}px`);
    }
    await page.evaluate(async () => {
      const { db } = await import("/src/storage.ts");
      const source = (await db.days.toArray())[0];
      await db.days.bulkPut(Array.from({ length: 8 }, (_, index) => ({ ...source, id: "chrome-scroll-" + index, title: "列表滚动验收 " + index })));
    });
    await page.reload();
    await page.locator(".day-card").first().waitFor();

    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      // Wait for the responsive React mode as well as the CSS breakpoint.
      await page.getByRole(width <= 760 ? 'button' : 'searchbox', {
        name: width <= 760 ? '打开搜索' : '搜索日子', exact: true,
      }).waitFor();
      await page.evaluate(() => scrollTo(0, 0));
      await noOverflow(`${width}px`);
      for (const selector of [
        ".header-add",
        ".header-backup",
        ".pin-button",
        ".filters button",
      ]) {
        const bounds = selector === '.pin-button'
          ? await page.locator(selector).first().boundingBox()
          : await hitTarget(page.locator(selector).first());
        assert.ok(
          bounds.width >= 44 && bounds.height >= 44 &&
            (selector === '.pin-button' || bounds.painted),
          selector + ": touch target",
        );
      }
      const geometry = await page.evaluate(() => {
        const box = s => {
          const r = document.querySelector(s).getBoundingClientRect();
          const css = getComputedStyle(document.querySelector(s));
          return {width: r.width, height: r.height, centerY: r.top + r.height / 2,
            font: css.fontSize, line: css.lineHeight, padding: css.paddingInlineStart,
            tracking: css.letterSpacing, marginTop: css.marginTop};
        };
        const inkLeft = s => {
          const el = document.querySelector(s), css = getComputedStyle(el);
          const range = document.createRange();
          range.selectNodeContents(el.firstChild);
          const canvas = document.createElement('canvas').getContext('2d');
          canvas.font = css.font;
          return range.getBoundingClientRect().left - canvas.measureText(el.textContent[0]).actualBoundingBoxLeft;
        };
        return {icon: box('.brand-icon'), label: box('.brand-label'),
          cn: box('.brand-cn'), caption: box('.brand-caption'),
          inkOffset: Math.abs(inkLeft('.brand-cn') - inkLeft('.brand-caption')),
          add: box('.header-add'), addIcon: box('.header-add svg'),
          backup: box('.header-backup'), toolbar: box('.toolbar'),
          chip: box('.filters button'), chipVisualHeight: (() => {
            const css = getComputedStyle(document.querySelector('.filters button'), '::after');
            return parseFloat(css.height) + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
          })(),
          chipIcon: box('.filters button svg'),
          sort: box('.sort-button'), search: innerWidth <= 760 ? box('.header-search') : null};
      });
      assert.equal(geometry.icon.width, 40);
      assert.equal(geometry.icon.height, 40);
      assert.ok(Math.abs(geometry.label.centerY - geometry.icon.centerY) <= .5, 'brand text block vertically centered');
      assert.equal(geometry.cn.font, '22px');
      assert.ok(Math.abs(parseFloat(geometry.cn.line) - 24.2) < .1);
      assert.equal(geometry.caption.font, '11px');
      assert.equal(geometry.caption.line, '11px');
      assert.equal(geometry.caption.marginTop, '2px');
      assert.ok(Math.abs(parseFloat(geometry.caption.tracking) - .44) < .01);
      assert.ok(geometry.inkOffset <= .5, 'visible Chinese/English left edges align by measured glyph bearings');
      assert.equal(geometry.add.height, 40);
      assert.equal(geometry.add.font, '14px');
      assert.equal(geometry.add.padding, '14px');
      assert.equal(geometry.addIcon.width, 18);
      assert.equal(geometry.backup.width, 40);
      assert.equal(geometry.backup.height, 40);
      assert.equal(geometry.chipVisualHeight, 36, 'painted capsule remains 36px high');
      assert.equal(geometry.chip.font, '13px');
      assert.equal(geometry.chip.padding, width <= 760 ? '10px' : '12px');
      assert.equal(geometry.chipIcon.width, 14);
      assert.equal(geometry.sort.height, 36);
      if (width <= 760) {
        assert.equal(geometry.search.width, 36);
        assert.equal(geometry.search.height, 36);
        assert.ok(geometry.toolbar.height <= 52, 'mobile toolbar <=52px including vertical padding');
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
    await require('./toolbar-search-checks.cjs')(browser);
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
