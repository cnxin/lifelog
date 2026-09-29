import { Capacitor } from "@capacitor/core";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // The old APK registered /sw.js too. Skipping registration alone leaves it alive.
  if (Capacitor.isNativePlatform()) {
    void clearNativeWebCache().catch((error) => {
      console.warn("Old offline cache cleanup failed", error);
    });
    return;
  }
  if (!import.meta.env.PROD) return;
  const register = () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Offline cache unavailable", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  // New workers wait for old tabs to close. Never reload an unsaved editor.
}

export async function clearNativeWebCache() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const owned = [registration.active, registration.waiting, registration.installing]
      .some((worker) => {
        if (!worker) return false;
        const url = new URL(worker.scriptURL);
        return url.origin === location.origin && url.pathname === "/sw.js";
      });
    if (owned) await registration.unregister();
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("lifelog-static-") || key.startsWith("lifelog-runtime-"))
      .map((key) => caches.delete(key)));
  }
  // Never touch IndexedDB/localStorage or reload an editor. Existing controlled
  // documents release their worker when closed; verify cold restart on a device.
}
