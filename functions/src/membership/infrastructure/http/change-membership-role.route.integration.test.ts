import {ROLES, type Role} from "../../domain/role.js";
import {type Membership} from "../../domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "../firestore/firestore-membership-repository.js";
import {changeMembershipRoleOutput} from "./routes/changeMembershipRole/schema.js";
import {
  callApi,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  INTEGRATION_PROJECT_ID,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

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

// The target and the tenant travel in the route; the body carries the rest.
const change = (
  caller: TestUser | undefined,
  data: unknown,
  {tenantId = "tenant-a", uid = coordinator.uid} = {},
) =>
  callApi(
    "membershipApi",
    "PATCH",
    `/tenants/${tenantId}/memberships/${uid}/role`,
    data,
    caller?.idToken,
  );

const validInput = (overrides = {}) => ({newRole: "accountant", ...overrides});

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

describe("PATCH /tenants/:tenantId/memberships/:uid/role — success", () => {
  it("changes the role and writes exactly one audit entry", async () => {
    const {status, body} = await change(
      ownerA,
      validInput({reason: "promoted"}),
    );
    expect(status).toBe(200);
    expect(changeMembershipRoleOutput.parse(body)).toEqual({
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

  it("empties the scope of a coordinator who becomes an accountant", async () => {
    await change(ownerA, validInput());
    expect(
      (await repo.get(coordinator.uid, "tenant-a"))!.scope.venueIds,
    ).toEqual([]);
  });
});

describe("PATCH …/role — authentication", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await change(undefined, validInput());
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});

describe("PATCH …/role — tenant isolation", () => {
  it("denies an owner of tenant-b who targets tenant-a", async () => {
    const {status, body} = await change(ownerB, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it("does not let tenant-b's owner reach tenant-a through their own tenant", async () => {
    // Same target uid, but the request is scoped to the caller's tenant.
    const {status, body} = await change(ownerB, validInput(), {
      tenantId: "tenant-b",
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});

describe("PATCH …/role — only owners", () => {
  it.each(ROLES.filter((r) => r !== "owner"))("denies a %s", async (role) => {
    const caller = await createUser(`${role}@example.com`);
    await repo.save(membership(caller.uid, "tenant-a", role));
    const {status, body} = await change(caller, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it("denies an owner right after being deactivated, with the same token", async () => {
    await repo.save(
      membership(ownerA.uid, "tenant-a", "owner", {status: "inactive"}),
    );
    const {status, body} = await change(ownerA, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});

describe("PATCH …/role — business rules", () => {
  it("refuses to demote the last active owner", async () => {
    const {status, body} = await change(
      ownerA,
      validInput({newRole: "coordinator"}),
      {uid: ownerA.uid},
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
    expect(await roleOf(ownerA.uid)).toBe("owner");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it("refuses an unchanged role", async () => {
    const {status, body} = await change(
      ownerA,
      validInput({newRole: "coordinator"}),
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
  });

  it("answers not-found for a target without membership", async () => {
    const {status, body} = await change(ownerA, validInput(), {uid: "nobody"});
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("PATCH …/role — input validation", () => {
  it.each([
    ["missing newRole", {}],
    ["unknown role", {newRole: "boss"}],
    ["non-string reason", {newRole: "owner", reason: 7}],
    ["value out of range", {newRole: ""}],
    ["unexpected field", {newRole: "owner", actorUid: "y"}],
    ["tenantId in the body", {newRole: "owner", tenantId: "tenant-a"}],
    ["no body", undefined],
  ])("rejects %s as invalid_argument", async (_name, data) => {
    const {status, body} = await change(ownerA, data);
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });

  // The Functions runtime rejects a body that is not valid JSON object syntax
  // with its own 400 before the app runs, so there is no error envelope.
  it.each([
    ["a null payload", "null"],
    ["malformed JSON", "{"],
  ])("rejects %s with 400", async (_name, raw) => {
    const response = await fetch(
      `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001"}/` +
        `${INTEGRATION_PROJECT_ID}/us-central1/membershipApi/tenants/` +
        `tenant-a/memberships/${coordinator.uid}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerA.idToken}`,
        },
        body: raw,
      },
    );
    expect(response.status).toBe(400);
    expect(await roleOf(coordinator.uid)).toBe("coordinator");
  });
});

describe("PATCH …/role — the scope travels with the role", () => {
  const seed = async () => {
    const base = {
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .doc("tenants/tenant-a/venues/venue-1")
      .set({name: "Sede Norte", address: "Calle 1", ...base});
    await db.doc("tenants/tenant-a/groups/group-1").set({
      venueId: "venue-1",
      categoryId: "cat-1",
      name: "Sub-10",
      schedule: [],
      ...base,
    });
  };

  it("makes a coordinator a teacher with the given groups", async () => {
    await seed();
    const {status, body} = await change(
      ownerA,
      validInput({newRole: "teacher", scope: {groupIds: ["group-1"]}}),
    );
    expect(status).toBe(200);
    expect(body.role).toBe("teacher");
    expect((await repo.get(coordinator.uid, "tenant-a"))!.scope).toEqual({
      venueIds: [],
      groupIds: ["group-1"],
      playerIds: [],
    });
    expect((await auditCollection().get()).docs[0].data()).toMatchObject({
      before: {role: "coordinator", scope: {venueIds: ["v1"]}},
      after: {role: "teacher", scope: {groupIds: ["group-1"]}},
    });
  });

  it.each([
    ["coordinator", {}],
    ["coordinator", {scope: {}}],
    ["teacher", {scope: {venueIds: ["venue-1"]}}],
  ])("answers 400 for a %s without a valid scope", async (newRole, extra) => {
    await seed();
    const {status, body} = await change(
      ownerA,
      validInput({newRole, ...extra}),
      {uid: (await createAccountant()).uid},
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect((await auditCollection().get()).size).toBe(0);
  });

  it.each(["owner", "accountant"])(
    "answers 400 when %s comes with a non-empty scope",
    async (newRole) => {
      await seed();
      const {status, body} = await change(
        ownerA,
        validInput({newRole, scope: {venueIds: ["venue-1"]}}),
      );
      expect(status).toBe(400);
      expect(body.error.code).toBe("invalid_argument");
      expect(await roleOf(coordinator.uid)).toBe("coordinator");
    },
  );

  it("answers 409 for a closed venue", async () => {
    await seed();
    await db.doc("tenants/tenant-a/venues/venue-1").update({status: "closed"});
    const {status} = await change(
      ownerA,
      validInput({newRole: "coordinator", scope: {venueIds: ["venue-1"]}}),
      {uid: (await createAccountant()).uid},
    );
    expect(status).toBe(409);
  });

  it("rejects an unexpected field inside the scope", async () => {
    const {status, body} = await change(
      ownerA,
      validInput({scope: {venueIds: [], playerIds: ["p"]}}),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
  });
});

async function createAccountant() {
  const user = await createUser("acc@example.com");
  await repo.save(
    membership(user.uid, "tenant-a", "accountant", {
      scope: {venueIds: [], groupIds: [], playerIds: []},
    }),
  );
  return user;
}
