import {beforeEach, describe, expect, it} from "vitest";
import {ChangeMembershipRole} from "../../../../src/membership/application/change-membership-role.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Group, Venue} from "../../../../src/structure/domain/structure.js";
import {ROLES, type Role} from "../../../../src/membership/domain/role.js";
import {FakeClock} from "../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../../../src/shared/application/testing/in-memory-unit-of-work.js";

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
  scope: {venueIds: ["v1"], groupIds: ["g1"], playerIds: []},
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
let useCase: ChangeMembershipRole;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  useCase = new ChangeMembershipRole(uow, clock);
  await memberships.save(member("owner-1", "owner"));
  await memberships.save(member("coord-1", "coordinator"));
  await uow.venues.save(venue());
  await uow.venues.save(venue({id: "venue-2", name: "Sede Sur"}));
  await uow.venues.save(venue({id: "venue-closed", status: "closed"}));
  await uow.venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
  await uow.groups.save(group());
  await uow.groups.save(group({id: "group-closed", status: "closed"}));
});

const input = (overrides = {}) => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  targetUid: "coord-1",
  newRole: "accountant" as Role,
  ...overrides,
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

describe("ChangeMembershipRole — success", () => {
  it("changes the role, empties the scope and stamps updatedAt", async () => {
    const result = await useCase.execute(input());
    expect(result).toEqual({
      membershipId: "coord-1_tenant-a",
      role: "accountant",
    });
    const saved = (await memberships.get("coord-1", "tenant-a"))!;
    expect(saved.role).toBe("accountant");
    expect(saved.scope).toEqual({venueIds: [], groupIds: [], playerIds: []});
    expect(saved.createdAt).toEqual(T0);
    expect(saved.updatedAt).toEqual(NOW);
  });

  it("writes exactly one audit entry with before and after", async () => {
    await useCase.execute(
      input({
        reason: "promoted",
        device: {userAgent: "vitest"},
      }),
    );
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      at: NOW,
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.role_changed",
      target: {type: "membership", id: "coord-1_tenant-a"},
      before: {
        role: "coordinator",
        scope: {venueIds: ["v1"], groupIds: ["g1"], playerIds: []},
      },
      after: {
        role: "accountant",
        scope: {venueIds: [], groupIds: [], playerIds: []},
      },
      reason: "promoted",
      device: {userAgent: "vitest"},
    });
  });

  it("omits the reason and defaults the device when not given", async () => {
    await useCase.execute(input());
    expect(auditLog.entries[0].reason).toBeUndefined();
    expect(auditLog.entries[0].device).toEqual({});
  });

  it("can promote someone to owner", async () => {
    await useCase.execute(input({newRole: "owner"}));
    expect((await memberships.get("coord-1", "tenant-a"))!.role).toBe("owner");
  });
});

describe("ChangeMembershipRole — only an active owner of the tenant", () => {
  it.each(ROLES.filter((r) => r !== "owner"))(
    "rejects a %s actor with permission_denied",
    async (role) => {
      await memberships.save(member("actor-x", role));
      const code = await rejection(
        useCase.execute(input({actorUid: "actor-x"})),
      );
      expect(code).toBe("permission_denied");
      expect(auditLog.entries).toHaveLength(0);
    },
  );

  it("rejects an inactive owner", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    const code = await rejection(useCase.execute(input({actorUid: "owner-2"})));
    expect(code).toBe("permission_denied");
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const code = await rejection(useCase.execute(input({actorUid: "owner-b"})));
    expect(code).toBe("permission_denied");
    expect((await memberships.get("coord-1", "tenant-a"))!.role).toBe(
      "coordinator",
    );
  });

  it("rejects an actor with no membership at all", async () => {
    const code = await rejection(useCase.execute(input({actorUid: "ghost"})));
    expect(code).toBe("permission_denied");
  });
});

