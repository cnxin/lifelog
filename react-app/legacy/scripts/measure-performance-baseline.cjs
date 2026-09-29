const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const appVersion = require(path.join(root, 'package.json')).version;
const outputPath = path.resolve(process.env.LIFELOG_PERF_OUTPUT || path.join(repoRoot, 'docs', 'performance-baseline-web.json'));
const port = Number(process.env.LIFELOG_PERF_PORT || 4177);
const externalUrl = process.env.LIFELOG_PERF_BASE_URL;
const baseUrl = externalUrl || `http://127.0.0.1:${port}`;
const coldStartRuns = Number(process.env.LIFELOG_PERF_COLD_RUNS || 5);
const memoryCount = 500;
const photoCount = 100;
let server;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer() {
  if (externalUrl) return;
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true
  });
}

function isReady() {
  return new Promise((resolve) => {
    const request = http.get(baseUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForApp() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isReady()) return;
    await delay(500);
  }
  throw new Error(`Performance test server did not become available at ${baseUrl}`);
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function round(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function measureColdStarts(browser) {
  const samples = [];
  for (let run = 0; run < coldStartRuns; run += 1) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const startedAt = performance.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.locator('.home-composer').waitFor({ state: 'visible', timeout: 180000 });
    samples.push(performance.now() - startedAt);
    await context.close();
  }
  return {
    runs: samples.map((value) => round(value)),
    medianMs: round(percentile(samples, 0.5)),
    p95Ms: round(percentile(samples, 0.95))
  };
}

async function seedPerformanceData(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.locator('.home-composer').waitFor({ state: 'visible', timeout: 180000 });
  return page.evaluate(async ({ memoryCount, photoCount }) => {
    const requestValue = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transactionDone = (transaction) => new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
    const db = await requestValue(indexedDB.open('LifeLogDatabase'));
    const transaction = db.transaction(['memories', 'photos'], 'readwrite');
    const memoriesStore = transaction.objectStore('memories');
    const photosStore = transaction.objectStore('photos');
    const seed = await requestValue(memoriesStore.get('m1'));
    const imageBytes = new Uint8Array(16 * 1024);
    imageBytes.fill(97);
    const imageBlob = new Blob([imageBytes], { type: 'image/jpeg' });
    const memories = [];
    const photos = [];

    for (let index = 0; index < memoryCount; index += 1) {
      const id = `perf-memory-${String(index).padStart(4, '0')}`;
      const photoId = index < photoCount ? `perf-photo-${String(index).padStart(3, '0')}` : '';
      memories.push({
        ...seed,
        id,
        title: `性能基线记录 ${String(index + 1).padStart(3, '0')}`,
        date: '2026-07-20',
        content: '固定长度的本地性能基线正文，用于验证长列表窗口渲染。',
        tags: ['性能基线'],
        photos: photoId ? [photoId] : []
      });
      if (photoId) {
        photos.push({
          id: photoId,
          memoryId: id,
          originalBlob: imageBlob,
          thumbnailBlob: imageBlob,
          width: 320,
          height: 240,
          fileSize: imageBlob.size,
          mimeType: imageBlob.type,
          uploadedAt: '2026-07-20T00:00:00.000Z',
          order: 0
        });
      }
    }

    memoriesStore.clear();
    photosStore.clear();
    memories.forEach((memory) => memoriesStore.put(memory));
    photos.forEach((photo) => photosStore.put(photo));
    await transactionDone(transaction);
    db.close();
    return { memories: memories.length, photos: photos.length, photoBytes: imageBlob.size * photos.length };
  }, { memoryCount, photoCount });
}

async function measureMemoryList(page) {
  const startedAt = performance.now();
  await page.goto(`${baseUrl}/memories`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.locator('.content-list--memories .memory-card').first().waitFor({ state: 'visible', timeout: 180000 });
  const visibleMs = performance.now() - startedAt;
  const listMeta = await page.locator('.content-list--memories').first().evaluate((element) => {
    const windowedList = element.querySelector('.windowed-list');
    return {
      virtualized: Boolean(windowedList),
      renderedItems: element.querySelectorAll('.memory-card').length,
      estimatedHeight: Math.round((windowedList || element).getBoundingClientRect().height)
    };
  });
  const scroll = await page.evaluate(async () => {
    const windowedList = document.querySelector('.content-list--memories .windowed-list');
    let candidate = windowedList?.parentElement || null;
    let scrollRoot = null;
    while (candidate) {
      const overflowY = getComputedStyle(candidate).overflowY;
      if (['auto', 'scroll', 'overlay'].includes(overflowY) && candidate.scrollHeight > candidate.clientHeight + 1) {
        scrollRoot = candidate;
        break;
      }
      candidate = candidate.parentElement;
    }
    scrollRoot ||= document.scrollingElement;
    if (!(scrollRoot instanceof HTMLElement)) throw new Error('Page scroll container was not found');
    scrollRoot.style.scrollBehavior = 'auto';
    const intervals = [];
    const startTop = scrollRoot.scrollTop;
    const maxTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const step = Math.max(1, maxTop / 120);
    let previous = performance.now();
    const startedAt = previous;
    for (let frame = 0; frame < 120 && scrollRoot.scrollTop < maxTop; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      intervals.push(now - previous);
      previous = now;
      scrollRoot.scrollTop = Math.min(maxTop, startTop + (frame + 1) * step);
    }
    scrollRoot.scrollTop = maxTop;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      durationMs: performance.now() - startedAt,
      distancePx: scrollRoot.scrollTop - startTop,
      finalTop: scrollRoot.scrollTop,
      maxTop,
      scrollRoot: scrollRoot === document.scrollingElement ? 'document' : scrollRoot.className || scrollRoot.tagName,
      intervals
    };
  });
  return {
    visibleMs: round(visibleMs),
    ...listMeta,
    scroll: {
      durationMs: round(scroll.durationMs),
      distancePx: Math.round(scroll.distancePx),
      reachedEnd: Math.abs(scroll.finalTop - scroll.maxTop) <= 2,
      scrollRoot: scroll.scrollRoot,
      frameCount: scroll.intervals.length,
      medianFrameMs: round(percentile(scroll.intervals, 0.5), 2),
      p95FrameMs: round(percentile(scroll.intervals, 0.95), 2),
      maxFrameMs: round(Math.max(...scroll.intervals), 2),
      framesOver50Ms: scroll.intervals.filter((value) => value > 50).length
    }
  };
}

async function measureThumbnailBackup(page) {
  await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.locator('[role=tab]').nth(2).click();
  await page.locator('.backup-photo-mode-row').waitFor({ state: 'visible', timeout: 180000 });
  await page.locator('.backup-photo-mode-row button').filter({ hasText: '仅缩略图' }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
  const startedAt = performance.now();
  await page.getByRole('button', { name: /导出缩略图备份/ }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const elapsedMs = performance.now() - startedAt;
  const sizeBytes = filePath ? fs.statSync(filePath).size : 0;
  return {
    elapsedMs: round(elapsedMs),
    fileName: download.suggestedFilename(),
    sizeBytes
  };
}

async function main() {
  startServer();
  await waitForApp();
  const browser = await chromium.launch();
  try {
    const coldStart = await measureColdStarts(browser);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    const seed = await seedPerformanceData(page);
    const memoryList = await measureMemoryList(page);
    const thumbnailBackup = await measureThumbnailBackup(page);
    if (seed.memories !== memoryCount || seed.photos !== photoCount) {
      throw new Error(`Performance seed mismatch: ${JSON.stringify(seed)}`);
    }
    if (!memoryList.virtualized || memoryList.renderedItems >= memoryCount) {
      throw new Error(`Memory list virtualization was not active: ${JSON.stringify(memoryList)}`);
    }
    if (!memoryList.scroll.reachedEnd || memoryList.scroll.frameCount < 100) {
      throw new Error(`Memory list scroll sample was incomplete: ${JSON.stringify(memoryList.scroll)}`);
    }
    if (!thumbnailBackup.sizeBytes || !thumbnailBackup.fileName.startsWith('lifelog-backup-thumbs-')) {
      throw new Error(`Thumbnail backup download was not completed: ${JSON.stringify(thumbnailBackup)}`);
    }
    const result = {
      schemaVersion: 1,
      measuredAt: new Date().toISOString(),
      environment: {
        kind: 'desktop-web-headless-chromium',
        appVersion,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        playwright: require('playwright/package.json').version,
        viewport: '390x844',
        productionBuild: true,
        note: 'This desktop Web baseline does not replace Android device UAT.'
      },
      dataSet: seed,
      coldStart,
      memoryList,
      thumbnailBackup
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    console.log(`Performance baseline written to ${outputPath}`);
    await context.close();
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch((error) => {
  if (server) server.kill();
  console.error(error);
  process.exit(1);
});
