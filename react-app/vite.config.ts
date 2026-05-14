import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react-dom") || id.includes("react/") || id.includes("react-router")) {
            return "react-vendor";
          }
          if (id.includes("dexie")) {
            return "db-vendor";
          }
          if (id.includes("lunar-javascript")) {
            return "lunar-vendor";
          }
          if (id.includes("@capacitor")) {
            return "capacitor-vendor";
          }
          if (id.includes("lucide-react")) {
            return "icons-vendor";
          }
          if (id.includes("browser-image-compression") || id.includes("uuid")) {
            return "utils-vendor";
          }
          return "vendor";
        },
      },
    },
  },
});
