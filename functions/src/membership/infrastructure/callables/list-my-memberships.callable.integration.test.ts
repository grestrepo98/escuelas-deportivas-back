import type {Membership} from "../../domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../firestore/firestore-membership-repository.js";
import {
  listMyMembershipsOutput,
} from "./listMyMemberships/schema.js";
import {
  callCallable,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);

const membership = (
  uid: string,
  tenantId: string,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role: "coordinator",
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

let userA: TestUser;
let userB: TestUser;

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  userA = await createUser("a@example.com");
  userB = await createUser("b@example.com");
  await db.doc("tenants/tenant-a").set({name: "Escuela A", status: "active"});
  await db.doc("tenants/tenant-b").set({name: "Escuela B", status: "active"});
  await repo.save(membership(userA.uid, "tenant-a", {role: "owner"}));
  await repo.save(membership(userB.uid, "tenant-b"));
});

describe("listMyMemberships callable", () => {
  it("rejects a caller without a session as unauthenticated", async () => {
    const {status, body} = await callCallable("listMyMemberships", {});
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
  });

  it("returns the caller's memberships matching the output schema",
    async () => {
      const {status, body} = await callCallable(
        "listMyMemberships", {}, userA.idToken);
      expect(status).toBe(200);
      const output = listMyMembershipsOutput.parse(body.result);
      expect(output.memberships).toEqual([{
        tenantId: "tenant-a",
        tenantName: "Escuela A",
        role: "owner",
        scope: {venueIds: [], groupIds: [], playerIds: []},
      }]);
    });

  it("does not return tenant-a to a user who only belongs to tenant-b",
    async () => {
      const {body} = await callCallable(
        "listMyMemberships", {}, userB.idToken);
      const tenantIds = body.result.memberships
        .map((m: {tenantId: string}) => m.tenantId);
      expect(tenantIds).toEqual(["tenant-b"]);
    });

  it("stops listing a membership right after it is deactivated",
    async () => {
      await repo.save(
        membership(userA.uid, "tenant-a", {role: "owner", status: "inactive"}),
      );
      const {body} = await callCallable(
        "listMyMemberships", {}, userA.idToken);
      expect(body.result.memberships).toEqual([]);
    });

  it("accepts a null payload like the client SDK sends", async () => {
    const {status} = await callCallable(
      "listMyMemberships", null, userA.idToken);
    expect(status).toBe(200);
  });

  it("rejects unexpected input as invalid-argument", async () => {
    const {status, body} = await callCallable(
      "listMyMemberships", {tenantId: "tenant-a"}, userA.idToken);
    expect(status).toBe(400);
    expect(body.error.status).toBe("INVALID_ARGUMENT");
  });
});
