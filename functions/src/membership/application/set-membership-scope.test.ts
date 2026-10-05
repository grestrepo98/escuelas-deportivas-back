import {beforeEach, describe, expect, it} from "vitest";
import {SetMembershipScope} from "./set-membership-scope.js";
import {DomainError} from "../../shared/domain/errors.js";
import type {Membership} from "../domain/membership.js";
import type {Role} from "../domain/role.js";
import type {Group, Venue} from "../../structure/domain/structure.js";
import {FakeClock} from "../../shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "./testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../shared/application/testing/in-memory-unit-of-work.js";

const T0 = new Date("2026-10-01T00:00:00Z");
const NOW = new Date("2026-10-04T12:00:00Z");

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

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-1",
  tenantId: "tenant-a",
  venueId: "venue-1",
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
let setScope: SetMembershipScope;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  setScope = new SetMembershipScope(uow, clock);
  await memberships.save(member("owner-1", "owner"));
  await memberships.save(
    member("coord-1", "coordinator", {
      scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
    }),
  );
  await memberships.save(
    member("teacher-1", "teacher", {
      scope: {venueIds: [], groupIds: ["group-1"], playerIds: []},
    }),
  );
  await uow.venues.save(venue());
  await uow.venues.save(venue({id: "venue-2", name: "Sede Sur"}));
  await uow.venues.save(venue({id: "venue-closed", status: "closed"}));
  await uow.venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
  await uow.groups.save(group());
  await uow.groups.save(group({id: "group-2"}));
  await uow.groups.save(group({id: "group-closed", status: "closed"}));
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

const input = (overrides = {}) => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  targetUid: "coord-1",
  scope: {venueIds: ["venue-2"]},
  ...overrides,
});

const scopeOf = async (uid: string) =>
  (await memberships.get(uid, "tenant-a"))!.scope;

describe("SetMembershipScope — success", () => {
  it("replaces the venues of a coordinator and stamps updatedAt", async () => {
    const result = await setScope.execute(
      input({scope: {venueIds: ["venue-1", "venue-2"]}}),
    );

    expect(result).toEqual({
      membershipId: "coord-1_tenant-a",
      scope: {venueIds: ["venue-1", "venue-2"], groupIds: [], playerIds: []},
    });
    const saved = (await memberships.get("coord-1", "tenant-a"))!;
    expect(saved.scope).toEqual(result.scope);
    expect(saved.createdAt).toEqual(T0);
    expect(saved.updatedAt).toEqual(NOW);
  });

  it("replaces the groups of a teacher", async () => {
    await setScope.execute(
      input({targetUid: "teacher-1", scope: {groupIds: ["group-2"]}}),
    );
    expect(await scopeOf("teacher-1")).toEqual({
      venueIds: [],
      groupIds: ["group-2"],
      playerIds: [],
    });
  });

  it("drops duplicated ids", async () => {
    await setScope.execute(
      input({scope: {venueIds: ["venue-2", "venue-2", "venue-1"]}}),
    );
    expect((await scopeOf("coord-1")).venueIds).toEqual(["venue-2", "venue-1"]);
  });

  it("writes one scope_changed entry with the scope before and after", async () => {
    await setScope.execute(input({device: {userAgent: "vitest"}}));

    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      at: NOW,
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.scope_changed",
      target: {type: "membership", id: "coord-1_tenant-a"},
      before: {scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []}},
      after: {scope: {venueIds: ["venue-2"], groupIds: [], playerIds: []}},
      device: {userAgent: "vitest"},
    });
  });

  it("changes the scope of an inactive membership too", async () => {
    await memberships.save(
      member("coord-2", "coordinator", {
        status: "inactive",
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      }),
    );
    await setScope.execute(input({targetUid: "coord-2"}));
    expect((await scopeOf("coord-2")).venueIds).toEqual(["venue-2"]);
  });
});

