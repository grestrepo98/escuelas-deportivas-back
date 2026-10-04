import {defineConfig} from "vitest/config";

// Unit tests live next to the code they test and need no emulator.
// Integration tests are *.integration.test.ts (vitest.integration.config.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
