import {defineConfig} from "vitest/config";

// Rules tests need the Firestore and Storage emulators:
// run them through `npm run test:rules` at the repo root.
export default defineConfig({
  test: {
    include: ["test/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
