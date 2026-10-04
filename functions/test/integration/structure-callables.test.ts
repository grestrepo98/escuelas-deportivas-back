import {ROLES, type Membership, type Role} from "@escuelas/domain";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {
  FirestoreMembershipRepository,
} from "../../src/adapters/firestore/index.js";
import {
  callCallable,
  clearAuth,
  createUser,
  type TestUser,
} from "./emulator-helpers.js";
import {clearFirestore, testDb} from "./helpers.js";

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
  await db.doc("tenants/tenant-a").set({
    name: "Argentinos Juniors",
    status: "active",
    createdAt: Timestamp.fromDate(T0),
  });
});

const WRITES: [string, () => unknown][] = [
  ["updateTenantProfile", () => ({tenantId: "tenant-a", name: "Nuevo",
    contact: {}})],
  ["saveVenue", () => ({tenantId: "tenant-a", name: "Sede Sur",
    address: "Calle 9"})],
  ["setVenueStatus", () => ({tenantId: "tenant-a", venueId: "venue-1",
    status: "closed"})],
];

describe("authentication and tenant isolation (all three callables)", () => {
  it.each(WRITES)("%s rejects a caller without a session", async (n, data) => {
    const {status, body} = await call(n, undefined, data());
    expect(status).toBe(401);
    expect(body.error.status).toBe("UNAUTHENTICATED");
  });

  it.each(WRITES)("%s denies an owner of another tenant", async (n, data) => {
    await seedVenue("venue-1");
    const {status, body} = await call(n, ownerB, data());
    expect(status).toBe(403);
    expect(body.error.status).toBe("PERMISSION_DENIED");
    expect(await audit()).toHaveLength(0);
  });

  const NON_OWNERS = ROLES.filter((r) => r !== "owner");
  for (const [name, data] of WRITES) {
    it.each(NON_OWNERS)(`${name} denies %s`, async (role) => {
      await seedVenue("venue-1");
      const {status, body} = await call(name, byRole.get(role), data());
      expect(status).toBe(403);
      expect(body.error.status).toBe("PERMISSION_DENIED");
      expect(await audit()).toHaveLength(0);
    });
  }
});

describe("updateTenantProfile", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    name: "Argentinos Juniors Cali",
    idrdRegistration: "IDRD-9",
    contact: {email: "info@aj.co", phone: "300"},
    ...overrides,
  });

  it("updates the profile and writes exactly one audit entry", async () => {
    const {status, body} = await call("updateTenantProfile", owner, input());
    expect(status).toBe(200);
    expect(body.result).toEqual({tenantId: "tenant-a"});
    const doc = (await db.doc("tenants/tenant-a").get()).data()!;
    expect(doc).toMatchObject({
      name: "Argentinos Juniors Cali",
      idrdRegistration: "IDRD-9",
      contact: {email: "info@aj.co", phone: "300"},
      status: "active",
    });
    const entries = await audit();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUid: owner.uid,
      actorRole: "owner",
      action: "tenant.updated",
      target: {type: "tenant", id: "tenant-a"},
      before: {name: "Argentinos Juniors"},
      after: {name: "Argentinos Juniors Cali"},
    });
  });

  it("rejects a malformed email as invalid-argument", async () => {
    const {status, body} = await call(
      "updateTenantProfile", owner, input({contact: {email: "not-an-email"}}),
    );
    expect(status).toBe(400);
    expect(body.error.status).toBe("INVALID_ARGUMENT");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects a blank name as invalid-argument", async () => {
    const {body} = await call("updateTenantProfile", owner,
      input({name: "  "}));
    expect(body.error.status).toBe("INVALID_ARGUMENT");
  });

  it("rejects unknown fields and a missing tenantId", async () => {
    expect((await call("updateTenantProfile", owner,
      input({status: "suspended"}))).body.error.status)
      .toBe("INVALID_ARGUMENT");
    expect((await call("updateTenantProfile", owner,
      {name: "x", contact: {}})).body.error.status)
      .toBe("INVALID_ARGUMENT");
  });
});

