import {ROLES, type Role} from "../../../membership/domain/role.js";
import {type Membership} from "../../../membership/domain/membership.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {
  callApi,
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
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
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

type Method = "POST" | "PUT" | "PATCH";
const api = (
  method: Method,
  path: string,
  caller: TestUser | undefined,
  body?: unknown,
) => callApi("structureApi", method, path, body, caller?.idToken);

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

const BASE = "/tenants/tenant-a";
const CATEGORIES = `${BASE}/categories`;
const GROUPS = `${BASE}/groups`;
const slot = {weekday: 2, start: "17:00", end: "18:30"};

type Route = {
  name: string;
  method: Method;
  path: string;
  body: () => unknown;
  invalid: [string, unknown][];
};

const ROUTES: Route[] = [
  {
    name: "POST /categories",
    method: "POST",
    path: CATEGORIES,
    body: () => ({name: "Sub-12", birthYears: [2014]}),
    invalid: [
      ["missing birthYears", {name: "Sub-12"}],
      ["non-integer birth year", {name: "Sub-12", birthYears: [2014.5]}],
      ["blank name", {name: " ", birthYears: []}],
      ["unexpected field", {name: "Sub-12", birthYears: [], status: "x"}],
    ],
  },
  {
    name: "PUT /categories/:categoryId",
    method: "PUT",
    path: `${CATEGORIES}/cat-1`,
    body: () => ({name: "Sub-14", birthYears: [2012]}),
    invalid: [
      ["missing name", {birthYears: []}],
      ["birth years of the wrong type", {name: "Sub-14", birthYears: "2012"}],
      ["unexpected field", {name: "Sub-14", birthYears: [], categoryId: "x"}],
    ],
  },
  {
    name: "PATCH /categories/:categoryId/status",
    method: "PATCH",
    path: `${CATEGORIES}/cat-1/status`,
    body: () => ({status: "closed"}),
    invalid: [
      ["missing status", {}],
      ["status out of range", {status: "deleted"}],
      ["unexpected field", {status: "closed", categoryId: "cat-1"}],
    ],
  },
  {
    name: "POST /groups",
    method: "POST",
    path: GROUPS,
    body: () => ({
      venueId: "venue-1",
      categoryId: "cat-1",
      name: "Grupo Nuevo",
      schedule: [slot],
    }),
    invalid: [
      ["missing venueId", {categoryId: "cat-1", name: "G", schedule: []}],
      ["missing name", {venueId: "venue-1", categoryId: "cat-1", schedule: []}],
      ["weekday out of range", {
        venueId: "venue-1",
        categoryId: "cat-1",
        name: "G",
        schedule: [{weekday: 8, start: "17:00", end: "18:00"}],
      }],
      ["unexpected field", {
        venueId: "venue-1",
        categoryId: "cat-1",
        name: "G",
        schedule: [],
        status: "closed",
      }],
    ],
  },
  {
    name: "PUT /groups/:groupId",
    method: "PUT",
    path: `${GROUPS}/group-1`,
    body: () => ({categoryId: "cat-1", name: "Grupo B", schedule: [slot]}),
    invalid: [
      ["missing schedule", {categoryId: "cat-1", name: "Grupo B"}],
      ["weekday out of range", {
        categoryId: "cat-1",
        name: "Grupo B",
        schedule: [{weekday: 0, start: "17:00", end: "18:00"}],
      }],
      ["venueId (only allowed on create)", {
        venueId: "venue-1",
        categoryId: "cat-1",
        name: "Grupo B",
        schedule: [],
      }],
    ],
  },
  {
    name: "PATCH /groups/:groupId/status",
    method: "PATCH",
    path: `${GROUPS}/group-1/status`,
    body: () => ({status: "closed"}),
    invalid: [
      ["missing status", {}],
      ["status out of range", {status: "deleted"}],
      ["unexpected field", {status: "closed", groupId: "group-1"}],
    ],
  },
];

