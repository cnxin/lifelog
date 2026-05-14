// LifeLog Service Worker
// 缓存策略：
// - 导航请求（HTML）：网络优先，离线回退到缓存的 index.html
// - 静态资源（JS/CSS/图片/字体）：缓存优先 + 后台更新
// - 不缓存：第三方请求、非 GET 请求

const VERSION = "v3";
const STATIC_CACHE = `lifelog-static-${VERSION}`;
const RUNTIME_CACHE = `lifelog-runtime-${VERSION}`;

// 必须立即可用的核心资源
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/ingot.png"
];

// 安装时预缓存核心资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 激活时清理旧版本缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 只处理 GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 跳过非同源请求
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，离线回退
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源：缓存优先 + 后台更新
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 其他：网络优先
  event.respondWith(networkFirst(request));
});

// 监听跳过等待消息（用于更新提示）
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(pathname) {
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/i.test(pathname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request.mode === "navigate" ? "/index.html" : request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request.mode === "navigate" ? "/index.html" : request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkPromise) || Response.error();
}
