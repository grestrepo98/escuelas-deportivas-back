import {describe, expect, it} from "vitest";
import {ROLES, isRole} from "./role.js";

describe("roles", () => {
  it("lists the six tenant roles", () => {
    expect([...ROLES].sort()).toEqual([
      "accountant",
      "adultPlayer",
      "coordinator",
      "guardian",
      "owner",
      "teacher",
    ]);
  });

  it("accepts every known role", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it.each([["superAdmin"], [""], ["OWNER"], [undefined], [null], [42]])(
    "rejects %j",
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );
});
