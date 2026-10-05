import type {AuditEntry} from "../../../../../src/audit/domain/audit-entry.js";
import type {
  Category,
  Group,
  Venue,
} from "../../../../../src/structure/domain/structure.js";
import type {Tenant} from "../../../../../src/tenant/domain/tenant.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreUnitOfWork} from "../../../../../src/shared/infrastructure/firestore-unit-of-work.js";
import {
  clearFirestore,
  testDb,
} from "../../../../../src/shared/infrastructure/testing/helpers.js";

const db = testDb();
const uow = new FirestoreUnitOfWork(db);

const T0 = new Date("2026-10-01T00:00:00Z");
const T1 = new Date("2026-10-02T00:00:00Z");

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: "tenant-a",
  name: "Argentinos Juniors",
  status: "active",
  idrdRegistration: "IDRD-1",
  contact: {email: "info@aj.co", phone: "300"},
  createdAt: T0,
  updatedAt: T1,
  ...overrides,
});

const venue = (overrides: Partial<Venue> = {}): Venue => ({
  id: "venue-1",
  tenantId: "tenant-a",
  name: "Sede Norte",
  address: "Calle 1",
  facility: "Cancha 2",
  status: "active",
  createdAt: T0,
  updatedAt: T1,
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: "cat-1",
  tenantId: "tenant-a",
  name: "Sub-10",
  birthYears: [2015, 2016],
  status: "active",
  createdAt: T0,
  updatedAt: T1,
  ...overrides,
});

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-1",
  tenantId: "tenant-a",
  venueId: "venue-1",
  categoryId: "cat-1",
  name: "Grupo A",
  schedule: [{weekday: 2, start: "17:00", end: "18:30"}],
  status: "active",
  createdAt: T0,
  updatedAt: T1,
  ...overrides,
});

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  actorRole: "owner",
  action: "venue.updated",
  target: {type: "venue", id: "venue-1"},
  before: {name: "Sede Norte"},
  after: {name: "Cambiada"},
  device: {},
  ...overrides,
});

const auditCount = async () =>
  (await db.collection("tenants/tenant-a/auditLog").get()).size;

beforeEach(clearFirestore);

describe("FirestoreTenantRepository", () => {
  it("returns null for a missing tenant", async () => {
    expect(await uow.run((tx) => tx.tenants.get("tenant-a"))).toBeNull();
  });

  it("round-trips the profile at tenants/{tenantId}", async () => {
    await uow.run((tx) => tx.tenants.save(tenant()));
    expect(await uow.run((tx) => tx.tenants.get("tenant-a"))).toEqual(tenant());
    const raw = (await db.doc("tenants/tenant-a").get()).data()!;
    expect(raw.createdAt).toBeInstanceOf(Timestamp);
    expect(raw.updatedAt).toBeInstanceOf(Timestamp);
    expect("id" in raw).toBe(false);
  });

  it("omits an absent idrdRegistration and contact fields", async () => {
    await uow.run((tx) =>
      tx.tenants.save(tenant({idrdRegistration: undefined, contact: {}})),
    );
    const raw = (await db.doc("tenants/tenant-a").get()).data()!;
    expect("idrdRegistration" in raw).toBe(false);
    expect(raw.contact).toEqual({});
  });

  it("reads a tenant written before spec 02 (no contact, no updatedAt)", async () => {
    await db.doc("tenants/tenant-a").set({
      name: "Argentinos Juniors",
      status: "active",
      createdAt: Timestamp.fromDate(T0),
    });
    expect(await uow.run((tx) => tx.tenants.get("tenant-a"))).toEqual({
      id: "tenant-a",
      name: "Argentinos Juniors",
      status: "active",
      contact: {},
      createdAt: T0,
      updatedAt: T0,
    });
  });
});

