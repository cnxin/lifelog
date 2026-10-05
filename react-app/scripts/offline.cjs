const { chromium } = require("./lib/browser.cjs");
const { assert } = require("./lib/browser.cjs");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:5189");
    await page.getByRole("button", { name: "新增日子", exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "新增日子", exact: true }).click();
    await page.getByLabel("日子名称").fill("离线也能记住");
    await page
      .getByRole("button", { name: "记下这个日子", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page
      .locator(".day-grid")
      .getByRole("button", { name: "查看：离线也能记住", exact: true })
      .waitFor();
    assert.equal(await page.locator(".day-card").count(), 1);
    console.log(
      "PASS: first-visit precache, offline reload, offline create and persistence.",
    );
    // Exercise native cache retirement with a real browser worker, not a phone.
    const nativeContext = await browser.newContext({ bypassCSP: true });
    const nativePage = await nativeContext.newPage();
    await nativePage.goto(process.env.BASE_URL || "http://127.0.0.1:5189");
    await nativePage.getByRole("button", { name: "新增日子", exact: true }).waitFor();
    await nativePage.evaluate(() => navigator.serviceWorker.ready);
    await nativePage.waitForFunction(() => !!navigator.serviceWorker.controller);
    await nativePage.evaluate(async () => {
      localStorage.setItem("lifelog-react-state-v1", '{"people":[]}');
      await caches.open("lifelog-static-v3");
      await caches.open("unrelated-cache");
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("LifeLogDatabase", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("memories");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("memories", "readwrite");
          tx.objectStore("memories").put({ title: "旧回忆", photo: new Blob(["photo-fixture"]) }, "keep");
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
    });
    const compiled = ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/registerServiceWorker.ts"), "utf8").replaceAll("import.meta.env.PROD", "true"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
    ).outputText;
    const result = await nativePage.evaluate(async (code) => {
      const exported = {};
      new Function("require", "exports", code)(() => ({ Capacitor: { isNativePlatform: () => true } }), exported);
      await exported.clearNativeWebCache();
      const record = await new Promise((resolve, reject) => {
        const request = indexedDB.open("LifeLogDatabase");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("memories", "readonly");
          const get = tx.objectStore("memories").get("keep");
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
          tx.oncomplete = () => db.close();
        };
      });
      return {
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
        keys: await caches.keys(),
        local: localStorage.getItem("lifelog-react-state-v1"),
        title: record.title, photo: await record.photo.text(),
      };
    }, compiled);
    assert.equal(result.registrations, 0);
    assert.ok(!result.keys.some(key => key.startsWith("lifelog-static-") || key.startsWith("lifelog-runtime-")));
    assert.ok(result.keys.includes("unrelated-cache"));
    assert.equal(result.local, '{"people":[]}');
    assert.equal(result.title, "旧回忆");
    assert.equal(result.photo, "photo-fixture");
    await nativeContext.close();
    console.log("PASS: simulated native cache cleanup with real service worker; old IndexedDB photo and localStorage unchanged.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
