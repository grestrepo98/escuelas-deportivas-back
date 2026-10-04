import {ROLES, type Role} from "../../../membership/domain/role.js";
import {type Membership} from "../../../membership/domain/membership.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../../../membership/infrastructure/firestore/firestore-membership-repository.js";
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
const memberships = new FirestoreMembershipRepository(db);
const T0 = new Date("2026-10-01T00:00:00Z");

const membership = (
  uid: string,
  tenantId: string,
  role: Role,
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
});

const audit = async () =>
  (await db.collection("tenants/tenant-a/auditLog").get())
    .docs.map((d) => d.data());

const stamps = {
  createdAt: Timestamp.fromDate(T0),
  updatedAt: Timestamp.fromDate(T0),
};

const seedVenue = (id: string, fields: Record<string, unknown> = {}) =>
  db.doc(`tenants/tenant-a/venues/${id}`).set({
    name: `Sede ${id}`,
    address: "Calle 1",
    status: "active",
    ...stamps,
    ...fields,
  });

const seedCategory = (id: string, fields: Record<string, unknown> = {}) =>
  db.doc(`tenants/tenant-a/categories/${id}`).set({
    name: `Categoria ${id}`,
    birthYears: [],
    status: "active",
    ...stamps,
    ...fields,
  });

const seedGroup = (id: string, fields: Record<string, unknown> = {}) =>
  db.doc(`tenants/tenant-a/groups/${id}`).set({
    venueId: "venue-1",
    categoryId: "cat-1",
    name: `Grupo ${id}`,
    schedule: [],
    status: "active",
    ...stamps,
    ...fields,
  });

const readDoc = async (path: string) => (await db.doc(path).get()).data();

let owner: TestUser;
let ownerB: TestUser;
const byRole = new Map<Role, TestUser>();

const call = (name: string, caller: TestUser | undefined, data: unknown) =>
  callCallable(name, data, caller?.idToken);

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  owner = await createUser("owner-a@example.com");
  ownerB = await createUser("owner-b@example.com");
  await memberships.save(membership(owner.uid, "tenant-a", "owner"));
  await memberships.save(membership(ownerB.uid, "tenant-b", "owner"));
  for (const role of ROLES.filter((r) => r !== "owner")) {
    const user = await createUser(`${role}@example.com`);
    byRole.set(role, user);
    await memberships.save(membership(user.uid, "tenant-a", role));
  }
  await seedVenue("venue-1");
  await seedCategory("cat-1");
});

const slot = {weekday: 2, start: "17:00", end: "18:30"};

const WRITES: [string, () => unknown][] = [
  ["saveCategory", () => ({tenantId: "tenant-a", name: "Sub-12",
    birthYears: [2014]})],
  ["setCategoryStatus", () => ({tenantId: "tenant-a", categoryId: "cat-1",
    status: "closed"})],
  ["saveGroup", () => ({tenantId: "tenant-a", venueId: "venue-1",
    categoryId: "cat-1", name: "Grupo Nuevo", schedule: [slot]})],
  ["setGroupStatus", () => ({tenantId: "tenant-a", groupId: "group-1",
    status: "closed"})],
];

describe("authentication and tenant isolation (all four callables)", () => {
  beforeEach(async () => {
    await seedGroup("group-1");
  });

  it.each(WRITES)("%s rejects a caller without a session", async (n, data) => {
    const {status, body} = await call(n, undefined, data());
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
  });

  it.each(WRITES)("%s denies an owner of another tenant", async (n, data) => {
    const {status, body} = await call(n, ownerB, data());
    expect(status).toBe(403);
    expect(body.error.status).toBe("PERMISSION_DENIED");
    expect(await audit()).toHaveLength(0);
  });

  const NON_OWNERS = ROLES.filter((r) => r !== "owner");
  for (const [name, data] of WRITES) {
    it.each(NON_OWNERS)(`${name} denies %s`, async (role) => {
      const {status, body} = await call(name, byRole.get(role), data());
      expect(status).toBe(403);
      expect(body.error.status).toBe("PERMISSION_DENIED");
      expect(await audit()).toHaveLength(0);
    });
  }
});

