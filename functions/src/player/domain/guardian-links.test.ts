import {describe, expect, it} from "vitest";
import {
  assertActiveHasResponsible,
  paymentResponsibleOf,
  validateGuardianLinks,
} from "./guardian-links.js";
import type {GuardianLink} from "./player.js";
import {DomainError} from "../../shared/domain/errors.js";

function link(guardianId: string, isPaymentResponsible = false): GuardianLink {
  return {
    guardianId,
    fullName: `Guardian ${guardianId}`,
    relationship: "madre",
    isPaymentResponsible,
  };
}

function failsWith(code: string, fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected DomainError ${code}`);
}

describe("validateGuardianLinks", () => {
  it("accepts an empty list", () => {
    expect(() => validateGuardianLinks([])).not.toThrow();
  });

  it("accepts several guardians with one payment responsible", () => {
    expect(() =>
      validateGuardianLinks([link("a", true), link("b"), link("c")]),
    ).not.toThrow();
  });

  it("accepts guardians with no payment responsible", () => {
    expect(() => validateGuardianLinks([link("a"), link("b")])).not.toThrow();
  });

  it("rejects the same guardian twice", () => {
    failsWith("invalid_argument", () =>
      validateGuardianLinks([link("a"), link("a")]),
    );
  });

  it("rejects more than one payment responsible", () => {
    failsWith("invalid_argument", () =>
      validateGuardianLinks([link("a", true), link("b", true)]),
    );
  });
});

describe("paymentResponsibleOf", () => {
  it("returns the responsible link", () => {
    expect(paymentResponsibleOf([link("a"), link("b", true)])).toEqual(
      link("b", true),
    );
  });

  it("returns null when there is none", () => {
    expect(paymentResponsibleOf([link("a")])).toBeNull();
    expect(paymentResponsibleOf([])).toBeNull();
  });
});

describe("assertActiveHasResponsible", () => {
  it("passes with exactly one responsible", () => {
    expect(() =>
      assertActiveHasResponsible([link("a", true), link("b")]),
    ).not.toThrow();
  });

  it("fails with a precondition error when there is none", () => {
    failsWith("failed_precondition", () =>
      assertActiveHasResponsible([link("a")]),
    );
    failsWith("failed_precondition", () => assertActiveHasResponsible([]));
  });

  it("fails when there is more than one", () => {
    failsWith("failed_precondition", () =>
      assertActiveHasResponsible([link("a", true), link("b", true)]),
    );
  });
});
