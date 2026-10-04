import {describe, expect, it} from "vitest";
import type {Membership} from "../../../membership/domain/membership.js";
import type {AuditEntry} from "../../../audit/domain/audit-entry.js";
import type {Tenant} from "../../../tenant/domain/tenant.js";
import type {Venue} from "../../../structure/domain/structure.js";
import {FakeClock} from "./fake-clock.js";
import {
  InMemoryAuditLogWriter,
} from "../../../audit/application/testing/in-memory-audit-log-writer.js";
import {
  InMemoryMembershipRepository,
} from "../../../membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "./in-memory-unit-of-work.js";

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const entry = (): AuditEntry => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  actorRole: "owner",
  action: "membership.role_changed",
  target: {type: "membership", id: "u1_tenant-a"},
  before: {role: "coordinator"},
  after: {role: "accountant"},
  device: {},
});

const setup = () => {
  const clock = new FakeClock(new Date("2026-10-03T12:00:00Z"));
  const memberships = new InMemoryMembershipRepository();
  const auditLog = new InMemoryAuditLogWriter(clock);
  const uow = new InMemoryUnitOfWork(memberships, auditLog);
  return {clock, memberships, auditLog, uow};
};

describe("FakeClock", () => {
  it("returns the configured instant and can be advanced", () => {
    const clock = new FakeClock(new Date("2026-10-03T12:00:00Z"));
    expect(clock.now().toISOString()).toBe("2026-10-03T12:00:00.000Z");
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe("2026-10-03T12:00:01.000Z");
  });
});

describe("InMemoryMembershipRepository", () => {
  it("returns null for a missing membership", async () => {
    const {memberships} = setup();
    expect(await memberships.get("u1", "tenant-a")).toBeNull();
  });

  it("saves and reads back by uid and tenant", async () => {
    const {memberships} = setup();
    await memberships.save(membership());
    expect(await memberships.get("u1", "tenant-a")).toEqual(membership());
    expect(await memberships.get("u1", "tenant-b")).toBeNull();
  });

  it("does not leak mutations through returned objects", async () => {
    const {memberships} = setup();
    await memberships.save(membership());
    const read = await memberships.get("u1", "tenant-a");
    read!.role = "owner";
    expect((await memberships.get("u1", "tenant-a"))!.role)
      .toBe("coordinator");
  });

  it("counts active memberships by role within one tenant", async () => {
    const {memberships} = setup();
    await memberships.save(membership({uid: "o1", role: "owner"}));
    await memberships.save(membership({uid: "o2", role: "owner"}));
    await memberships.save(
      membership({uid: "o3", role: "owner", status: "inactive"}),
    );
    await memberships.save(
      membership({uid: "o4", role: "owner", tenantId: "tenant-b"}),
    );
    await memberships.save(membership({uid: "c1", role: "coordinator"}));
    expect(await memberships.countActiveByRole("tenant-a", "owner")).toBe(2);
  });
});

describe("InMemoryAuditLogWriter", () => {
  it("stamps each entry with the clock time", async () => {
    const {auditLog} = setup();
    await auditLog.append(entry());
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0].at.toISOString())
      .toBe("2026-10-03T12:00:00.000Z");
    expect(auditLog.entries[0].actorUid).toBe("owner-1");
  });
});

describe("InMemoryUnitOfWork", () => {
  it("returns the work result and keeps its writes on success", async () => {
    const {memberships, auditLog, uow} = setup();
    const result = await uow.run(async (tx) => {
      await tx.memberships.save(membership());
      await tx.auditLog.append(entry());
      return "done";
    });
    expect(result).toBe("done");
    expect(await memberships.get("u1", "tenant-a")).not.toBeNull();
    expect(auditLog.entries).toHaveLength(1);
  });

  it("rolls back membership writes when the work throws", async () => {
    const {memberships, auditLog, uow} = setup();
    await memberships.save(membership());
    await expect(uow.run(async (tx) => {
      await tx.memberships.save(membership({role: "owner"}));
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect((await memberships.get("u1", "tenant-a"))!.role)
      .toBe("coordinator");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rolls back the membership when the audit write fails", async () => {
    const {memberships, auditLog, uow} = setup();
    await memberships.save(membership());
    auditLog.failWith = new Error("audit down");
    await expect(uow.run(async (tx) => {
      await tx.memberships.save(membership({role: "owner"}));
      await tx.auditLog.append(entry());
    })).rejects.toThrow("audit down");
    expect((await memberships.get("u1", "tenant-a"))!.role)
      .toBe("coordinator");
    expect(auditLog.entries).toHaveLength(0);
  });
});

const venue = (overrides: Partial<Venue> = {}): Venue => ({
  id: "venue-1",
  tenantId: "tenant-a",
  name: "Sede Norte",
  address: "Calle 1",
  status: "active",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: "tenant-a",
  name: "Argentinos Juniors",
  status: "active",
  contact: {},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("InMemoryTenantRepository", () => {
  it("returns null when missing and reads back what was saved", async () => {
    const {uow} = setup();
    expect(await uow.tenants.get("tenant-a")).toBeNull();
    await uow.tenants.save(tenant());
    expect(await uow.tenants.get("tenant-a")).toEqual(tenant());
  });
});

describe("InMemoryStructureRepository (venues)", () => {
  it("generates distinct ids", () => {
    const {uow} = setup();
    expect(uow.venues.newId()).not.toBe(uow.venues.newId());
  });

  it("gets by tenant and id, isolating tenants", async () => {
    const {uow} = setup();
    await uow.venues.save(venue());
    expect(await uow.venues.get("tenant-a", "venue-1")).toEqual(venue());
    expect(await uow.venues.get("tenant-b", "venue-1")).toBeNull();
  });

  it("lists only the venues of the requested tenant", async () => {
    const {uow} = setup();
    await uow.venues.save(venue());
    await uow.venues.save(venue({id: "venue-2"}));
    await uow.venues.save(venue({id: "venue-3", tenantId: "tenant-b"}));
    const listed = await uow.venues.listByTenant("tenant-a");
    expect(listed.map((v) => v.id).sort()).toEqual(["venue-1", "venue-2"]);
  });

  it("does not leak mutations through returned objects", async () => {
    const {uow} = setup();
    await uow.venues.save(venue());
    const read = await uow.venues.get("tenant-a", "venue-1");
    read!.name = "Otro";
    expect((await uow.venues.get("tenant-a", "venue-1"))!.name)
      .toBe("Sede Norte");
  });
});

describe("InMemoryUnitOfWork with structure repositories", () => {
  it("rolls back venue and tenant when the audit write fails", async () => {
    const {uow, auditLog} = setup();
    await uow.venues.save(venue());
    await uow.tenants.save(tenant());
    auditLog.failWith = new Error("audit down");
    await expect(uow.run(async (tx) => {
      await tx.venues.save(venue({name: "Cambiada"}));
      await tx.tenants.save(tenant({name: "Cambiada"}));
      await tx.auditLog.append(entry());
    })).rejects.toThrow("audit down");
    expect((await uow.venues.get("tenant-a", "venue-1"))!.name)
      .toBe("Sede Norte");
    expect((await uow.tenants.get("tenant-a"))!.name)
      .toBe("Argentinos Juniors");
  });

  it("exposes categories and groups in the transaction", async () => {
    const {uow} = setup();
    await uow.run(async (tx) => {
      expect(await tx.categories.listByTenant("tenant-a")).toEqual([]);
      expect(await tx.groups.listByTenant("tenant-a")).toEqual([]);
    });
  });
});