describe("ChangeMembershipRole — target must exist in the tenant", () => {
  it("rejects a missing target with not_found", async () => {
    const code = await rejection(useCase.execute(input({targetUid: "ghost"})));
    expect(code).toBe("not_found");
  });

  it("does not see a target that only exists in another tenant", async () => {
    await memberships.save(
      member("other-1", "coordinator", {tenantId: "tenant-b"}),
    );
    const code = await rejection(
      useCase.execute(input({targetUid: "other-1"})),
    );
    expect(code).toBe("not_found");
  });
});

describe("ChangeMembershipRole — new role must differ", () => {
  it("rejects an unchanged role with failed_precondition", async () => {
    const code = await rejection(
      useCase.execute(input({newRole: "coordinator"})),
    );
    expect(code).toBe("failed_precondition");
    expect(auditLog.entries).toHaveLength(0);
  });
});

describe("ChangeMembershipRole — the tenant keeps an active owner", () => {
  it("rejects the sole owner demoting themselves", async () => {
    const code = await rejection(
      useCase.execute(
        input({
          targetUid: "owner-1",
          newRole: "coordinator",
        }),
      ),
    );
    expect(code).toBe("failed_precondition");
    expect((await memberships.get("owner-1", "tenant-a"))!.role).toBe("owner");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("does not count inactive owners as a safety net", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    const code = await rejection(
      useCase.execute(
        input({
          targetUid: "owner-1",
          newRole: "teacher",
        }),
      ),
    );
    expect(code).toBe("failed_precondition");
  });

  it("allows demoting an owner when another active owner remains", async () => {
    await memberships.save(member("owner-2", "owner"));
    await useCase.execute(
      input({
        targetUid: "owner-1",
        newRole: "coordinator",
        scope: {venueIds: ["venue-1"]},
      }),
    );
    expect((await memberships.get("owner-1", "tenant-a"))!.role).toBe(
      "coordinator",
    );
    expect(await memberships.countActiveByRole("tenant-a", "owner")).toBe(1);
  });
});

describe("ChangeMembershipRole — atomicity", () => {
  it("leaves the role untouched when the audit write fails", async () => {
    auditLog.failWith = new Error("audit down");
    await expect(useCase.execute(input())).rejects.toThrow("audit down");
    expect((await memberships.get("coord-1", "tenant-a"))!.role).toBe(
      "coordinator",
    );
    expect(auditLog.entries).toHaveLength(0);
  });
});

describe("ChangeMembershipRole — the scope travels with the role", () => {
  const emptyScope = {venueIds: [], groupIds: [], playerIds: []};
  const scopeOf = async (uid: string) =>
    (await memberships.get(uid, "tenant-a"))!.scope;

  it("makes a coordinator a teacher with the given groups", async () => {
    await useCase.execute(
      input({newRole: "teacher", scope: {groupIds: ["group-1"]}}),
    );
    expect((await memberships.get("coord-1", "tenant-a"))!.role).toBe(
      "teacher",
    );
    expect(await scopeOf("coord-1")).toEqual({
      venueIds: [],
      groupIds: ["group-1"],
      playerIds: [],
    });
  });

  it("makes a teacher a coordinator with the given venues", async () => {
    await memberships.save(member("teach-1", "teacher"));
    await useCase.execute(
      input({
        targetUid: "teach-1",
        newRole: "coordinator",
        scope: {venueIds: ["venue-1", "venue-2"]},
      }),
    );
    expect(await scopeOf("teach-1")).toEqual({
      venueIds: ["venue-1", "venue-2"],
      groupIds: [],
      playerIds: [],
    });
  });

  it("makes an accountant a coordinator", async () => {
    await memberships.save(member("acc-1", "accountant", {scope: emptyScope}));
    await useCase.execute(
      input({
        targetUid: "acc-1",
        newRole: "coordinator",
        scope: {venueIds: ["venue-1"]},
      }),
    );
    expect((await scopeOf("acc-1")).venueIds).toEqual(["venue-1"]);
  });

  it.each(["coordinator", "teacher"] as const)(
    "requires a scope to make someone a %s",
    async (newRole) => {
      await memberships.save(
        member("acc-1", "accountant", {scope: emptyScope}),
      );
      for (const scope of [undefined, {}, {venueIds: [], groupIds: []}]) {
        expect(
          await rejection(
            useCase.execute(input({targetUid: "acc-1", newRole, scope})),
          ),
        ).toBe("invalid_argument");
      }
      expect((await memberships.get("acc-1", "tenant-a"))!.role).toBe(
        "accountant",
      );
      expect(auditLog.entries).toHaveLength(0);
    },
  );

  it.each(["owner", "accountant"] as const)(
    "empties the scope when making someone %s",
    async (newRole) => {
      await useCase.execute(input({newRole}));
      expect(await scopeOf("coord-1")).toEqual(emptyScope);
    },
  );

  it.each(["owner", "accountant"] as const)(
    "accepts an explicitly empty scope for %s",
    async (newRole) => {
      await useCase.execute(
        input({newRole, scope: {venueIds: [], groupIds: []}}),
      );
      expect(await scopeOf("coord-1")).toEqual(emptyScope);
    },
  );

  it.each(["owner", "accountant"] as const)(
    "rejects a non-empty scope for %s",
    async (newRole) => {
      expect(
        await rejection(
          useCase.execute(input({newRole, scope: {venueIds: ["venue-1"]}})),
        ),
      ).toBe("invalid_argument");
      expect((await memberships.get("coord-1", "tenant-a"))!.role).toBe(
        "coordinator",
      );
      expect(auditLog.entries).toHaveLength(0);
    },
  );

  it("rejects a scope that does not fit the new role", async () => {
    expect(
      await rejection(
        useCase.execute(
          input({newRole: "teacher", scope: {venueIds: ["venue-1"]}}),
        ),
      ),
    ).toBe("invalid_argument");
  });

  it.each([
    [
      "a venue of another organization",
      {venueIds: ["venue-b"]},
      "invalid_argument",
    ],
    [
      "a venue that does not exist",
      {venueIds: ["venue-9"]},
      "invalid_argument",
    ],
    ["a closed venue", {venueIds: ["venue-closed"]}, "failed_precondition"],
  ])("rejects %s and changes nothing", async (_name, scope, code) => {
    await memberships.save(member("acc-1", "accountant", {scope: emptyScope}));
    expect(
      await rejection(
        useCase.execute(
          input({targetUid: "acc-1", newRole: "coordinator", scope}),
        ),
      ),
    ).toBe(code);
    expect((await memberships.get("acc-1", "tenant-a"))!.role).toBe(
      "accountant",
    );
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects a closed group for a teacher", async () => {
    expect(
      await rejection(
        useCase.execute(
          input({newRole: "teacher", scope: {groupIds: ["group-closed"]}}),
        ),
      ),
    ).toBe("failed_precondition");
  });

  it("keeps the players of someone who becomes a guardian", async () => {
    await memberships.save(
      member("adult-1", "adultPlayer", {
        scope: {venueIds: [], groupIds: [], playerIds: ["p1"]},
      }),
    );
    await useCase.execute(input({targetUid: "adult-1", newRole: "guardian"}));
    expect(await scopeOf("adult-1")).toEqual({
      venueIds: [],
      groupIds: [],
      playerIds: ["p1"],
    });
  });

  it("does not take venues or groups for a guardian", async () => {
    expect(
      await rejection(
        useCase.execute(
          input({newRole: "guardian", scope: {venueIds: ["venue-1"]}}),
        ),
      ),
    ).toBe("invalid_argument");
  });

  it("records the scope before and after in the audit entry", async () => {
    await useCase.execute(
      input({newRole: "teacher", scope: {groupIds: ["group-1"]}}),
    );
    expect(auditLog.entries[0]).toMatchObject({
      action: "membership.role_changed",
      before: {
        role: "coordinator",
        scope: {venueIds: ["v1"], groupIds: ["g1"], playerIds: []},
      },
      after: {
        role: "teacher",
        scope: {venueIds: [], groupIds: ["group-1"], playerIds: []},
      },
    });
  });
});
