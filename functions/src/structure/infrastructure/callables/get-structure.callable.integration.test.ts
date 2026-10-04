import {ROLES, type Role} from "../../../membership/domain/role.js";
import {
  type Membership,
  type Scope,
} from "../../../membership/domain/membership.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {
  getStructureOutput,
} from "./getStructure/schema.js";
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
const stamps = {
  createdAt: Timestamp.fromDate(T0),
  updatedAt: Timestamp.fromDate(T0),
};

const membership = (
  uid: string,
  tenantId: string,
  role: Role,
  scope: Partial<Scope> = {},
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: [], ...scope},
  createdAt: T0,
  updatedAt: T0,
});

const venue = (tenantId: string, id: string, fields = {}) =>
  db.doc(`tenants/${tenantId}/venues/${id}`).set({
    name: `Sede ${id}`, address: "Calle 1", status: "active", ...stamps,
    ...fields,
  });
const category = (tenantId: string, id: string, fields = {}) =>
  db.doc(`tenants/${tenantId}/categories/${id}`).set({
    name: `Cat ${id}`, birthYears: [2015], status: "active", ...stamps,
    ...fields,
  });
const group = (
  tenantId: string,
  id: string,
  venueId: string,
  categoryId: string,
  fields = {},
) => db.doc(`tenants/${tenantId}/groups/${id}`).set({
  venueId, categoryId, name: `Grupo ${id}`,
  schedule: [{weekday: 2, start: "17:00", end: "18:30"}],
  status: "active", ...stamps, ...fields,
});

const ids = (items: {id: string}[]) => items.map((i) => i.id).sort();

const get = (caller: TestUser | undefined, data: unknown) =>
  callCallable("getStructure", data, caller?.idToken);

let owner: TestUser;
const users = new Map<string, TestUser>();

// tenant-a: v1 {g1(c1), g2(c2)}, v2 {g3(c1)}, closed v3/c3/g4;
// tenant-b has its own documents that must never leak.
beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  owner = await createUser("owner-a@example.com");
  await memberships.save(membership(owner.uid, "tenant-a", "owner"));
  for (const role of ROLES.filter((r) => r !== "owner")) {
    const user = await createUser(`${role}@example.com`);
    users.set(role, user);
    await memberships.save(membership(user.uid, "tenant-a", role));
  }
  await venue("tenant-a", "v1");
  await venue("tenant-a", "v2", {facility: "Cancha 2"});
  await venue("tenant-a", "v3", {status: "closed"});
  await category("tenant-a", "c1");
  await category("tenant-a", "c2");
  await category("tenant-a", "c3", {status: "closed", birthYears: []});
  await group("tenant-a", "g1", "v1", "c1");
  await group("tenant-a", "g2", "v1", "c2");
  await group("tenant-a", "g3", "v2", "c1");
  await group("tenant-a", "g4", "v3", "c3", {status: "closed"});
  await venue("tenant-b", "vb");
  await category("tenant-b", "cb");
  await group("tenant-b", "gb", "vb", "cb");
});

const setScope = async (role: Role, scope: Partial<Scope>) =>
  memberships.save(membership(users.get(role)!.uid, "tenant-a", role, scope));

describe("getStructure — authentication and isolation", () => {
  it("rejects a caller without a session", async () => {
    const {status, body} = await get(undefined, {tenantId: "tenant-a"});
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
  });

  it("denies an owner of another tenant", async () => {
    const ownerB = await createUser("owner-b@example.com");
    await memberships.save(membership(ownerB.uid, "tenant-b", "owner"));
    const {status, body} = await get(ownerB, {tenantId: "tenant-a"});
    expect(status).toBe(403);
    expect(body.error.status).toBe("PERMISSION_DENIED");
  });

  it("never returns documents of another tenant", async () => {
    const {body} = await get(owner, {tenantId: "tenant-a"});
    const out = getStructureOutput.parse(body.result);
    expect(ids(out.venues)).toEqual(["v1", "v2"]);
    expect(ids(out.categories)).toEqual(["c1", "c2"]);
    expect(ids(out.groups)).toEqual(["g1", "g2", "g3"]);
  });

  it("rejects invalid input", async () => {
    expect((await get(owner, {})).body.error.status)
      .toBe("INVALID_ARGUMENT");
    expect((await get(owner, {tenantId: "tenant-a", includeClosed: "yes"}))
      .body.error.status).toBe("INVALID_ARGUMENT");
    expect((await get(owner, {tenantId: "tenant-a", extra: 1}))
      .body.error.status).toBe("INVALID_ARGUMENT");
  });

  it("is read-only: it writes nothing to the audit log", async () => {
    await get(owner, {tenantId: "tenant-a"});
    expect((await db.collection("tenants/tenant-a/auditLog").get()).size)
      .toBe(0);
  });
});

