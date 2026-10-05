import type {Membership} from "../../domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "./firestore-membership-repository.js";
import {findMyMemberships} from "./my-memberships-query.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: ["v1"], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const tenant = (id: string, name: string) =>
  db.doc(`tenants/${id}`).set({name, status: "active"});

beforeEach(async () => {
  await clearFirestore();
  await tenant("tenant-a", "Escuela A");
  await tenant("tenant-b", "Escuela B");
});

describe("findMyMemberships", () => {
  it("returns role, scope and tenant name for each active membership", async () => {
    await repo.save(membership());
    await repo.save(membership({tenantId: "tenant-b", role: "guardian"}));
    const result = await findMyMemberships(db, "u1");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      tenantId: "tenant-a",
      tenantName: "Escuela A",
      role: "coordinator",
      scope: {venueIds: ["v1"], groupIds: [], playerIds: []},
    });
    expect(result).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant-b",
        tenantName: "Escuela B",
        role: "guardian",
      }),
    );
  });

  it("excludes inactive memberships", async () => {
    await repo.save(membership({status: "inactive"}));
    expect(await findMyMemberships(db, "u1")).toEqual([]);
  });

  it("never returns memberships of other users", async () => {
    await repo.save(membership({uid: "someone-else"}));
    expect(await findMyMemberships(db, "u1")).toEqual([]);
  });

  it("omits a membership whose tenant document does not exist", async () => {
    await repo.save(membership({tenantId: "ghost-tenant"}));
    expect(await findMyMemberships(db, "u1")).toEqual([]);
  });
});