describe("Firestore venues", () => {
  it("round-trips at tenants/{tenantId}/venues/{venueId}", async () => {
    await uow.run((tx) => tx.venues.save(venue()));
    expect(await uow.run((tx) => tx.venues.get("tenant-a", "venue-1"))).toEqual(
      venue(),
    );
    const raw = (await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!;
    expect(raw.createdAt).toBeInstanceOf(Timestamp);
    expect("id" in raw).toBe(false);
    expect("tenantId" in raw).toBe(false);
  });

  it("removes facility when saved without it", async () => {
    await uow.run((tx) => tx.venues.save(venue()));
    await uow.run((tx) => tx.venues.save(venue({facility: undefined})));
    const raw = (await db.doc("tenants/tenant-a/venues/venue-1").get()).data()!;
    expect("facility" in raw).toBe(false);
  });

  it("isolates tenants on get and list", async () => {
    await uow.run((tx) => tx.venues.save(venue()));
    await uow.run((tx) => tx.venues.save(venue({id: "venue-2"})));
    await uow.run((tx) =>
      tx.venues.save(venue({id: "venue-3", tenantId: "tenant-b"})),
    );
    expect(
      await uow.run((tx) => tx.venues.get("tenant-b", "venue-1")),
    ).toBeNull();
    const listed = await uow.run((tx) => tx.venues.listByTenant("tenant-a"));
    expect(listed.map((v) => v.id).sort()).toEqual(["venue-1", "venue-2"]);
    expect(listed.every((v) => v.tenantId === "tenant-a")).toBe(true);
  });

  it("generates distinct ids", async () => {
    await uow.run(async (tx) => {
      expect(tx.venues.newId()).not.toBe(tx.venues.newId());
    });
  });
});

describe("Firestore categories", () => {
  it("round-trips and keeps an empty birthYears list", async () => {
    await uow.run((tx) => tx.categories.save(category()));
    await uow.run((tx) =>
      tx.categories.save(
        category({id: "cat-2", name: "Avanzados", birthYears: []}),
      ),
    );
    expect(
      await uow.run((tx) => tx.categories.get("tenant-a", "cat-1")),
    ).toEqual(category());
    expect(
      (await uow.run((tx) => tx.categories.get("tenant-a", "cat-2")))!
        .birthYears,
    ).toEqual([]);
    const listed = await uow.run((tx) =>
      tx.categories.listByTenant("tenant-a"),
    );
    expect(listed).toHaveLength(2);
    expect(
      await uow.run((tx) => tx.categories.listByTenant("tenant-b")),
    ).toEqual([]);
  });
});

describe("Firestore groups", () => {
  it("round-trips with its schedule", async () => {
    await uow.run((tx) => tx.groups.save(group()));
    expect(await uow.run((tx) => tx.groups.get("tenant-a", "group-1"))).toEqual(
      group(),
    );
    const raw = (await db.doc("tenants/tenant-a/groups/group-1").get()).data()!;
    expect(raw.venueId).toBe("venue-1");
    expect(raw.schedule).toEqual([{weekday: 2, start: "17:00", end: "18:30"}]);
  });

  it("lists only the groups of the requested tenant", async () => {
    await uow.run((tx) => tx.groups.save(group()));
    await uow.run((tx) =>
      tx.groups.save(group({id: "group-2", tenantId: "tenant-b"})),
    );
    const listed = await uow.run((tx) => tx.groups.listByTenant("tenant-a"));
    expect(listed.map((g) => g.id)).toEqual(["group-1"]);
  });
});

describe("FirestoreUnitOfWork — structure atomicity", () => {
  beforeEach(async () => {
    await uow.run((tx) => tx.venues.save(venue()));
  });

  const nameOf = async () =>
    (await db.doc("tenants/tenant-a/venues/venue-1").get()).data()?.name;

  it("commits the venue and its audit entry together", async () => {
    await uow.run(async (tx) => {
      await tx.venues.save(venue({name: "Cambiada"}));
      await tx.auditLog.append(entry());
    });
    expect(await nameOf()).toBe("Cambiada");
    expect(await auditCount()).toBe(1);
  });

  it("does not change the venue when the work throws", async () => {
    await expect(
      uow.run(async (tx) => {
        await tx.venues.save(venue({name: "Cambiada"}));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await nameOf()).toBe("Sede Norte");
    expect(await auditCount()).toBe(0);
  });

  it("does not change the venue when Firestore rejects the audit write", async () => {
    const invalid = entry({before: {name: undefined}});
    await expect(
      uow.run(async (tx) => {
        await tx.venues.save(venue({name: "Cambiada"}));
        await tx.auditLog.append(invalid);
      }),
    ).rejects.toThrow();
    expect(await nameOf()).toBe("Sede Norte");
    expect(await auditCount()).toBe(0);
  });

  it("does not change the tenant profile when the audit write fails", async () => {
    await uow.run((tx) => tx.tenants.save(tenant()));
    const invalid = entry({
      action: "tenant.updated",
      target: {type: "tenant", id: "tenant-a"},
      before: {name: undefined},
    });
    await expect(
      uow.run(async (tx) => {
        await tx.tenants.save(tenant({name: "Cambiada"}));
        await tx.auditLog.append(invalid);
      }),
    ).rejects.toThrow();
    expect((await db.doc("tenants/tenant-a").get()).data()!.name).toBe(
      "Argentinos Juniors",
    );
  });
});
