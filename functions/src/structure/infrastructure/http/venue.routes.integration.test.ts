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

const audit = async (tenantId = "tenant-a") =>
  (await db.collection(`tenants/${tenantId}/auditLog`).get())
    .docs.map((d) => d.data());

const seedVenue = (id: string, fields: Record<string, unknown> = {}) =>
  db.doc(`tenants/tenant-a/venues/${id}`).set({
    name: "Sede Norte",
    address: "Calle 1",
    status: "active",
    createdAt: Timestamp.fromDate(T0),
    updatedAt: Timestamp.fromDate(T0),
    ...fields,
  });

const seedGroup = (id: string, fields: Record<string, unknown> = {}) =>
  db.doc(`tenants/tenant-a/groups/${id}`).set({
    venueId: "venue-1",
    categoryId: "cat-1",
    name: "Grupo A",
    schedule: [],
    status: "active",
    createdAt: Timestamp.fromDate(T0),
    updatedAt: Timestamp.fromDate(T0),
    ...fields,
  });

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
  await db.doc("tenants/tenant-a").set({
    name: "Argentinos Juniors",
    status: "active",
    createdAt: Timestamp.fromDate(T0),
  });
});

const VENUES = "/tenants/tenant-a/venues";

type Route = {
  name: string;
  method: Method;
  path: string;
  body: () => unknown;
  invalid: [string, unknown][];
};

const ROUTES: Route[] = [
  {
    name: "POST /venues",
    method: "POST",
    path: VENUES,
    body: () => ({name: "Sede Sur", address: "Calle 9"}),
    invalid: [
      ["missing address", {name: "Sede Sur"}],
      ["non-string name", {name: 7, address: "Calle 9"}],
      ["blank name", {name: " ", address: "Calle 9"}],
      ["unexpected field", {name: "Sede Sur", address: "x", status: "closed"}],
      ["venueId in the body", {name: "Sede Sur", address: "x", venueId: "v"}],
    ],
  },
  {
    name: "PUT /venues/:venueId",
    method: "PUT",
    path: `${VENUES}/venue-1`,
    body: () => ({name: "Sede Centro", address: "Calle 9"}),
    invalid: [
      ["missing name", {address: "Calle 9"}],
      ["non-string address", {name: "Sede Centro", address: 7}],
      ["blank name", {name: " ", address: "Calle 9"}],
      ["unexpected field", {name: "Sede Centro", address: "x", status: "x"}],
    ],
  },
  {
    name: "PATCH /venues/:venueId/status",
    method: "PATCH",
    path: `${VENUES}/venue-1/status`,
    body: () => ({status: "closed"}),
    invalid: [
      ["missing status", {}],
      ["status out of range", {status: "deleted"}],
      ["non-string reason", {status: "closed", reason: 7}],
      ["unexpected field", {status: "closed", venueId: "venue-1"}],
    ],
  },
];

describe("venue routes — authentication, isolation and validation", () => {
  beforeEach(async () => {
    await seedVenue("venue-1");
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

describe("POST /venues", () => {
  const input = (overrides = {}) => ({
    name: "Sede Sur",
    address: "Calle 9",
    ...overrides,
  });

  it("creates a venue, returns its id with 201 and audits it once",
    async () => {
      const {status, body} = await api(
        "POST", VENUES, owner, input({facility: "Cancha 2"}));
      expect(status).toBe(201);
      const venueId = body.venueId as string;
      expect(venueId).toBeTruthy();
      const doc = (await db.doc(`tenants/tenant-a/venues/${venueId}`).get())
        .data()!;
      expect(doc).toMatchObject({
        name: "Sede Sur",
        address: "Calle 9",
        facility: "Cancha 2",
        status: "active",
      });
      const entries = await audit();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorUid: owner.uid,
        action: "venue.created",
        target: {type: "venue", id: venueId},
        before: {},
      });
    });

  it("rejects a duplicate active name as failed_precondition", async () => {
    await seedVenue("venue-1");
    const {status, body} = await api(
      "POST", VENUES, owner, input({name: "sede norte"}));
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
    expect(await audit()).toHaveLength(0);
  });
});

describe("PUT /venues/:venueId", () => {
  const input = (overrides = {}) => ({
    name: "Sede Centro",
    address: "Calle 9",
    ...overrides,
  });

  it("updates an existing venue", async () => {
    await seedVenue("venue-1");
    const {status, body} = await api(
      "PUT", `${VENUES}/venue-1`, owner, input());
    expect(status).toBe(200);
    expect(body).toEqual({venueId: "venue-1"});
    expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!
      .name).toBe("Sede Centro");
    expect((await audit())[0]).toMatchObject({
      action: "venue.updated",
      before: {name: "Sede Norte"},
      after: {name: "Sede Centro"},
    });
  });

  it("rejects renaming onto another active venue's name", async () => {
    await seedVenue("venue-1");
    await seedVenue("venue-2", {name: "Sede Centro"});
    const {status, body} = await api(
      "PUT", `${VENUES}/venue-1`, owner, input({name: "sede centro"}));
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
  });

  it("rejects a missing venue as not_found", async () => {
    const {status, body} = await api(
      "PUT", `${VENUES}/nope`, owner, input());
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("cannot reach a venue of another tenant", async () => {
    await db.doc("tenants/tenant-b/venues/venue-b").set({
      name: "Sede B",
      address: "x",
      status: "active",
      createdAt: Timestamp.fromDate(T0),
      updatedAt: Timestamp.fromDate(T0),
    });
    const {status, body} = await api(
      "PUT", `${VENUES}/venue-b`, owner, input());
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect((await db.doc("tenants/tenant-b/venues/venue-b").get()).data()!
      .name).toBe("Sede B");
  });
});

describe("PATCH /venues/:venueId/status", () => {
  const patch = (body: unknown, venueId = "venue-1") =>
    api("PATCH", `${VENUES}/${venueId}/status`, owner, body);

  beforeEach(async () => {
    await seedVenue("venue-1");
  });

  it("closes and reopens, auditing each change with its reason", async () => {
    const closed = await patch({status: "closed", reason: "Obras"});
    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({venueId: "venue-1", status: "closed"});
    const reopened = await patch({status: "active"});
    expect(reopened.body).toEqual({venueId: "venue-1", status: "active"});

    const entries = await audit();
    expect(entries).toHaveLength(2);
    const actions = entries.map((e) => e.action).sort();
    expect(actions).toEqual(["venue.closed", "venue.reopened"]);
    expect(entries.find((e) => e.action === "venue.closed")!.reason)
      .toBe("Obras");
  });

  it("never deletes the venue document", async () => {
    await patch({status: "closed"});
    expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).exists)
      .toBe(true);
  });

  it("rejects closing a venue with active groups, changing nothing",
    async () => {
      await seedGroup("group-1");
      const {status, body} = await patch({status: "closed"});
      expect(status).toBe(409);
      expect(body.error.code).toBe("failed_precondition");
      expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!
        .status).toBe("active");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects a missing venue as not_found", async () => {
    const {status, body} = await patch({status: "closed"}, "nope");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("structureApi — shared behavior", () => {
  it("answers 404 on an unknown route", async () => {
    const {status, body} = await callApi(
      "structureApi", "GET", "/nowhere", undefined, owner.idToken);
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("answers 404 on a method the route does not have", async () => {
    const {status, body} = await callApi(
      "structureApi", "DELETE", `${VENUES}/venue-1`, undefined, owner.idToken);
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});
