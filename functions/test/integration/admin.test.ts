import {initializeApp} from "firebase-admin/app";
import {describe, expect, it} from "vitest";
import {firestore} from "../../src/shared/admin.js";

// Regression: in Cloud Functions the runtime may already have created apps
// with other names. `firestore()` must still make sure the *default* app
// exists (it threw "app/no-app" in dev while passing in the emulator).
describe("firestore()", () => {
  it("initializes the default app even if a named app already exists", () => {
    initializeApp({projectId: "demo-admin-test"}, "runtime-owned-app");
    expect(() => firestore()).not.toThrow();
  });

  it("returns the same instance on later calls", () => {
    expect(firestore()).toBe(firestore());
  });
});
