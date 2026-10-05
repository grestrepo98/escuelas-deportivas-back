import {describe, expect, it} from "vitest";
import {assertCanActivate, assertStatusChange} from "./player-status.js";
import type {DataConsent, GuardianLink, PlayerStatus} from "./player.js";
import {DomainError} from "../../shared/domain/errors.js";

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

const ALLOWED: [PlayerStatus, PlayerStatus][] = [
  ["preinscrito", "activo"],
  ["preinscrito", "retirado"],
  ["activo", "pausado"],
  ["activo", "retirado"],
  ["pausado", "activo"],
  ["pausado", "retirado"],
  ["retirado", "preinscrito"],
  ["retirado", "activo"],
];

const FORBIDDEN: [PlayerStatus, PlayerStatus][] = [
  ["preinscrito", "pausado"],
  ["activo", "preinscrito"],
  ["pausado", "preinscrito"],
  ["retirado", "pausado"],
];

describe("assertStatusChange", () => {
  it.each(ALLOWED)("allows %s -> %s", (from, to) => {
    expect(() =>
      assertStatusChange({from, to, reason: "motivo"}),
    ).not.toThrow();
  });

  it.each(FORBIDDEN)("rejects %s -> %s", (from, to) => {
    failsWith("failed_precondition", () =>
      assertStatusChange({from, to, reason: "motivo"}),
    );
  });

  it.each(["preinscrito", "activo", "pausado", "retirado"] as const)(
    "rejects a change from %s to itself",
    (status) => {
      failsWith("failed_precondition", () =>
        assertStatusChange({from: status, to: status, reason: "motivo"}),
      );
    },
  );

  it.each([
    ["activo", "pausado"],
    ["activo", "retirado"],
    ["preinscrito", "retirado"],
    ["pausado", "retirado"],
  ] as const)("requires a reason for %s -> %s", (from, to) => {
    failsWith("invalid_argument", () => assertStatusChange({from, to}));
    failsWith("invalid_argument", () =>
      assertStatusChange({from, to, reason: "   "}),
    );
  });

  it("does not require a reason to become active or pre-enrolled", () => {
    expect(() =>
      assertStatusChange({from: "retirado", to: "activo"}),
    ).not.toThrow();
    expect(() =>
      assertStatusChange({from: "retirado", to: "preinscrito"}),
    ).not.toThrow();
    expect(() =>
      assertStatusChange({from: "pausado", to: "activo"}),
    ).not.toThrow();
  });
});

describe("assertCanActivate", () => {
  const guardians: GuardianLink[] = [
    {
      guardianId: "g1",
      fullName: "Ana Ruiz",
      relationship: "madre",
      isPaymentResponsible: true,
    },
  ];
  const dataConsent: DataConsent = {
    guardianId: "g1",
    recordedBy: "staff-1",
    at: new Date("2026-10-04T12:00:00Z"),
  };

  it("passes with a responsible, consent and an active group", () => {
    expect(() =>
      assertCanActivate({guardians, dataConsent, groupActive: true}),
    ).not.toThrow();
  });

  it("fails without a payment responsible", () => {
    failsWith("failed_precondition", () =>
      assertCanActivate({
        guardians: [{...guardians[0], isPaymentResponsible: false}],
        dataConsent,
        groupActive: true,
      }),
    );
  });

  it("fails without data consent", () => {
    failsWith("failed_precondition", () =>
      assertCanActivate({guardians, dataConsent: null, groupActive: true}),
    );
  });

  it("fails when the group is closed", () => {
    failsWith("failed_precondition", () =>
      assertCanActivate({guardians, dataConsent, groupActive: false}),
    );
  });
});
