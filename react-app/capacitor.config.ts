import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cnxin.lifelog",
  appName: "LifeLog · 日子",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
    },
  },
};

export default config;
