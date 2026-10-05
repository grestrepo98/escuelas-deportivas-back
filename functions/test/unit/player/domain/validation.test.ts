import {describe, expect, it} from "vitest";
import {
  validateBirthDate,
  validateRequiredText,
} from "../../../../src/player/domain/validation.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

function invalidArgument(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("invalid_argument");
    return;
  }
  throw new Error("expected DomainError invalid_argument");
}

describe("validateRequiredText", () => {
  it("trims and returns the value", () => {
    expect(validateRequiredText("  Juan  ", "firstNames")).toBe("Juan");
  });

  it("rejects blank text and names the field", () => {
    invalidArgument(() => validateRequiredText("   ", "firstNames"));
    expect(() => validateRequiredText("", "lastNames")).toThrow(/lastNames/);
  });
});

describe("validateBirthDate", () => {
  const now = new Date("2026-10-04T12:00:00Z");

  it("accepts a past date", () => {
    expect(validateBirthDate("2014-05-01", now)).toBe("2014-05-01");
  });

  it("accepts today", () => {
    expect(validateBirthDate("2026-10-04", now)).toBe("2026-10-04");
  });

  it("rejects a future date", () => {
    invalidArgument(() => validateBirthDate("2026-10-05", now));
  });

  it("rejects a wrong format", () => {
    invalidArgument(() => validateBirthDate("01/05/2014", now));
    invalidArgument(() => validateBirthDate("2014-5-1", now));
  });

  it("rejects a date that does not exist", () => {
    invalidArgument(() => validateBirthDate("2014-02-30", now));
    invalidArgument(() => validateBirthDate("2014-13-01", now));
  });

  it("rejects an implausibly old date", () => {
    invalidArgument(() => validateBirthDate("1899-12-31", now));
  });
});
