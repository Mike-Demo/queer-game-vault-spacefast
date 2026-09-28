import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const shim = (name: string) => path.resolve(repoRoot, "src/spa/shims", name);

/**
 * Standalone SPA build for the SpaceFast preview.
 *
 * Entry: spa.html -> src/spa/main.tsx. Output: dist-spa/.
 *
 * The `@/*` prefix alias maps to `src/`, but the exact-module aliases below
 * must win over it (alias order matters): they swap the TanStack Start server
 * functions, the Supabase client, and the Lovable auth helper for
 * fetch-backed preview shims so no server-only code
 * (`src/routes/api/**`, `*.server.ts`, `@tanstack/react-start` server
 * modules) can be reached from the bundle.
 *
 * No `@tanstack/react-start` plugin is included — this is a plain client-side
 * React app.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/lib/publicContent.functions", replacement: shim("publicContent.ts") },
      // src/lib/publicData.ts imports the same module via a relative specifier.
      { find: "./publicContent.functions", replacement: shim("publicContent.ts") },
      { find: "@/lib/tracking.functions", replacement: shim("tracking.ts") },
      { find: "@/lib/emojiOracle.functions", replacement: shim("emojiOracle.ts") },
      { find: "@/lib/igdb.functions", replacement: shim("igdb.ts") },
      { find: "@/lib/editorial.functions", replacement: shim("editorial.ts") },
      { find: "@/integrations/supabase/client", replacement: shim("supabaseClient.ts") },
      { find: "@/integrations/lovable", replacement: shim("lovable.ts") },
      // Compatibility: reused route/hook/theme files import these directly.
      { find: "@tanstack/react-start/server", replacement: shim("reactStartServer.ts") },
      { find: "@tanstack/react-start", replacement: shim("reactStart.ts") },
      { find: "@", replacement: path.resolve(repoRoot, "src") },
    ],
  },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(repoRoot, "spa.html"),
    },
  },
});