describe("saveVenue", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    name: "Sede Sur",
    address: "Calle 9",
    ...overrides,
  });

  it("creates a venue, returns its id and audits it once", async () => {
    const {status, body} = await call("saveVenue", owner,
      input({facility: "Cancha 2"}));
    expect(status).toBe(200);
    const venueId = body.result.venueId as string;
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
      action: "venue.created",
      target: {type: "venue", id: venueId},
      before: {},
    });
  });

  it("updates an existing venue", async () => {
    await seedVenue("venue-1");
    const {body} = await call("saveVenue", owner,
      input({venueId: "venue-1", name: "Sede Centro"}));
    expect(body.result).toEqual({venueId: "venue-1"});
    expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!
      .name).toBe("Sede Centro");
    expect((await audit())[0]).toMatchObject({
      action: "venue.updated",
      before: {name: "Sede Norte"},
      after: {name: "Sede Centro"},
    });
  });

  it("rejects a duplicate active name as failed-precondition", async () => {
    await seedVenue("venue-1");
    const {status, body} = await call("saveVenue", owner,
      input({name: "sede norte"}));
    expect(status).toBe(400);
    expect(body.error.status).toBe("FAILED_PRECONDITION");
    expect(await audit()).toHaveLength(0);
  });

  it("rejects a blank name as invalid-argument", async () => {
    const {body} = await call("saveVenue", owner, input({name: " "}));
    expect(body.error.status).toBe("INVALID_ARGUMENT");
  });

  it("rejects a missing venue as not-found", async () => {
    const {status, body} = await call("saveVenue", owner,
      input({venueId: "nope"}));
    expect(status).toBe(404);
    expect(body.error.status).toBe("NOT_FOUND");
  });

  it("cannot reach a venue of another tenant", async () => {
    await db.doc("tenants/tenant-b/venues/venue-b").set({
      name: "Sede B",
      address: "x",
      status: "active",
      createdAt: Timestamp.fromDate(T0),
      updatedAt: Timestamp.fromDate(T0),
    });
    const {body} = await call("saveVenue", owner, input({venueId: "venue-b"}));
    expect(body.error.status).toBe("NOT_FOUND");
    expect((await db.doc("tenants/tenant-b/venues/venue-b").get()).data()!
      .name).toBe("Sede B");
  });
});

describe("setVenueStatus", () => {
  const input = (overrides = {}) => ({
    tenantId: "tenant-a",
    venueId: "venue-1",
    status: "closed",
    ...overrides,
  });

  beforeEach(async () => {
    await seedVenue("venue-1");
  });

  it("closes and reopens, auditing each change with its reason", async () => {
    const closed = await call("setVenueStatus", owner,
      input({reason: "Obras"}));
    expect(closed.body.result).toEqual({venueId: "venue-1", status: "closed"});
    const reopened = await call("setVenueStatus", owner,
      input({status: "active"}));
    expect(reopened.body.result)
      .toEqual({venueId: "venue-1", status: "active"});

    const entries = await audit();
    expect(entries).toHaveLength(2);
    const actions = entries.map((e) => e.action).sort();
    expect(actions).toEqual(["venue.closed", "venue.reopened"]);
    expect(entries.find((e) => e.action === "venue.closed")!.reason)
      .toBe("Obras");
  });

  it("never deletes the venue document", async () => {
    await call("setVenueStatus", owner, input());
    expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).exists)
      .toBe(true);
  });

  it("rejects closing a venue with active groups, changing nothing",
    async () => {
      await seedGroup("group-1");
      const {status, body} = await call("setVenueStatus", owner, input());
      expect(status).toBe(400);
      expect(body.error.status).toBe("FAILED_PRECONDITION");
      expect((await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!
        .status).toBe("active");
      expect(await audit()).toHaveLength(0);
    });

  it("rejects an invalid status value", async () => {
    const {body} = await call("setVenueStatus", owner,
      input({status: "deleted"}));
    expect(body.error.status).toBe("INVALID_ARGUMENT");
  });

  it("rejects a missing venue as not-found", async () => {
    const {body} = await call("setVenueStatus", owner,
      input({venueId: "nope"}));
    expect(body.error.status).toBe("NOT_FOUND");
  });
});
