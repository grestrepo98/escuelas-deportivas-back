import {describe, expect, it} from "vitest";
import {
  validateBirthYears,
  validateName,
  validateSchedule,
} from "../../../../src/structure/domain/validation.js";
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

describe("validateName", () => {
  it("returns the trimmed name", () => {
    expect(validateName("  Sede Norte ")).toBe("Sede Norte");
  });

  it.each([[""], ["   "]])("rejects blank name %j", (value) => {
    invalidArgument(() => validateName(value));
  });
});

describe("validateBirthYears", () => {
  it("accepts integers and the empty list", () => {
    expect(validateBirthYears([2014, 2015])).toEqual([2014, 2015]);
    expect(validateBirthYears([])).toEqual([]);
  });

  it.each([[[2014.5]], [[Number.NaN]], [[Infinity]]])(
    "rejects non-integer year %j",
    (years) => {
      invalidArgument(() => validateBirthYears(years));
    },
  );
});

describe("validateSchedule", () => {
  const slot = {weekday: 2, start: "17:00", end: "18:30"} as const;

  it("accepts a valid slot and the empty schedule", () => {
    expect(validateSchedule([slot])).toEqual([slot]);
    expect(validateSchedule([])).toEqual([]);
  });

  it("rejects end equal to start", () => {
    invalidArgument(() =>
      validateSchedule([{weekday: 2, start: "17:00", end: "17:00"}]),
    );
  });

  it("rejects end before start", () => {
    invalidArgument(() =>
      validateSchedule([{weekday: 2, start: "18:00", end: "17:00"}]),
    );
  });

  it.each([[0], [8], [1.5], [-1]])("rejects weekday %j", (weekday) => {
    invalidArgument(() =>
      validateSchedule([
        {weekday: weekday as never, start: "17:00", end: "18:00"},
      ]),
    );
  });

  it.each([["5pm"], ["24:00"], ["17:60"], ["7:00"], ["17:00:00"]])(
    "rejects malformed time %j",
    (start) => {
      invalidArgument(() =>
        validateSchedule([{weekday: 2, start, end: "23:59"}]),
      );
    },
  );
});
