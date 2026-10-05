import {defineConfig} from "vitest/config";

// Unit tests live in test/unit (mirroring src/) and need no emulator.
// Integration tests are *.integration.test.ts (vitest.integration.config.ts).
export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
  },
});
