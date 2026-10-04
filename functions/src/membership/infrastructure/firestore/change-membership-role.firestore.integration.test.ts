import {
  ChangeMembershipRole,
} from "../../application/change-membership-role.js";
import {type Clock} from "../../../shared/domain/clock.js";
import {type Membership} from "../../domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "./firestore-membership-repository.js";
import {
  FirestoreUnitOfWork,
} from "../../../shared/infrastructure/firestore-unit-of-work.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

const db = testDb();
const clock: Clock = {now: () => new Date("2026-10-03T12:00:00Z")};
const useCase = new ChangeMembershipRole(new FirestoreUnitOfWork(db), clock);
const repo = new FirestoreMembershipRepository(db);
const auditCollection = () => db.collection("tenants/tenant-a/auditLog");

const member = (uid: string, role: Membership["role"]): Membership => ({
  uid,
  tenantId: "tenant-a",
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
});

beforeEach(async () => {
  await clearFirestore();
  await repo.save(member("owner-1", "owner"));
  await repo.save(member("coord-1", "coordinator"));
});

describe("ChangeMembershipRole on Firestore", () => {
  it("changes the role and writes exactly one audit entry", async () => {
    await useCase.execute({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      targetUid: "coord-1",
      newRole: "accountant",
      reason: "promoted",
    });
    expect((await repo.get("coord-1", "tenant-a"))!.role).toBe("accountant");

    const audit = await auditCollection().get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data()).toMatchObject({
      actorUid: "owner-1",
      before: {role: "coordinator"},
      after: {role: "accountant"},
      reason: "promoted",
    });
    expect(audit.docs[0].data().at).toBeDefined();
  });

  it("refuses to demote the last active owner and writes nothing",
    async () => {
      await expect(useCase.execute({
        tenantId: "tenant-a",
        actorUid: "owner-1",
        targetUid: "owner-1",
        newRole: "coordinator",
      })).rejects.toMatchObject({code: "failed_precondition"});
      expect((await repo.get("owner-1", "tenant-a"))!.role).toBe("owner");
      expect((await auditCollection().get()).size).toBe(0);
    });
});