describe("category and group routes — authentication, isolation, " +
  "validation", () => {
  beforeEach(async () => {
    await seedGroup("group-1");
  });

  const NON_OWNERS = ROLES.filter((r) => r !== "owner");

  for (const route of ROUTES) {
    describe(route.name, () => {
      it("rejects a caller without a token", async () => {
        const {status, body} = await api(
          route.method, route.path, undefined, route.body());
        expect(status).toBe(401);
        expect(body.error.code).toBe("unauthenticated");
        expect(await audit()).toHaveLength(0);
      });

      it("denies an owner of another tenant", async () => {
        const {status, body} = await api(
          route.method, route.path, ownerB, route.body());
        expect(status).toBe(403);
        expect(body.error.code).toBe("permission_denied");
        expect(await audit()).toHaveLength(0);
      });

      it.each(NON_OWNERS)("denies a %s", async (role) => {
        const {status, body} = await api(
          route.method, route.path, byRole.get(role), route.body());
        expect(status).toBe(403);
        expect(body.error.code).toBe("permission_denied");
        expect(await audit()).toHaveLength(0);
      });

      it("denies an owner right after being deactivated, same token",
        async () => {
          await memberships.save(membership(
            owner.uid, "tenant-a", "owner", {status: "inactive"}));
          const {status, body} = await api(
            route.method, route.path, owner, route.body());
          expect(status).toBe(403);
          expect(body.error.code).toBe("permission_denied");
          expect(await audit()).toHaveLength(0);
        });

      it.each([...route.invalid, ["no body", undefined]] as [
        string, unknown][])("rejects %s as invalid_argument",
        async (_name, data) => {
          const {status, body} = await api(
            route.method, route.path, owner, data);
          expect(status).toBe(400);
          expect(body.error.code).toBe("invalid_argument");
          expect(await audit()).toHaveLength(0);
        });
    });
  }
});

describe("POST /categories", () => {
  const input = (overrides = {}) => ({
    name: "Sub-12",
    birthYears: [2014, 2015],
    ...overrides,
  });

  it("creates a category with 201 and audits it once", async () => {
    const {status, body} = await api("POST", CATEGORIES, owner, input());
    expect(status).toBe(201);
    const id = body.categoryId as string;
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
    const {status} = await api("POST", CATEGORIES, owner,
      input({name: "Avanzados", birthYears: []}));
    expect(status).toBe(201);
  });

  it("rejects a duplicate active name as failed_precondition", async () => {
    const {status, body} = await api("POST", CATEGORIES, owner,
      input({name: "categoria CAT-1"}));
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
    expect(await audit()).toHaveLength(0);
  });
});

