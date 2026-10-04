import {beforeEach, describe, expect, it} from "vitest";
import {SaveVenue} from "../../src/structure/save-venue.js";
import {SetVenueStatus} from "../../src/structure/set-venue-status.js";
import {DomainError} from "../../src/errors.js";
import type {Membership} from "../../src/membership/membership.js";
import type {Role} from "../../src/membership/role.js";
import type {Group, Venue} from "../../src/structure/structure.js";
import {
  FakeClock,
  InMemoryAuditLogWriter,
  InMemoryMembershipRepository,
  InMemoryUnitOfWork,
} from "../fakes/index.js";

const T0 = new Date("2026-10-01T00:00:00Z");
const NOW = new Date("2026-10-03T12:00:00Z");

const member = (
  uid: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId: "tenant-a",
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const venue = (overrides: Partial<Venue> = {}): Venue => ({
  id: "venue-x",
  tenantId: "tenant-a",
  name: "Sede Norte",
  address: "Calle 1",
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-x",
  tenantId: "tenant-a",
  venueId: "venue-x",
  categoryId: "cat-1",
  name: "Sub-10",
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let uow: InMemoryUnitOfWork;
let saveVenue: SaveVenue;
let setStatus: SetVenueStatus;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  saveVenue = new SaveVenue(uow, clock);
  setStatus = new SetVenueStatus(uow, clock);
  await memberships.save(member("owner-1", "owner"));
});

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error("expected the use case to be rejected");
};

const create = (overrides = {}) => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  name: "Sede Norte",
  address: "Calle 1",
  ...overrides,
});

