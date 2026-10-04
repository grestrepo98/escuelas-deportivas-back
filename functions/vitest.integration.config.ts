import {resolve} from "node:path";
import {defineConfig} from "vitest/config";

// Integration tests run against the Firebase emulators:
// run them through `npm run test:integration` at the repo root.
export default defineConfig({
  resolve: {
    alias: {
      "@escuelas/domain": resolve(
        __dirname,
        "../packages/domain/src/index.ts",
      ),
    },
  },
  test: {
    include: ["test/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
