type UpdateCallback = () => void;

let updateCallback: UpdateCallback | null = null;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // 检测新版本
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // 新版本安装完成，旧版本仍在控制
              updateCallback?.();
            }
          });
        });

        // 每小时检查一次更新
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });

    // 监听控制器变化（新 SW 接管）
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

export function onServiceWorkerUpdate(callback: UpdateCallback) {
  updateCallback = callback;
}

export async function applyServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}
