import {defineConfig} from "vitest/config";

// Integration tests run against the Firebase emulators:
// run them through `npm run test:integration` at the repo root.
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
