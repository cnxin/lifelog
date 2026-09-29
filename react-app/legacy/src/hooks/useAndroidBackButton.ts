import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useAndroidBackButton(onCloseSheet?: () => boolean) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", () => {
      if (document.querySelector(".photo-viewer-overlay")) {
        window.dispatchEvent(new Event("lifelog:close-photo-viewer"));
        return;
      }
      if (onCloseSheet?.()) return;
      if (location.pathname !== "/") {
        navigate(-1);
      }
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate, onCloseSheet]);
}