describe("saveCategory", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    name: "Sub-12",
    birthYears: [2014, 2015],
    ...overrides,
  });

  it("creates a category and audits it once", async () => {
    const {status, body} = await call("saveCategory", owner, input());
    expect(status).toBe(200);
    const id = body.result.categoryId as string;
    expect(await readDoc(`tenants/tenant-a/categories/${id}`)).toMatchObject({
      name: "Sub-12",
      birthYears: [2014, 2015],
      status: "active",
    });
    const entries = await audit();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUid: owner.uid,
      action: "category.created",
      target: {type: "category", id},
      before: {},
    });
  });

  it("accepts a level-based category without birth years", async () => {
    const {status} = await call("saveCategory", owner,
      input({name: "Avanzados", birthYears: []}));
    expect(status).toBe(200);
  });

  it("updates an existing category", async () => {
    const {body} = await call("saveCategory", owner,
      input({categoryId: "cat-1", name: "Sub-14"}));
    expect(body.result).toEqual({categoryId: "cat-1"});
    expect((await audit())[0]).toMatchObject({
      action: "category.updated",
      before: {name: "Categoria cat-1"},
      after: {name: "Sub-14"},
    });
  });

  it("rejects a duplicate active name as failed-precondition", async () => {
    const {status, body} = await call("saveCategory", owner,
      input({name: "categoria CAT-1"}));
    expect(status).toBe(400);
    expect(body.error.status).toBe("FAILED_PRECONDITION");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects non-integer birth years and a blank name", async () => {
    expect((await call("saveCategory", owner,
      input({birthYears: [2014.5]}))).body.error.status)
      .toBe("INVALID_ARGUMENT");
    expect((await call("saveCategory", owner,
      input({name: " "}))).body.error.status).toBe("INVALID_ARGUMENT");
  });

  it("rejects a missing category as not-found", async () => {
    const {status, body} = await call("saveCategory", owner,
      input({categoryId: "nope"}));
    expect(status).toBe(404);
    expect(body.error.status).toBe("NOT_FOUND");
  });
});

describe("setCategoryStatus", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    categoryId: "cat-1",
    status: "closed",
    ...overrides,
  });

  it("closes and reopens, auditing each change", async () => {
    const closed = await call("setCategoryStatus", owner,
      input({reason: "Ya no se usa"}));
    expect(closed.body.result)
      .toEqual({categoryId: "cat-1", status: "closed"});
    const reopened = await call("setCategoryStatus", owner,
      input({status: "active"}));
    expect(reopened.body.result)
      .toEqual({categoryId: "cat-1", status: "active"});
    const entries = await audit();
    expect(entries.map((e) => e.action).sort())
      .toEqual(["category.closed", "category.reopened"]);
    expect(entries.find((e) => e.action === "category.closed")!.reason)
      .toBe("Ya no se usa");
  });

  it("never deletes the category document", async () => {
    await call("setCategoryStatus", owner, input());
    expect((await db.doc("tenants/tenant-a/categories/cat-1").get()).exists)
      .toBe(true);
  });

  it("rejects closing a category with active groups, changing nothing",
    async () => {
      await seedGroup("group-1");
      const {status, body} = await call("setCategoryStatus", owner, input());
      expect(status).toBe(400);
      expect(body.error.status).toBe("FAILED_PRECONDITION");
      expect((await readDoc("tenants/tenant-a/categories/cat-1"))!.status)
        .toBe("active");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects an invalid status and a missing category", async () => {
    expect((await call("setCategoryStatus", owner,
      input({status: "deleted"}))).body.error.status)
      .toBe("INVALID_ARGUMENT");
    expect((await call("setCategoryStatus", owner,
      input({categoryId: "nope"}))).body.error.status).toBe("NOT_FOUND");
  });
});