describe("SaveVenue — create", () => {
  it("creates an active venue and one audit entry", async () => {
    const {venueId} = await saveVenue.execute(
      create({facility: "Cancha 2"}),
    );
    const saved = (await uow.venues.get("tenant-a", venueId))!;
    expect(saved).toMatchObject({
      name: "Sede Norte",
      address: "Calle 1",
      facility: "Cancha 2",
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "venue.created",
      target: {type: "venue", id: venueId},
      before: {},
    });
    expect(auditLog.entries[0].after).toMatchObject({name: "Sede Norte"});
  });

  it("omits facility when it is not given", async () => {
    const {venueId} = await saveVenue.execute(create());
    const saved = (await uow.venues.get("tenant-a", venueId))!;
    expect("facility" in saved).toBe(false);
  });

  it.each<Role>(["coordinator", "accountant", "teacher", "guardian",
    "adultPlayer"])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(saveVenue.execute(create({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const code = await rejection(
      saveVenue.execute(create({actorUid: "owner-b"})),
    );
    expect(code).toBe("permission_denied");
  });

  it("rejects an inactive owner", async () => {
    await memberships.save(member("o2", "owner", {status: "inactive"}));
    const code = await rejection(saveVenue.execute(create({actorUid: "o2"})));
    expect(code).toBe("permission_denied");
  });

  it("rejects a blank name or address", async () => {
    expect(await rejection(saveVenue.execute(create({name: " "}))))
      .toBe("invalid_argument");
    expect(await rejection(saveVenue.execute(create({address: ""}))))
      .toBe("invalid_argument");
  });

  it("rejects a name used by an active venue, ignoring case", async () => {
    await uow.venues.save(venue());
    const code = await rejection(
      saveVenue.execute(create({name: "  sede NORTE "})),
    );
    expect(code).toBe("failed_precondition");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("allows reusing the name of a closed venue", async () => {
    await uow.venues.save(venue({status: "closed"}));
    await expect(saveVenue.execute(create())).resolves.toBeDefined();
  });

  it("allows the same name in another tenant", async () => {
    await uow.venues.save(venue({tenantId: "tenant-b"}));
    await expect(saveVenue.execute(create())).resolves.toBeDefined();
  });
});

describe("SaveVenue — update", () => {
  beforeEach(async () => {
    await uow.venues.save(venue());
  });

  it("updates fields, keeps createdAt and records before/after", async () => {
    const result = await saveVenue.execute(
      create({venueId: "venue-x", name: "Sede Sur", address: "Calle 9"}),
    );
    expect(result).toEqual({venueId: "venue-x"});
    const saved = (await uow.venues.get("tenant-a", "venue-x"))!;
    expect(saved).toMatchObject({
      name: "Sede Sur",
      address: "Calle 9",
      status: "active",
      createdAt: T0,
      updatedAt: NOW,
    });
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      action: "venue.updated",
      target: {type: "venue", id: "venue-x"},
      before: {name: "Sede Norte", address: "Calle 1"},
      after: {name: "Sede Sur", address: "Calle 9"},
    });
  });

  it("allows keeping its own name", async () => {
    await expect(saveVenue.execute(
      create({venueId: "venue-x", address: "Calle 9"}),
    )).resolves.toEqual({venueId: "venue-x"});
  });

  it("rejects a name used by another active venue", async () => {
    await uow.venues.save(venue({id: "venue-y", name: "Sede Sur"}));
    const code = await rejection(saveVenue.execute(
      create({venueId: "venue-x", name: "sede sur"}),
    ));
    expect(code).toBe("failed_precondition");
  });

  it("rejects a venue that does not exist", async () => {
    const code = await rejection(
      saveVenue.execute(create({venueId: "nope"})),
    );
    expect(code).toBe("not_found");
  });

  it("does not see a venue of another tenant", async () => {
    await uow.venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
    const code = await rejection(
      saveVenue.execute(create({venueId: "venue-b"})),
    );
    expect(code).toBe("not_found");
  });

  it("rejects non-owners", async () => {
    await memberships.save(member("c1", "coordinator"));
    const code = await rejection(saveVenue.execute(
      create({venueId: "venue-x", actorUid: "c1"}),
    ));
    expect(code).toBe("permission_denied");
  });
});

describe("SetVenueStatus", () => {
  const close = (overrides = {}) => ({
    tenantId: "tenant-a",
    actorUid: "owner-1",
    venueId: "venue-x",
    status: "closed" as const,
    ...overrides,
  });

  beforeEach(async () => {
    await uow.venues.save(venue());
  });

  it("closes a venue without active groups and audits it", async () => {
    await uow.groups.save(group({status: "closed"}));
    await uow.groups.save(group({id: "g-b", venueId: "venue-y"}));
    const result = await setStatus.execute(close({reason: "Sin cancha"}));
    expect(result).toEqual({venueId: "venue-x", status: "closed"});
    const saved = (await uow.venues.get("tenant-a", "venue-x"))!;
    expect(saved.status).toBe("closed");
    expect(saved.updatedAt).toEqual(NOW);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      action: "venue.closed",
      before: {status: "active"},
      after: {status: "closed"},
      reason: "Sin cancha",
    });
  });

  it("rejects closing a venue with active groups, changing nothing",
    async () => {
      await uow.groups.save(group());
      const code = await rejection(setStatus.execute(close()));
      expect(code).toBe("failed_precondition");
      expect((await uow.venues.get("tenant-a", "venue-x"))!.status)
        .toBe("active");
      expect(auditLog.entries).toHaveLength(0);
    });

  it("reopens a closed venue and audits it", async () => {
    await uow.venues.save(venue({status: "closed"}));
    const result = await setStatus.execute(close({status: "active"}));
    expect(result).toEqual({venueId: "venue-x", status: "active"});
    expect(auditLog.entries[0]).toMatchObject({
      action: "venue.reopened",
      before: {status: "closed"},
      after: {status: "active"},
    });
  });

  it("rejects reopening when an active venue took the name", async () => {
    await uow.venues.save(venue({status: "closed"}));
    await uow.venues.save(venue({id: "venue-y"}));
    const code = await rejection(setStatus.execute(close({status: "active"})));
    expect(code).toBe("failed_precondition");
    expect((await uow.venues.get("tenant-a", "venue-x"))!.status)
      .toBe("closed");
  });

  it("rejects a status that is already set", async () => {
    const code = await rejection(setStatus.execute(close({status: "active"})));
    expect(code).toBe("failed_precondition");
  });

  it("rejects a venue that does not exist", async () => {
    const code = await rejection(setStatus.execute(close({venueId: "nope"})));
    expect(code).toBe("not_found");
  });

  it.each<Role>(["coordinator", "accountant", "teacher", "guardian",
    "adultPlayer"])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(setStatus.execute(close({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
  });
});