describe("SetMembershipScope — the scope must fit the role and structure", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["no venues for a coordinator", {scope: {}}, "invalid_argument"],
    [
      "empty venues for a coordinator",
      {scope: {venueIds: []}},
      "invalid_argument",
    ],
    [
      "groups for a coordinator",
      {scope: {venueIds: ["venue-1"], groupIds: ["group-1"]}},
      "invalid_argument",
    ],
    [
      "venues for a teacher",
      {targetUid: "teacher-1", scope: {venueIds: ["venue-1"]}},
      "invalid_argument",
    ],
    [
      "no groups for a teacher",
      {targetUid: "teacher-1", scope: {}},
      "invalid_argument",
    ],
    [
      "a venue of another organization",
      {scope: {venueIds: ["venue-b"]}},
      "invalid_argument",
    ],
    [
      "a venue that does not exist",
      {scope: {venueIds: ["venue-9"]}},
      "invalid_argument",
    ],
    [
      "a closed venue",
      {scope: {venueIds: ["venue-closed"]}},
      "failed_precondition",
    ],
    [
      "a closed group",
      {targetUid: "teacher-1", scope: {groupIds: ["group-closed"]}},
      "failed_precondition",
    ],
  ];

  it.each(cases)(
    "rejects %s and changes nothing",
    async (_name, overrides, code) => {
      expect(await rejection(setScope.execute(input(overrides)))).toBe(code);
      expect(await scopeOf("coord-1")).toEqual({
        venueIds: ["venue-1"],
        groupIds: [],
        playerIds: [],
      });
      expect(await scopeOf("teacher-1")).toEqual({
        venueIds: [],
        groupIds: ["group-1"],
        playerIds: [],
      });
      expect(auditLog.entries).toHaveLength(0);
    },
  );
});

describe("SetMembershipScope — roles without a venue or group scope", () => {
  it.each(["owner", "accountant"] as const)(
    "keeps a %s empty and rejects a non-empty scope",
    async (role) => {
      await memberships.save(member("target-x", role));
      expect(
        await rejection(
          setScope.execute(
            input({targetUid: "target-x", scope: {venueIds: ["venue-1"]}}),
          ),
        ),
      ).toBe("invalid_argument");
    },
  );

  it.each(["guardian", "adultPlayer"] as const)(
    "does not manage the scope of a %s (it is made of players)",
    async (role) => {
      await memberships.save(
        member("target-x", role, {
          scope: {venueIds: [], groupIds: [], playerIds: ["p1"]},
        }),
      );
      expect(
        await rejection(
          setScope.execute(input({targetUid: "target-x", scope: {}})),
        ),
      ).toBe("invalid_argument");
      expect((await scopeOf("target-x")).playerIds).toEqual(["p1"]);
    },
  );
});

describe("SetMembershipScope — only an active owner of the tenant", () => {
  it.each(["accountant", "coordinator", "teacher", "guardian"] as const)(
    "rejects a %s actor with permission_denied",
    async (role) => {
      await memberships.save(member("actor-x", role));
      expect(
        await rejection(setScope.execute(input({actorUid: "actor-x"}))),
      ).toBe("permission_denied");
      expect(auditLog.entries).toHaveLength(0);
    },
  );

  it("rejects an inactive owner", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    expect(
      await rejection(setScope.execute(input({actorUid: "owner-2"}))),
    ).toBe("permission_denied");
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    expect(
      await rejection(setScope.execute(input({actorUid: "owner-b"}))),
    ).toBe("permission_denied");
  });
});

describe("SetMembershipScope — the target", () => {
  it("rejects a missing target with not_found", async () => {
    expect(await rejection(setScope.execute(input({targetUid: "ghost"})))).toBe(
      "not_found",
    );
  });

  it("does not see a target that only exists in another tenant", async () => {
    await memberships.save(
      member("other-1", "coordinator", {tenantId: "tenant-b"}),
    );
    expect(
      await rejection(setScope.execute(input({targetUid: "other-1"}))),
    ).toBe("not_found");
  });
});

describe("SetMembershipScope — atomicity", () => {
  it("leaves the scope untouched when the audit write fails", async () => {
    auditLog.failWith = new Error("audit down");
    await expect(setScope.execute(input())).rejects.toThrow("audit down");
    expect((await scopeOf("coord-1")).venueIds).toEqual(["venue-1"]);
  });
});
