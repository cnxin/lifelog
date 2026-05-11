import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useStatusBar(themeStyle: string) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      if (cancelled) return;

      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setBackgroundColor({ color: "#00000000" });

      const isDark =
        themeStyle === "mist" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    });

    return () => {
      cancelled = true;
    };
  }, [themeStyle]);
}
