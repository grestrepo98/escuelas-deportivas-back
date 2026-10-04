import {ROLES, type Membership, type Role} from "@escuelas/domain";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../../src/adapters/firestore/index.js";
import {
  changeMembershipRoleOutput,
} from "../../src/callables/changeMembershipRole/schema.js";
import {
  callCallable,
  clearAuth,
  createUser,
  type TestUser,
} from "./emulator-helpers.js";
import {clearFirestore, testDb} from "./helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);
const auditCollection = () => db.collection("tenants/tenant-a/auditLog");

const membership = (
  uid: string,
  tenantId: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: {venueIds: ["v1"], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const roleOf = async (uid: string, tenantId = "tenant-a") =>
  (await repo.get(uid, tenantId))?.role;

let ownerA: TestUser;
let ownerB: TestUser;
let coordinator: TestUser;

const change = (caller: TestUser | undefined, data: unknown) =>
  callCallable("changeMembershipRole", data, caller?.idToken);

const validInput = (overrides = {}) => ({
  tenantId: "tenant-a",
  targetUid: coordinator.uid,
  newRole: "accountant",
  ...overrides,
});

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  ownerA = await createUser("owner-a@example.com");
  ownerB = await createUser("owner-b@example.com");
  coordinator = await createUser("coord@example.com");
  await repo.save(membership(ownerA.uid, "tenant-a", "owner"));
  await repo.save(membership(ownerB.uid, "tenant-b", "owner"));
  await repo.save(membership(coordinator.uid, "tenant-a", "coordinator"));
});

describe("changeMembershipRole callable — success", () => {
  it("changes the role and writes exactly one audit entry", async () => {
    const {status, body} = await change(
      ownerA, validInput({reason: "promoted"}));
    expect(status).toBe(200);
    expect(changeMembershipRoleOutput.parse(body.result)).toEqual({
      membershipId: `${coordinator.uid}_tenant-a`,
      role: "accountant",
    });
    expect(await roleOf(coordinator.uid)).toBe("accountant");

    const audit = await auditCollection().get();
    expect(audit.size).toBe(1);
    const entry = audit.docs[0].data();
    expect(entry).toMatchObject({
      tenantId: "tenant-a",
      actorUid: ownerA.uid,
      actorRole: "owner",
      action: "membership.role_changed",
      target: {type: "membership", id: `${coordinator.uid}_tenant-a`},
      before: {role: "coordinator"},
      after: {role: "accountant"},
      reason: "promoted",
    });
    expect(entry.at).toBeDefined();
  });

  it("keeps the target's scope", async () => {
    await change(ownerA, validInput());
    expect((await repo.get(coordinator.uid, "tenant-a"))!.scope.venueIds)
      .toEqual(["v1"]);
  });
});

describe("changeMembershipRole callable — authentication", () => {
  it("rejects a caller without a session as unauthenticated", async () => {
    const {status, body} = await change(undefined, validInput());
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});

describe("changeMembershipRole callable — tenant isolation", () => {
  it("denies an owner of tenant-b who targets tenant-a", async () => {
    const {status, body} = await change(ownerB, validInput());
    expect(status).toBe(403);
    expect(body.error.status).toBe("PERMISSION_DENIED");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it("does not let tenant-b's owner reach tenant-a through their own tenant",
    async () => {
      // Same target uid, but the request is scoped to the caller's tenant.
      const {status, body} = await change(
        ownerB, validInput({tenantId: "tenant-b"}));
      expect(status).toBe(404);
      expect(body.error.status).toBe("NOT_FOUND");
      expect(await roleOf(coordinator.uid)).toBe("coordinator");
    });
});

describe("changeMembershipRole callable — only owners", () => {
  it.each(ROLES.filter((r) => r !== "owner"))(
    "denies a %s", async (role) => {
      const caller = await createUser(`${role}@example.com`);
      await repo.save(membership(caller.uid, "tenant-a", role));
      const {status, body} = await change(caller, validInput());
      expect(status).toBe(403);
      expect(body.error.status).toBe("PERMISSION_DENIED");
      expect(await roleOf(coordinator.uid)).toBe("coordinator");
    });

  it("denies an owner right after being deactivated, with the same token",
    async () => {
      await repo.save(
        membership(ownerA.uid, "tenant-a", "owner", {status: "inactive"}));
      const {body} = await change(ownerA, validInput());
      expect(body.error.status).toBe("PERMISSION_DENIED");
      expect(await roleOf(coordinator.uid)).toBe("coordinator");
    });
});

describe("changeMembershipRole callable — business rules", () => {
  it("refuses to demote the last active owner", async () => {
    const {status, body} = await change(ownerA, validInput({
      targetUid: ownerA.uid,
      newRole: "coordinator",
    }));
    expect(status).toBe(400);
    expect(body.error.status).toBe("FAILED_PRECONDITION");
    expect(await roleOf(ownerA.uid)).toBe("owner");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it("refuses an unchanged role", async () => {
    const {body} = await change(ownerA, validInput({newRole: "coordinator"}));
    expect(body.error.status).toBe("FAILED_PRECONDITION");
  });

  it("answers not-found for a target without membership", async () => {
    const {status, body} = await change(
      ownerA, validInput({targetUid: "nobody"}));
    expect(status).toBe(404);
    expect(body.error.status).toBe("NOT_FOUND");
  });
});

describe("changeMembershipRole callable — input validation", () => {
  it.each([
    ["missing tenantId", {targetUid: "x", newRole: "owner"}],
    ["missing targetUid", {tenantId: "tenant-a", newRole: "owner"}],
    ["missing newRole", {tenantId: "tenant-a", targetUid: "x"}],
    ["unknown role", {tenantId: "tenant-a", targetUid: "x", newRole: "boss"}],
    ["non-string reason", {
      tenantId: "tenant-a", targetUid: "x", newRole: "owner", reason: 7,
    }],
    ["unexpected field", {
      tenantId: "tenant-a", targetUid: "x", newRole: "owner", actorUid: "y",
    }],
    ["null payload", null],
  ])("rejects %s as invalid-argument", async (_name, data) => {
    const {status, body} = await change(ownerA, data);
    expect(status).toBe(400);
    expect(body.error.status).toBe("INVALID_ARGUMENT");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});
