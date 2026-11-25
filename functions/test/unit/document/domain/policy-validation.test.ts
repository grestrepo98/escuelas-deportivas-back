import {describe, expect, it} from "vitest";
import {validatePolicyData} from "../../../../src/document/domain/policy-validation.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

const valid = {
  number: " P-123 ",
  insurer: " Seguros Bolivar ",
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
};

function invalid(overrides: Record<string, string>): void {
  try {
    validatePolicyData({...valid, ...overrides});
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("invalid_argument");
    return;
  }
  throw new Error("expected invalid_argument");
}

describe("validatePolicyData", () => {
  it("trims text and keeps the dates", () => {
    expect(validatePolicyData(valid)).toEqual({
      number: "P-123",
      insurer: "Seguros Bolivar",
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
    });
  });

  it("accepts a one-day policy", () => {
    expect(() =>
      validatePolicyData({...valid, validUntil: "2026-01-01"}),
    ).not.toThrow();
  });

  it("rejects a blank number or insurer", () => {
    invalid({number: "  "});
    invalid({insurer: ""});
  });

  it("rejects malformed or impossible dates", () => {
    invalid({validFrom: "01/01/2026"});
    invalid({validUntil: "2026-13-01"});
    invalid({validUntil: "2026-02-30"});
  });

  it("rejects a policy that ends before it starts", () => {
    invalid({validFrom: "2026-06-01", validUntil: "2026-05-31"});
  });
});
