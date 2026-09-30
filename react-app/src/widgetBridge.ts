import { registerPlugin } from "@capacitor/core";
export interface WidgetBridgePlugin {
  update(options: { json: string }): Promise<void>;
  consumeLaunchDayId(): Promise<{ dayId: string | null }>;
}
export const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge", {
  web: () => ({ update: async () => {}, consumeLaunchDayId: async () => ({ dayId: null }) }),
});