describe("PUT /categories/:categoryId", () => {
  it("updates an existing category", async () => {
    const {status, body} = await api("PUT", `${CATEGORIES}/cat-1`, owner,
      {name: "Sub-14", birthYears: []});
    expect(status).toBe(200);
    expect(body).toEqual({categoryId: "cat-1"});
    expect((await audit())[0]).toMatchObject({
      action: "category.updated",
      before: {name: "Categoria cat-1"},
      after: {name: "Sub-14"},
    });
  });

  it("rejects a missing category as not_found", async () => {
    const {status, body} = await api("PUT", `${CATEGORIES}/nope`, owner,
      {name: "Sub-14", birthYears: []});
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("PATCH /categories/:categoryId/status", () => {
  const patch = (body: unknown, categoryId = "cat-1") =>
    api("PATCH", `${CATEGORIES}/${categoryId}/status`, owner, body);

  it("closes and reopens, auditing each change", async () => {
    const closed = await patch({status: "closed", reason: "Ya no se usa"});
    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({categoryId: "cat-1", status: "closed"});
    const reopened = await patch({status: "active"});
    expect(reopened.body).toEqual({categoryId: "cat-1", status: "active"});
    const entries = await audit();
    expect(entries.map((e) => e.action).sort())
      .toEqual(["category.closed", "category.reopened"]);
    expect(entries.find((e) => e.action === "category.closed")!.reason)
      .toBe("Ya no se usa");
  });

  it("never deletes the category document", async () => {
    await patch({status: "closed"});
    expect((await db.doc("tenants/tenant-a/categories/cat-1").get()).exists)
      .toBe(true);
  });

  it("rejects closing a category with active groups, changing nothing",
    async () => {
      await seedGroup("group-1");
      const {status, body} = await patch({status: "closed"});
      expect(status).toBe(409);
      expect(body.error.code).toBe("failed_precondition");
      expect((await readDoc("tenants/tenant-a/categories/cat-1"))!.status)
        .toBe("active");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects a missing category as not_found", async () => {
    const {status, body} = await patch({status: "closed"}, "nope");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("POST /groups", () => {
  const input = (overrides = {}) => ({
    venueId: "venue-1",
    categoryId: "cat-1",
    name: "Grupo A",
    schedule: [slot],
    ...overrides,
  });

  it("creates a group with its schedule, 201, and audits it once",
    async () => {
      const {status, body} = await api("POST", GROUPS, owner, input());
      expect(status).toBe(201);
      const id = body.groupId as string;
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

  it.each([
    ["end equal to start", {weekday: 2, start: "17:00", end: "17:00"}],
    ["end before start", {weekday: 2, start: "18:00", end: "17:00"}],
    ["time not HH:mm", {weekday: 2, start: "5pm", end: "18:00"}],
    ["hour 24", {weekday: 2, start: "17:00", end: "24:00"}],
  ])("rejects a schedule with %s as invalid_argument", async (_, bad) => {
    const {status, body} = await api("POST", GROUPS, owner,
      input({schedule: [bad]}));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects a closed venue or category as failed_precondition",
    async () => {
      await seedVenue("venue-c", {status: "closed"});
      await seedCategory("cat-c", {status: "closed"});
      const underVenue = await api("POST", GROUPS, owner,
        input({venueId: "venue-c"}));
      expect(underVenue.status).toBe(409);
      expect(underVenue.body.error.code).toBe("failed_precondition");
      const underCategory = await api("POST", GROUPS, owner,
        input({categoryId: "cat-c"}));
      expect(underCategory.status).toBe(409);
      expect(underCategory.body.error.code).toBe("failed_precondition");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects a missing venue or category as not_found", async () => {
    const venue = await api("POST", GROUPS, owner, input({venueId: "nope"}));
    expect(venue.status).toBe(404);
    expect(venue.body.error.code).toBe("not_found");
    const category = await api("POST", GROUPS, owner,
      input({categoryId: "nope"}));
    expect(category.status).toBe(404);
    expect(category.body.error.code).toBe("not_found");
  });

  it("rejects a duplicate name in the same venue, allows another venue",
    async () => {
      await seedGroup("group-1", {name: "Grupo A"});
      const duplicate = await api("POST", GROUPS, owner,
        input({name: "grupo a"}));
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe("failed_precondition");
      await seedVenue("venue-2");
      expect((await api("POST", GROUPS, owner,
        input({venueId: "venue-2"}))).status).toBe(201);
    });
});

describe("PUT /groups/:groupId", () => {
  const input = (overrides = {}) => ({
    categoryId: "cat-1",
    name: "Grupo B",
    schedule: [slot],
    ...overrides,
  });

  beforeEach(async () => {
    await seedGroup("group-1");
  });

  it("updates a group and keeps its venue", async () => {
    const {status, body} = await api(
      "PUT", `${GROUPS}/group-1`, owner, input());
    expect(status).toBe(200);
    expect(body).toEqual({groupId: "group-1"});
    expect(await readDoc("tenants/tenant-a/groups/group-1")).toMatchObject({
      venueId: "venue-1",
      name: "Grupo B",
      schedule: [slot],
    });
    expect((await audit())[0]).toMatchObject({action: "group.updated"});
  });

  it("rejects a missing group as not_found", async () => {
    const {status, body} = await api(
      "PUT", `${GROUPS}/nope`, owner, input());
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("PATCH /groups/:groupId/status", () => {
  const patch = (body: unknown, groupId = "group-1") =>
    api("PATCH", `${GROUPS}/${groupId}/status`, owner, body);

  beforeEach(async () => {
    await seedGroup("group-1");
  });

  it("closes and reopens, auditing each change", async () => {
    const closed = await patch({status: "closed", reason: "Sin cupo"});
    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({groupId: "group-1", status: "closed"});
    const reopened = await patch({status: "active"});
    expect(reopened.body).toEqual({groupId: "group-1", status: "active"});
    const entries = await audit();
    expect(entries.map((e) => e.action).sort())
      .toEqual(["group.closed", "group.reopened"]);
  });

  it("never deletes the group document", async () => {
    await patch({status: "closed"});
    expect((await db.doc("tenants/tenant-a/groups/group-1").get()).exists)
      .toBe(true);
  });

  it("rejects reopening under a closed venue or category", async () => {
    await seedGroup("group-1", {status: "closed"});
    await seedVenue("venue-1", {status: "closed"});
    const underVenue = await patch({status: "active"});
    expect(underVenue.status).toBe(409);
    expect(underVenue.body.error.code).toBe("failed_precondition");

    await seedVenue("venue-1");
    await seedCategory("cat-1", {status: "closed"});
    const underCategory = await patch({status: "active"});
    expect(underCategory.status).toBe(409);
    expect(underCategory.body.error.code).toBe("failed_precondition");
    expect((await readDoc("tenants/tenant-a/groups/group-1"))!.status)
      .toBe("closed");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects a missing group as not_found", async () => {
    const {status, body} = await patch({status: "closed"}, "nope");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});
