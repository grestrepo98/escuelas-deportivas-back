import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "./firestore-membership-repository.js";
import {FirestoreUnitOfWork} from "../../../shared/infrastructure/firestore-unit-of-work.js";
import type {Membership} from "../../domain/membership.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);

const member = (
  uid: string,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: ["v1"], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-02T00:00:00Z"),
  ...overrides,
});

beforeEach(async () => {
  await clearFirestore();
});

describe("FirestoreMembershipRepository.listByTenant", () => {
  it("returns every membership of the tenant, active or not", async () => {
    await repo.save(member("u1"));
    await repo.save(member("u2", {status: "inactive", role: "teacher"}));
    await repo.save(member("u3", {tenantId: "tenant-b"}));

    const found = await repo.listByTenant("tenant-a");

    expect(found.map((m) => m.uid).sort()).toEqual(["u1", "u2"]);
  });

  it("round-trips the whole membership, dates included", async () => {
    await repo.save(member("u1"));
    expect(await repo.listByTenant("tenant-a")).toEqual([member("u1")]);
  });

  it("returns an empty list for a tenant without members", async () => {
    expect(await repo.listByTenant("tenant-x")).toEqual([]);
  });

  it("reads inside a transaction", async () => {
    await repo.save(member("u1"));
    await repo.save(member("u2"));

    const found = await new FirestoreUnitOfWork(db).run((tx) =>
      tx.memberships.listByTenant("tenant-a"),
    );

    expect(found.map((m) => m.uid).sort()).toEqual(["u1", "u2"]);
  });
});
