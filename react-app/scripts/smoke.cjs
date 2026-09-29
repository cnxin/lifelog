const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function audit(label) {
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
          summary: n.failureSummary,
        })),
      })),
    );
    assert.deepEqual(violations, [], label + " accessibility");
  }
  const base = process.env.BASE_URL || "http://127.0.0.1:5188";
  await fs.mkdir(".artifacts", { recursive: true });
  try {
    await page.goto(base);
    await page
      .getByRole("button", { name: "记下第一个日子", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".day-card").count(),
      0,
      "no fake seeded records",
    );
    await audit("empty");
    await page.screenshot({
      path: ".artifacts/empty-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("我们在一起");
    await page.getByLabel("日期", { exact: true }).fill("2024-05-20");
    await page.getByLabel("备注").fill("平凡的每一天，都因为你而特别。");
    await page.getByLabel("置顶这个日子").check();
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".day-card").count(), 1);
    await page.reload();
    await page
      .getByRole("button", { name: "编辑：我们在一起", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "编辑：我们在一起", exact: true })
      .click();
    await page.getByLabel("日子名称").fill("我们在一起的日子");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: "编辑：我们在一起的日子", exact: true })
        .count(),
      1,
    );
    await page.getByRole("button", { name: "数据与备份", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /导出备份/ }).click();
    const download = await downloadPromise;
    const exportPath = path.resolve(".artifacts/backup.json");
    await download.saveAs(exportPath);
    const backup = JSON.parse(await fs.readFile(exportPath, "utf8"));
    assert.equal(backup.days.length, 1);
    assert.equal(backup.days[0].title, "我们在一起的日子");
    // Import previews and merges without overwriting current edits.
    backup.days[0].title = "旧标题不应覆盖";
    const records = [
      {
        id: "sample-birthday",
        title: "妈妈的生日",
        date: "1970-10-18",
        category: "生日",
        repeat: "yearly",
        calendar: "solar",
        note: "记得提前准备一份小小的惊喜。",
        pinned: false,
      },
      {
        id: "sample-trip",
        title: "去大理，看一场日落",
        date: "2026-10-15",
        category: "倒数日",
        repeat: "none",
        calendar: "solar",
        note: "风吹麦浪，也吹走烦恼。",
        pinned: false,
      },
      {
        id: "sample-cat",
        title: "小橘来到家里的日子",
        date: "2023-08-12",
        category: "纪念日",
        repeat: "none",
        calendar: "solar",
        note: "从此有了毛茸茸的牵挂",
        pinned: false,
      },
      {
        id: "sample-newyear",
        title: "新的一年，新的开始",
        date: "2027-01-01",
        category: "倒数日",
        repeat: "none",
        calendar: "solar",
        note: "保持热爱，奔赴下一程",
        pinned: false,
      },
      {
        id: "sample-friend",
        title: "阿禾的生日",
        date: "1998-11-06",
        category: "生日",
        repeat: "yearly",
        calendar: "solar",
        note: "愿每一岁都自在",
        pinned: false,
      },
    ];
    await page
      .getByLabel("选择备份文件")
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ ...backup, days: [...backup.days, ...records] }),
        ),
      });
    await page
      .getByRole("button", { name: "确认合并导入", exact: true })
      .click();
    await page
      .getByText("导入完成：新增 5 个日子，已有记录没有被覆盖。")
      .waitFor();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    assert.equal(await page.locator(".day-card").count(), 6);
    assert.equal(
      await page
        .getByRole("button", { name: "编辑：旧标题不应覆盖", exact: true })
        .count(),
      0,
    );
    await page
      .locator(".toast")
      .filter({ hasText: "日子已更新" })
      .waitFor({ state: "hidden" });
    await audit("populated");
    await page.screenshot({ path: ".artifacts/desktop.png", fullPage: true });
    // Search/filter and keyboard modal behavior.
    await page.getByLabel("搜索日子").fill("大理");
    assert.equal(await page.locator(".day-card").count(), 1);
    await page.getByRole("button", { name: "清除搜索", exact: true }).click();
    await page.getByRole("button", { name: "生日", exact: true }).click();
    assert.equal(await page.locator(".day-card").count(), 2);
    await page.getByRole("button", { name: "全部", exact: true }).click();
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "新增日子", exact: true })
        .evaluate((el) => document.activeElement === el),
      true,
    );
    // Mobile layout, edit, deletion confirmation and persistence.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "no horizontal overflow",
    );
    await page.screenshot({ path: ".artifacts/mobile.png", fullPage: true });
    await page
      .getByRole("button", { name: "编辑：阿禾的生日", exact: true })
      .click();
    await audit("mobile editor");
    await page.screenshot({
      path: ".artifacts/mobile-editor.png",
      fullPage: true,
    });
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => !!document.activeElement.closest("dialog")),
        true,
        "focus remains in dialog",
      );
    }
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "保留", exact: true }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "确认删除", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page.locator(".day-card").first().waitFor();
    assert.equal(await page.locator(".day-card").count(), 5);
    // Old IndexedDB read-only migration preserves unrelated stores, repeat import is idempotent.
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("LifeLogDatabase", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("people", { keyPath: "id" });
          request.result.createObjectStore("memories", { keyPath: "id" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["people", "memories"], "readwrite");
          tx.objectStore("people").put({
            id: "old-p",
            name: "旧朋友",
            birthday: "1992-06-03",
            favorite: false,
            anniversaries: [{ title: "毕业", date: "2015-06-20" }],
          });
          tx.objectStore("memories").put({
            id: "memory",
            title: "原回忆不要删除",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
    });
    await page.getByRole("button", { name: "数据与备份", exact: true }).click();
    await audit("data panel");
    await page.getByRole("button", { name: /从本机旧版迁移/ }).click();
    await page
      .getByRole("button", { name: "确认合并导入", exact: true })
      .click();
    await page
      .getByText("导入完成：新增 2 个日子，已有记录没有被覆盖。")
      .waitFor();
    await page.getByRole("button", { name: /从本机旧版迁移/ }).click();
    await page
      .getByRole("button", { name: "确认合并导入", exact: true })
      .click();
    await page
      .getByText("导入完成：新增 0 个日子，已有记录没有被覆盖。")
      .waitFor();
    const oldMemory = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open("LifeLogDatabase");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("memories");
            const r = tx.objectStore("memories").get("memory");
            r.onsuccess = () => resolve(r.result.title);
            tx.oncomplete = () => db.close();
          };
        }),
    );
    assert.equal(oldMemory, "原回忆不要删除");
    await page
      .getByLabel("选择备份文件")
      .setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "lifelog-days",
            version: 1,
            days: [{ ...records[0], id: "bad", date: "2026-02-31" }],
          }),
        ),
      });
    await page.getByRole("alert").waitFor();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    assert.equal(
      await page.locator(".day-card").count(),
      7,
      "invalid backup changes nothing",
    );
    // Cross-tab refresh.
    const second = await context.newPage();
    await second.goto(base);
    await second.locator(".day-card").first().waitFor();
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("跨窗口同步");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await second
      .getByRole("button", { name: "编辑：跨窗口同步", exact: true })
      .waitFor();
    await second.close();
    assert.deepEqual(errors, [], "no browser runtime errors");
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "no horizontal overflow at " + width,
      );
    }
    console.log(
      "PASS: CRUD, reload persistence, pin, search/filter, export, merge/dedupe, keyboard/focus, mobile layout, read-only legacy migration, invalid import, cross-tab refresh.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
