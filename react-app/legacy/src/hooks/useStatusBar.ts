import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useStatusBar(themeStyle: string) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      if (cancelled) return;

      StatusBar.setOverlaysWebView({ overlay: false });
      StatusBar.setBackgroundColor({ color: themeStatusBarColor(themeStyle) });

      const isDark = themeStyle === "dark";
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    });

    return () => {
      cancelled = true;
    };
  }, [themeStyle]);
}

function themeStatusBarColor(themeStyle: string) {
  if (themeStyle === "cream") return "#fff8ed";
  if (themeStyle === "mint") return "#effaf5";
  if (themeStyle === "mist") return "#f4f7fb";
  return "#f8f5ff";
}
