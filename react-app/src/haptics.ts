import { Capacitor } from "@capacitor/core";

type Kind = "light" | "medium" | "success";
export async function haptic(kind: Kind = "light") {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } =
      await import("@capacitor/haptics");
    if (kind === "success")
      await Haptics.notification({ type: NotificationType.Success });
    else
      await Haptics.impact({
        style: kind === "light" ? ImpactStyle.Light : ImpactStyle.Medium,
      });
  } catch {}
}
