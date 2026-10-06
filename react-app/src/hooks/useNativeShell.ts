import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { ensureExactAlarm, hasNativeNotifications } from "../notifications";
import { todayKey } from "../domain";
export default function useNativeShell({
  headerRef,
  sortMenuOpen,
  setSortMenuOpen,
  load,
  setToday,
  setNativeSyncTick,
  setWidgetLaunchTick,
}: {
  headerRef: RefObject<HTMLElement>;
  sortMenuOpen: boolean;
  setSortMenuOpen: (open: boolean) => void;
  load: () => Promise<void>;
  setToday: (today: string) => void;
  setNativeSyncTick: Dispatch<SetStateAction<number>>;
  setWidgetLaunchTick: Dispatch<SetStateAction<number>>;
}) {
  const sortMenuOpenRef = useRef(false);
  sortMenuOpenRef.current = sortMenuOpen;
  useEffect(() => {
    const header = headerRef.current!;
    const update = () =>
      document.documentElement.style.setProperty(
        "--header-offset",
        `${header.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    try {
      observer.observe(header, { box: "border-box" });
    } catch {
      observer.observe(header);
    }
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-offset");
    };
  }, []);

  useEffect(() => {
    if (!hasNativeNotifications()) return;
    const sync = () => setNativeSyncTick((value) => value + 1);
    const active = import("@capacitor/app").then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          setToday(todayKey());
          void Promise.all([load(), ensureExactAlarm()]).then(() => {
            sync();
            setWidgetLaunchTick((value) => value + 1);
          });
        }
      }),
    );

    void active.catch(() => {});
    return () => {
      void active.then((handle) => handle.remove()).catch(() => {});
    };
  }, [load]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", () => {
        if (document.querySelector('dialog[data-closing="true"]')) return;
        const open =
          document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        const dialog = open[open.length - 1];
        if (dialog)
          dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
        else if (sortMenuOpenRef.current) setSortMenuOpen(false);
        else void App.minimizeApp();
      }),
    );
    const appearance = matchMedia("(prefers-color-scheme: dark)");
    const updateBars = () => {
      if (appearance.matches)
        void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
      else
        void SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => {});
      // The installed core exposes no background API. It reads the qualified
      // native window background; the edge-to-edge WebView uses the same --bg.
    };
    updateBars();
    appearance.addEventListener("change", updateBars);
    return () => {
      appearance.removeEventListener("change", updateBars);
      void listener.then((handle) => handle.remove());
    };
  }, []);
}
