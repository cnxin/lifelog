import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "days-offline-shell",
      apply: "build",
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle)
          .filter((name) => /\.(js|css)$/.test(name))
          .map((name) => "/" + name)
          .sort();
        const version = createHash("sha256")
          .update(assets.join("|"))
          .digest("hex")
          .slice(0, 12);
        const template = readFileSync(
          new URL("./public/sw.js", import.meta.url),
          "utf8",
        );
        const source = template
          .replace(
            "const BUILD_ASSETS = [];",
            "const BUILD_ASSETS = " + JSON.stringify(assets) + ";",
          )
          .replace("days-v1", "days-" + version);
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
  build: {
    target: "es2020",
    sourcemap: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("lunar-javascript")) return "lunar";
          if (id.includes("dexie")) return "storage";
          if (
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react/")
          )
            return "react";
        },
      },
    },
  },
});
