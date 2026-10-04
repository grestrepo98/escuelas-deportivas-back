import {describe, expect, it} from "vitest";
import {
  isActiveMembershipOf,
  membershipId,
  type Membership,
} from "../../src/membership/membership.js";

const build = (overrides: Partial<Membership> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("membershipId", () => {
  it("joins uid and tenant as {uid}_{tenantId}", () => {
    expect(membershipId("u1", "tenant-a")).toBe("u1_tenant-a");
  });
});

describe("isActiveMembershipOf", () => {
  it("is true for an active membership of the requested tenant", () => {
    expect(isActiveMembershipOf(build(), "tenant-a")).toBe(true);
  });

  it("is false for an inactive membership", () => {
    expect(isActiveMembershipOf(build({status: "inactive"}), "tenant-a"))
      .toBe(false);
  });

  it("is false when the membership belongs to another tenant", () => {
    expect(isActiveMembershipOf(build({tenantId: "tenant-b"}), "tenant-a"))
      .toBe(false);
  });

  it.each([[null], [undefined]])("is false when membership is %j", (m) => {
    expect(isActiveMembershipOf(m, "tenant-a")).toBe(false);
  });
});