describe("getStructure — visibility by role", () => {
  it.each(["owner", "accountant"] as const)(
    "shows everything active to %s", async (role) => {
      const caller = role === "owner" ? owner : users.get(role)!;
      const {status, body} = await get(caller, {tenantId: "tenant-a"});
      expect(status).toBe(200);
      const out = getStructureOutput.parse(body.result);
      expect(ids(out.venues)).toEqual(["v1", "v2"]);
      expect(ids(out.categories)).toEqual(["c1", "c2"]);
      expect(ids(out.groups)).toEqual(["g1", "g2", "g3"]);
    });

  it("shows a coordinator only their venue, its groups, all categories",
    async () => {
      await setScope("coordinator", {venueIds: ["v1"]});
      const {body} = await get(users.get("coordinator"),
        {tenantId: "tenant-a"});
      const out = getStructureOutput.parse(body.result);
      expect(ids(out.venues)).toEqual(["v1"]);
      expect(ids(out.groups)).toEqual(["g1", "g2"]);
      expect(ids(out.categories)).toEqual(["c1", "c2"]);
    });

  it("shows a teacher only their groups, venues and categories",
    async () => {
      await setScope("teacher", {groupIds: ["g3"]});
      const {body} = await get(users.get("teacher"), {tenantId: "tenant-a"});
      const out = getStructureOutput.parse(body.result);
      expect(ids(out.groups)).toEqual(["g3"]);
      expect(ids(out.venues)).toEqual(["v2"]);
      expect(ids(out.categories)).toEqual(["c1"]);
    });

  it.each(["coordinator", "teacher"] as const)(
    "shows nothing to a %s with an empty scope", async (role) => {
      const {status, body} = await get(users.get(role),
        {tenantId: "tenant-a"});
      expect(status).toBe(200);
      expect(body.result).toEqual({venues: [], categories: [], groups: []});
    });

  it.each(["guardian", "adultPlayer"] as const)(
    "denies %s", async (role) => {
      const {status, body} = await get(users.get(role),
        {tenantId: "tenant-a"});
      expect(status).toBe(403);
      expect(body.error.status).toBe("PERMISSION_DENIED");
    });
});

describe("getStructure — closed records", () => {
  it("omits closed records by default", async () => {
    const {body} = await get(owner, {tenantId: "tenant-a"});
    const out = getStructureOutput.parse(body.result);
    expect(out.venues.every((v) => v.status === "active")).toBe(true);
    expect(ids(out.groups)).not.toContain("g4");
  });

  it("returns them with includeClosed: true", async () => {
    const {body} = await get(owner,
      {tenantId: "tenant-a", includeClosed: true});
    const out = getStructureOutput.parse(body.result);
    expect(ids(out.venues)).toEqual(["v1", "v2", "v3"]);
    expect(ids(out.categories)).toEqual(["c1", "c2", "c3"]);
    expect(ids(out.groups)).toEqual(["g1", "g2", "g3", "g4"]);
    expect(out.venues.find((v) => v.id === "v3")!.status).toBe("closed");
  });

  it("does not show a teacher the venue of a group that is hidden",
    async () => {
      await setScope("teacher", {groupIds: ["g1", "g4"]});
      const {body} = await get(users.get("teacher"), {tenantId: "tenant-a"});
      const out = getStructureOutput.parse(body.result);
      expect(ids(out.groups)).toEqual(["g1"]);
      expect(ids(out.venues)).toEqual(["v1"]);
      expect(ids(out.categories)).toEqual(["c1"]);
    });
});

describe("getStructure — shape", () => {
  it("returns DTOs with ISO UTC dates, no tenantId and stable name order",
    async () => {
      const {body} = await get(owner, {tenantId: "tenant-a"});
      const out = getStructureOutput.parse(body.result);
      expect(out.venues.map((v) => v.name)).toEqual(["Sede v1", "Sede v2"]);
      expect(out.venues[1]).toEqual({
        id: "v2",
        name: "Sede v2",
        address: "Calle 1",
        facility: "Cancha 2",
        status: "active",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      });
      expect("facility" in out.venues[0]).toBe(false);
      expect("tenantId" in out.groups[0]).toBe(false);
      expect(out.groups[0]).toMatchObject({
        venueId: "v1",
        categoryId: "c1",
        schedule: [{weekday: 2, start: "17:00", end: "18:30"}],
      });
      expect(out.categories[0]).toMatchObject({birthYears: [2015]});
    });
});
