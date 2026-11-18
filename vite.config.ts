import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // lovable-tagger is only available in the Lovable platform environment
  let componentTagger: (() => unknown) | null = null;
  if (mode === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      componentTagger = require("lovable-tagger").componentTagger;
    } catch {
      // Not available outside Lovable platform — skip silently
    }
  }

  return {
    server: {
      host: "::",
      port: 5173,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      minify: "terser",
      chunkSizeWarningLimit: 1000,
    },
    plugins: ([
      react(),
      mode === "development" && componentTagger ? componentTagger() : null,
    ].filter(Boolean) as any),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
