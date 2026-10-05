import {beforeEach, describe, expect, it} from "vitest";
import {SaveGroup} from "./save-group.js";
import {SetGroupStatus} from "./set-group-status.js";
import {DomainError} from "../../shared/domain/errors.js";
import type {Membership} from "../../membership/domain/membership.js";
import type {Role} from "../../membership/domain/role.js";
import type {
  Category,
  Group,
  ScheduleSlot,
  Venue,
} from "../domain/structure.js";
import {FakeClock} from "../../shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../shared/application/testing/in-memory-unit-of-work.js";

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
  id: "venue-1",
  tenantId: "tenant-a",
  name: "Sede Norte",
  address: "Calle 1",
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: "cat-1",
  tenantId: "tenant-a",
  name: "Sub-10",
  birthYears: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-x",
  tenantId: "tenant-a",
  venueId: "venue-1",
  categoryId: "cat-1",
  name: "Grupo A",
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const slot: ScheduleSlot = {weekday: 2, start: "17:00", end: "18:30"};

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let uow: InMemoryUnitOfWork;
let saveGroup: SaveGroup;
let setStatus: SetGroupStatus;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  saveGroup = new SaveGroup(uow, clock);
  setStatus = new SetGroupStatus(uow, clock);
  await memberships.save(member("owner-1", "owner"));
  await uow.venues.save(venue());
  await uow.categories.save(category());
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
  venueId: "venue-1",
  categoryId: "cat-1",
  name: "Grupo A",
  schedule: [slot],
  ...overrides,
});

