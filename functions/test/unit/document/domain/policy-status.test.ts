import {describe, expect, it} from "vitest";
import {
  bogotaDay,
  policyStatus,
} from "../../../../src/document/domain/policy-status.js";
import type {PolicyData} from "../../../../src/document/domain/document.js";

function policy(validUntil: string): PolicyData {
  return {
    number: "P-1",
    insurer: "Seguros",
    validFrom: "2026-01-01",
    validUntil,
  };
}

// 2026-10-08 12:00 in Bogota (UTC-5)
const NOON = new Date("2026-10-08T17:00:00Z");

describe("bogotaDay", () => {
  it("uses the calendar day in America/Bogota, not UTC", () => {
    expect(bogotaDay(new Date("2026-10-09T03:00:00Z"))).toBe("2026-10-08");
    expect(bogotaDay(new Date("2026-10-09T05:00:00Z"))).toBe("2026-10-09");
  });
});

describe("policyStatus", () => {
  it("is missing without a policy", () => {
    expect(policyStatus(undefined, NOON, 30)).toBe("missing");
  });

  it("is expiring within the warning window", () => {
    expect(policyStatus(policy("2026-10-18"), NOON, 30)).toBe("expiring");
  });

  it("is expiring exactly at the window edge", () => {
    expect(policyStatus(policy("2026-11-07"), NOON, 30)).toBe("expiring");
  });

  it("is valid beyond the window", () => {
    expect(policyStatus(policy("2026-12-07"), NOON, 30)).toBe("valid");
    expect(policyStatus(policy("2026-11-08"), NOON, 30)).toBe("valid");
  });

  it("is expired when the date already passed", () => {
    expect(policyStatus(policy("2026-10-07"), NOON, 30)).toBe("expired");
  });

  it("is not expired on the last day, even late at night in Bogota", () => {
    const lateNight = new Date("2026-10-09T04:59:00Z"); // 23:59 Bogota
    expect(policyStatus(policy("2026-10-08"), lateNight, 30)).toBe("expiring");
  });

  it("is expired right after midnight in Bogota", () => {
    const after = new Date("2026-10-09T05:00:00Z"); // 00:00 Bogota
    expect(policyStatus(policy("2026-10-08"), after, 30)).toBe("expired");
  });

  it("honors a custom warning window", () => {
    expect(policyStatus(policy("2026-10-18"), NOON, 5)).toBe("valid");
  });
});
