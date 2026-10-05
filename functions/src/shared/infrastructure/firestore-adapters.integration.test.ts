import type {AuditEntry} from "../../audit/domain/audit-entry.js";
import type {Membership} from "../../membership/domain/membership.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreAuditLogWriter} from "../../audit/infrastructure/firestore/firestore-audit-log-writer.js";
import {FirestoreMembershipRepository} from "../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreUnitOfWork} from "./firestore-unit-of-work.js";
import {clearFirestore, testDb} from "./testing/helpers.js";

const db = testDb();

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

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  actorRole: "owner",
  action: "membership.role_changed",
  target: {type: "membership", id: "u1_tenant-a"},
  before: {role: "coordinator"},
  after: {role: "accountant"},
  device: {},
  ...overrides,
});

const auditCollection = () => db.collection("tenants/tenant-a/auditLog");

beforeEach(clearFirestore);

describe("FirestoreMembershipRepository", () => {
  const repo = new FirestoreMembershipRepository(db);

  it("returns null for a missing membership", async () => {
    const uow = new FirestoreUnitOfWork(db);
    const found = await uow.run((tx) => tx.memberships.get("u1", "tenant-a"));
    expect(found).toBeNull();
  });

  it("round-trips a membership stored at memberships/{uid}_{tenantId}", async () => {
    await repo.save(membership());
    expect(await repo.get("u1", "tenant-a")).toEqual(membership());

    const raw = (await db.doc("memberships/u1_tenant-a").get()).data()!;
    expect(raw.createdAt).toBeInstanceOf(Timestamp);
    expect(raw.updatedAt).toBeInstanceOf(Timestamp);
    expect(raw.role).toBe("coordinator");
  });

  it("does not return a membership of another tenant", async () => {
    await repo.save(membership());
    expect(await repo.get("u1", "tenant-b")).toBeNull();
  });

  it("counts active memberships by role within one tenant", async () => {
    await repo.save(membership({uid: "o1", role: "owner"}));
    await repo.save(membership({uid: "o2", role: "owner"}));
    await repo.save(membership({uid: "o3", role: "owner", status: "inactive"}));
    await repo.save(
      membership({uid: "o4", role: "owner", tenantId: "tenant-b"}),
    );
    await repo.save(membership({uid: "c1", role: "coordinator"}));
    expect(await repo.countActiveByRole("tenant-a", "owner")).toBe(2);
  });
});

describe("FirestoreAuditLogWriter", () => {
  const writer = new FirestoreAuditLogWriter(db);

  it("creates entries under tenants/{tenantId}/auditLog with server time", async () => {
    await writer.append(entry({reason: "promoted"}));
    await writer.append(entry());
    const snap = await auditCollection().get();
    expect(snap.size).toBe(2);
    const withReason = snap.docs
      .map((d) => d.data())
      .find((d) => d.reason === "promoted")!;
    expect(withReason.at).toBeInstanceOf(Timestamp);
    expect(withReason).toMatchObject({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.role_changed",
      target: {type: "membership", id: "u1_tenant-a"},
      before: {role: "coordinator"},
      after: {role: "accountant"},
    });
  });

  it("omits the reason field when none is given", async () => {
    await writer.append(entry());
    const [doc] = (await auditCollection().get()).docs;
    expect("reason" in doc.data()).toBe(false);
  });
});

describe("FirestoreUnitOfWork — atomicity", () => {
  const uow = new FirestoreUnitOfWork(db);
  const roleOf = async () =>
    (await db.doc("memberships/u1_tenant-a").get()).data()?.role;
  const auditCount = async () => (await auditCollection().get()).size;

  beforeEach(async () => {
    await new FirestoreMembershipRepository(db).save(membership());
  });

  it("commits membership and audit entry together", async () => {
    await uow.run(async (tx) => {
      await tx.memberships.save(membership({role: "accountant"}));
      await tx.auditLog.append(entry());
    });
    expect(await roleOf()).toBe("accountant");
    expect(await auditCount()).toBe(1);
  });

  it("does not change the role when the work throws", async () => {
    await expect(
      uow.run(async (tx) => {
        await tx.memberships.save(membership({role: "accountant"}));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await roleOf()).toBe("coordinator");
    expect(await auditCount()).toBe(0);
  });

  it("does not change the role when Firestore rejects the audit write", async () => {
    const invalid = entry({before: {role: undefined}});
    await expect(
      uow.run(async (tx) => {
        await tx.memberships.save(membership({role: "accountant"}));
        await tx.auditLog.append(invalid);
      }),
    ).rejects.toThrow();
    expect(await roleOf()).toBe("coordinator");
    expect(await auditCount()).toBe(0);
  });
});
