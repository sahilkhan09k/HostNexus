import { defineConfig } from "vitest/config";
import { resolve, dirname, isAbsolute } from "path";
import { fileURLToPath } from "url";

/**
 * Vitest config for the API (ESM TypeScript).
 *
 * TypeScript ESM projects write imports as `./foo.js` even though the file on
 * disk is `./foo.ts`. Vite's resolver doesn't automatically try `.ts` when
 * it sees `.js`, so we need a small plugin to do that substitution.
 */
function resolveJsToTs() {
  return {
    name: "resolve-js-to-ts",
    resolveId(source: string, importer: string | undefined) {
      // Only handle relative imports that end with .js
      if (!source.startsWith(".") || !source.endsWith(".js") || !importer) {
        return null;
      }

      // Normalise the importer path — on Windows, Vite sometimes passes a
      // file:// URL or a path with forward slashes
      let importerPath = importer;
      if (importerPath.startsWith("file://")) {
        importerPath = fileURLToPath(importerPath);
      }

      // Ensure it's absolute; if not, return null and let Vite handle it
      if (!isAbsolute(importerPath)) {
        return null;
      }

      const importerDir = dirname(importerPath);
      const tsPath = resolve(importerDir, source.slice(0, -3) + ".ts");
      return tsPath;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    globals: true,
  },
});