describe("SaveGroup — create", () => {
  it("creates an active group and one audit entry", async () => {
    const {groupId} = await saveGroup.execute(create());
    const saved = (await uow.groups.get("tenant-a", groupId))!;
    expect(saved).toMatchObject({
      venueId: "venue-1",
      categoryId: "cat-1",
      name: "Grupo A",
      schedule: [slot],
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      actorRole: "owner",
      action: "group.created",
      target: {type: "group", id: groupId},
      before: {},
      after: {venueId: "venue-1", name: "Grupo A", status: "active"},
    });
  });

  it("accepts an empty schedule", async () => {
    await expect(
      saveGroup.execute(create({schedule: []})),
    ).resolves.toBeDefined();
  });

  it.each<Role>([
    "coordinator",
    "accountant",
    "teacher",
    "guardian",
    "adultPlayer",
  ])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(saveGroup.execute(create({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const code = await rejection(
      saveGroup.execute(create({actorUid: "owner-b"})),
    );
    expect(code).toBe("permission_denied");
  });

  it("requires a venueId when creating", async () => {
    const code = await rejection(
      saveGroup.execute(create({venueId: undefined})),
    );
    expect(code).toBe("invalid_argument");
  });

  it("rejects a blank name", async () => {
    expect(await rejection(saveGroup.execute(create({name: " "})))).toBe(
      "invalid_argument",
    );
  });

  it("rejects an invalid schedule", async () => {
    const bad = {weekday: 2, start: "18:00", end: "17:00"};
    expect(await rejection(saveGroup.execute(create({schedule: [bad]})))).toBe(
      "invalid_argument",
    );
  });

  it("rejects a venue or category that does not exist", async () => {
    expect(await rejection(saveGroup.execute(create({venueId: "nope"})))).toBe(
      "not_found",
    );
    expect(
      await rejection(saveGroup.execute(create({categoryId: "nope"}))),
    ).toBe("not_found");
  });

  it("rejects a venue or category of another tenant", async () => {
    await uow.venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
    await uow.categories.save(category({id: "cat-b", tenantId: "tenant-b"}));
    expect(
      await rejection(saveGroup.execute(create({venueId: "venue-b"}))),
    ).toBe("not_found");
    expect(
      await rejection(saveGroup.execute(create({categoryId: "cat-b"}))),
    ).toBe("not_found");
  });

  it("rejects a closed venue or category", async () => {
    await uow.venues.save(venue({id: "venue-c", status: "closed"}));
    await uow.categories.save(category({id: "cat-c", status: "closed"}));
    expect(
      await rejection(saveGroup.execute(create({venueId: "venue-c"}))),
    ).toBe("failed_precondition");
    expect(
      await rejection(saveGroup.execute(create({categoryId: "cat-c"}))),
    ).toBe("failed_precondition");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects a name used by an active group of the same venue", async () => {
    await uow.groups.save(group());
    const code = await rejection(
      saveGroup.execute(create({name: " grupo a "})),
    );
    expect(code).toBe("failed_precondition");
  });

  it("allows the same name in another venue or after closing", async () => {
    await uow.venues.save(venue({id: "venue-2", name: "Sede Sur"}));
    await uow.groups.save(group({venueId: "venue-2"}));
    await expect(saveGroup.execute(create())).resolves.toBeDefined();

    await uow.groups.save(
      group({
        id: "g-closed",
        venueId: "venue-1",
        name: "Grupo B",
        status: "closed",
      }),
    );
    await expect(
      saveGroup.execute(create({name: "Grupo B"})),
    ).resolves.toBeDefined();
  });
});

describe("SaveGroup — update", () => {
  beforeEach(async () => {
    await uow.groups.save(group());
  });

  const update = (overrides = {}) => create({groupId: "group-x", ...overrides});

  it("updates fields, keeps venue and createdAt, records before/after", async () => {
    const result = await saveGroup.execute(
      update({
        name: "Grupo B",
        schedule: [{weekday: 4, start: "16:00", end: "17:00"}],
      }),
    );
    expect(result).toEqual({groupId: "group-x"});
    const saved = (await uow.groups.get("tenant-a", "group-x"))!;
    expect(saved).toMatchObject({
      venueId: "venue-1",
      name: "Grupo B",
      schedule: [{weekday: 4, start: "16:00", end: "17:00"}],
      createdAt: T0,
      updatedAt: NOW,
    });
    expect(auditLog.entries[0]).toMatchObject({
      action: "group.updated",
      before: {name: "Grupo A", schedule: []},
      after: {name: "Grupo B"},
    });
  });

  it("does not require venueId on update", async () => {
    await expect(
      saveGroup.execute(update({venueId: undefined})),
    ).resolves.toEqual({groupId: "group-x"});
  });

  it("rejects a different venueId and moves nothing", async () => {
    await uow.venues.save(venue({id: "venue-2", name: "Sede Sur"}));
    const code = await rejection(
      saveGroup.execute(update({venueId: "venue-2"})),
    );
    expect(code).toBe("failed_precondition");
    expect((await uow.groups.get("tenant-a", "group-x"))!.venueId).toBe(
      "venue-1",
    );
    expect(auditLog.entries).toHaveLength(0);
  });

  it("allows changing to another active category", async () => {
    await uow.categories.save(category({id: "cat-2", name: "Sub-12"}));
    await saveGroup.execute(update({categoryId: "cat-2"}));
    expect((await uow.groups.get("tenant-a", "group-x"))!.categoryId).toBe(
      "cat-2",
    );
  });

  it("rejects changing to a closed or missing category", async () => {
    await uow.categories.save(category({id: "cat-c", status: "closed"}));
    expect(
      await rejection(saveGroup.execute(update({categoryId: "cat-c"}))),
    ).toBe("failed_precondition");
    expect(
      await rejection(saveGroup.execute(update({categoryId: "nope"}))),
    ).toBe("not_found");
  });

  it("allows keeping its own name", async () => {
    await expect(saveGroup.execute(update({schedule: []}))).resolves.toEqual({
      groupId: "group-x",
    });
  });

  it("rejects a name used by another active group of the venue", async () => {
    await uow.groups.save(group({id: "group-y", name: "Grupo B"}));
    const code = await rejection(saveGroup.execute(update({name: "grupo b"})));
    expect(code).toBe("failed_precondition");
  });

  it("rejects a group that does not exist or is of another tenant", async () => {
    await uow.groups.save(group({id: "g-b", tenantId: "tenant-b"}));
    expect(await rejection(saveGroup.execute(update({groupId: "nope"})))).toBe(
      "not_found",
    );
    expect(await rejection(saveGroup.execute(update({groupId: "g-b"})))).toBe(
      "not_found",
    );
  });

  it("rejects non-owners", async () => {
    await memberships.save(member("c1", "coordinator"));
    const code = await rejection(saveGroup.execute(update({actorUid: "c1"})));
    expect(code).toBe("permission_denied");
  });
});

describe("SetGroupStatus", () => {
  const close = (overrides = {}) => ({
    tenantId: "tenant-a",
    actorUid: "owner-1",
    groupId: "group-x",
    status: "closed" as const,
    ...overrides,
  });

  beforeEach(async () => {
    await uow.groups.save(group());
  });

  it("closes a group and audits it with the reason", async () => {
    const result = await setStatus.execute(close({reason: "Sin cupo"}));
    expect(result).toEqual({groupId: "group-x", status: "closed"});
    const saved = (await uow.groups.get("tenant-a", "group-x"))!;
    expect(saved.status).toBe("closed");
    expect(saved.updatedAt).toEqual(NOW);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      action: "group.closed",
      before: {status: "active"},
      after: {status: "closed"},
      reason: "Sin cupo",
    });
  });

  it("closes even when its venue is already closed", async () => {
    await uow.venues.save(venue({status: "closed"}));
    await expect(setStatus.execute(close())).resolves.toBeDefined();
  });

  describe("reopening", () => {
    beforeEach(async () => {
      await uow.groups.save(group({status: "closed"}));
    });
    const reopen = () => close({status: "active"});

    it("reopens and audits it", async () => {
      const result = await setStatus.execute(reopen());
      expect(result).toEqual({groupId: "group-x", status: "active"});
      expect(auditLog.entries[0]).toMatchObject({
        action: "group.reopened",
        before: {status: "closed"},
        after: {status: "active"},
      });
    });

    it("rejects reopening under a closed venue", async () => {
      await uow.venues.save(venue({status: "closed"}));
      expect(await rejection(setStatus.execute(reopen()))).toBe(
        "failed_precondition",
      );
      expect((await uow.groups.get("tenant-a", "group-x"))!.status).toBe(
        "closed",
      );
      expect(auditLog.entries).toHaveLength(0);
    });

    it("rejects reopening under a closed category", async () => {
      await uow.categories.save(category({status: "closed"}));
      expect(await rejection(setStatus.execute(reopen()))).toBe(
        "failed_precondition",
      );
    });

    it("rejects reopening when an active group took the name", async () => {
      await uow.groups.save(group({id: "group-y"}));
      expect(await rejection(setStatus.execute(reopen()))).toBe(
        "failed_precondition",
      );
    });

    it("allows reopening when the same name is in another venue", async () => {
      await uow.groups.save(group({id: "group-y", venueId: "venue-2"}));
      await expect(setStatus.execute(reopen())).resolves.toBeDefined();
    });
  });

  it("rejects a status that is already set", async () => {
    expect(await rejection(setStatus.execute(close({status: "active"})))).toBe(
      "failed_precondition",
    );
  });

  it("rejects a group that does not exist", async () => {
    expect(await rejection(setStatus.execute(close({groupId: "nope"})))).toBe(
      "not_found",
    );
  });

  it.each<Role>([
    "coordinator",
    "accountant",
    "teacher",
    "guardian",
    "adultPlayer",
  ])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(setStatus.execute(close({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
  });
});
