import type {Membership} from "../domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "./firestore/firestore-membership-repository.js";
import {
  authorizeTenantMember,
  requireUid,
} from "./authorize.js";
import {
  clearFirestore,
  testDb,
} from "../../shared/infrastructure/testing/helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as {code?: string}).code;
  }
  return "no-error";
};

describe("requireUid", () => {
  it("returns the uid of an authenticated caller", () => {
    expect(requireUid({uid: "u1", token: {}} as never)).toBe("u1");
  });

  it("throws unauthenticated when there is no session", () => {
    expect(() => requireUid(undefined)).toThrowError(
      expect.objectContaining({code: "unauthenticated"}),
    );
  });
});

describe("authorizeTenantMember", () => {
  beforeEach(clearFirestore);

  it("returns the membership of an active member", async () => {
    await repo.save(membership());
    const result = await authorizeTenantMember(db, "u1", "tenant-a");
    expect(result.role).toBe("coordinator");
  });

  it("denies a caller with no membership in the tenant", async () => {
    expect(await codeOf(authorizeTenantMember(db, "u1", "tenant-a")))
      .toBe("permission-denied");
  });

  it("denies an inactive membership", async () => {
    await repo.save(membership({status: "inactive"}));
    expect(await codeOf(authorizeTenantMember(db, "u1", "tenant-a")))
      .toBe("permission-denied");
  });

  it("denies a member of another tenant", async () => {
    await repo.save(membership({tenantId: "tenant-b"}));
    expect(await codeOf(authorizeTenantMember(db, "u1", "tenant-a")))
      .toBe("permission-denied");
  });
});