describe("saveGroup", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    venueId: "venue-1",
    categoryId: "cat-1",
    name: "Grupo A",
    schedule: [slot],
    ...overrides,
  });

  it("creates a group with its schedule and audits it once", async () => {
    const {status, body} = await call("saveGroup", owner, input());
    expect(status).toBe(200);
    const id = body.result.groupId as string;
    expect(await readDoc(`tenants/tenant-a/groups/${id}`)).toMatchObject({
      venueId: "venue-1",
      categoryId: "cat-1",
      name: "Grupo A",
      schedule: [slot],
      status: "active",
    });
    const entries = await audit();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "group.created",
      target: {type: "group", id},
      before: {},
    });
  });

  it("updates a group without a venueId and keeps its venue", async () => {
    await seedGroup("group-1");
    const {body} = await call("saveGroup", owner, input({
      groupId: "group-1",
      venueId: undefined,
      name: "Grupo B",
    }));
    expect(body.result).toEqual({groupId: "group-1"});
    expect(await readDoc("tenants/tenant-a/groups/group-1")).toMatchObject({
      venueId: "venue-1",
      name: "Grupo B",
    });
    expect((await audit())[0]).toMatchObject({action: "group.updated"});
  });

  it("rejects a different venueId on an existing group", async () => {
    await seedGroup("group-1");
    await seedVenue("venue-2");
    const {status, body} = await call("saveGroup", owner,
      input({groupId: "group-1", venueId: "venue-2"}));
    expect(status).toBe(400);
    expect(body.error.status).toBe("FAILED_PRECONDITION");
    expect((await readDoc("tenants/tenant-a/groups/group-1"))!.venueId)
      .toBe("venue-1");
    expect(await audit()).toHaveLength(0);
  });

  it("requires a venueId to create", async () => {
    const {body} = await call("saveGroup", owner,
      input({venueId: undefined}));
    expect(body.error.status).toBe("INVALID_ARGUMENT");
  });

  it.each([
    ["end equal to start", {weekday: 2, start: "17:00", end: "17:00"}],
    ["end before start", {weekday: 2, start: "18:00", end: "17:00"}],
    ["weekday 0", {weekday: 0, start: "17:00", end: "18:00"}],
    ["weekday 8", {weekday: 8, start: "17:00", end: "18:00"}],
    ["time not HH:mm", {weekday: 2, start: "5pm", end: "18:00"}],
    ["hour 24", {weekday: 2, start: "17:00", end: "24:00"}],
  ])("rejects a schedule with %s as invalid-argument", async (_, bad) => {
    const {status, body} = await call("saveGroup", owner,
      input({schedule: [bad]}));
    expect(status).toBe(400);
    expect(body.error.status).toBe("INVALID_ARGUMENT");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects a closed venue or category as failed-precondition",
    async () => {
      await seedVenue("venue-c", {status: "closed"});
      await seedCategory("cat-c", {status: "closed"});
      expect((await call("saveGroup", owner,
        input({venueId: "venue-c"}))).body.error.status)
        .toBe("FAILED_PRECONDITION");
      expect((await call("saveGroup", owner,
        input({categoryId: "cat-c"}))).body.error.status)
        .toBe("FAILED_PRECONDITION");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects a missing venue or category as not-found", async () => {
    expect((await call("saveGroup", owner,
      input({venueId: "nope"}))).body.error.status).toBe("NOT_FOUND");
    expect((await call("saveGroup", owner,
      input({categoryId: "nope"}))).body.error.status).toBe("NOT_FOUND");
  });

  it("rejects a duplicate name in the same venue, allows another venue",
    async () => {
      await seedGroup("group-1", {name: "Grupo A"});
      expect((await call("saveGroup", owner,
        input({name: "grupo a"}))).body.error.status)
        .toBe("FAILED_PRECONDITION");
      await seedVenue("venue-2");
      expect((await call("saveGroup", owner,
        input({venueId: "venue-2"}))).status).toBe(200);
    });
});

describe("setGroupStatus", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    groupId: "group-1",
    status: "closed",
    ...overrides,
  });

  beforeEach(async () => {
    await seedGroup("group-1");
  });

  it("closes and reopens, auditing each change", async () => {
    const closed = await call("setGroupStatus", owner,
      input({reason: "Sin cupo"}));
    expect(closed.body.result).toEqual({groupId: "group-1", status: "closed"});
    const reopened = await call("setGroupStatus", owner,
      input({status: "active"}));
    expect(reopened.body.result)
      .toEqual({groupId: "group-1", status: "active"});
    const entries = await audit();
    expect(entries.map((e) => e.action).sort())
      .toEqual(["group.closed", "group.reopened"]);
  });

  it("never deletes the group document", async () => {
    await call("setGroupStatus", owner, input());
    expect((await db.doc("tenants/tenant-a/groups/group-1").get()).exists)
      .toBe(true);
  });

  it("rejects reopening under a closed venue or category", async () => {
    await seedGroup("group-1", {status: "closed"});
    await seedVenue("venue-1", {status: "closed"});
    const underVenue = await call("setGroupStatus", owner,
      input({status: "active"}));
    expect(underVenue.status).toBe(400);
    expect(underVenue.body.error.status).toBe("FAILED_PRECONDITION");

    await seedVenue("venue-1");
    await seedCategory("cat-1", {status: "closed"});
    const underCategory = await call("setGroupStatus", owner,
      input({status: "active"}));
    expect(underCategory.body.error.status).toBe("FAILED_PRECONDITION");
    expect((await readDoc("tenants/tenant-a/groups/group-1"))!.status)
      .toBe("closed");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects an invalid status and a missing group", async () => {
    expect((await call("setGroupStatus", owner,
      input({status: "deleted"}))).body.error.status)
      .toBe("INVALID_ARGUMENT");
    expect((await call("setGroupStatus", owner,
      input({groupId: "nope"}))).body.error.status).toBe("NOT_FOUND");
  });
});
