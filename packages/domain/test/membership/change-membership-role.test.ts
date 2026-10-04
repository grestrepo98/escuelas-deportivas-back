import {beforeEach, describe, expect, it} from "vitest";
import {
  ChangeMembershipRole,
} from "../../src/membership/change-membership-role.js";
import {DomainError} from "../../src/errors.js";
import type {Membership} from "../../src/membership/membership.js";
import {ROLES, type Role} from "../../src/membership/role.js";
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
  scope: {venueIds: ["v1"], groupIds: ["g1"], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let useCase: ChangeMembershipRole;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  useCase = new ChangeMembershipRole(
    new InMemoryUnitOfWork(memberships, auditLog),
    clock,
  );
  await memberships.save(member("owner-1", "owner"));
  await memberships.save(member("coord-1", "coordinator"));
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
  it("changes the role, keeps scope and stamps updatedAt", async () => {
    const result = await useCase.execute(input());
    expect(result).toEqual({
      membershipId: "coord-1_tenant-a",
      role: "accountant",
    });
    const saved = (await memberships.get("coord-1", "tenant-a"))!;
    expect(saved.role).toBe("accountant");
    expect(saved.scope).toEqual({
      venueIds: ["v1"],
      groupIds: ["g1"],
      playerIds: [],
    });
    expect(saved.createdAt).toEqual(T0);
    expect(saved.updatedAt).toEqual(NOW);
  });

  it("writes exactly one audit entry with before and after", async () => {
    await useCase.execute(input({
      reason: "promoted",
      device: {userAgent: "vitest"},
    }));
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      at: NOW,
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.role_changed",
      target: {type: "membership", id: "coord-1_tenant-a"},
      before: {role: "coordinator"},
      after: {role: "accountant"},
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
    expect((await memberships.get("coord-1", "tenant-a"))!.role)
      .toBe("owner");
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
    const code = await rejection(
      useCase.execute(input({actorUid: "owner-2"})),
    );
    expect(code).toBe("permission_denied");
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(
      member("owner-b", "owner", {tenantId: "tenant-b"}),
    );
    const code = await rejection(
      useCase.execute(input({actorUid: "owner-b"})),
    );
    expect(code).toBe("permission_denied");
    expect((await memberships.get("coord-1", "tenant-a"))!.role)
      .toBe("coordinator");
  });

  it("rejects an actor with no membership at all", async () => {
    const code = await rejection(
      useCase.execute(input({actorUid: "ghost"})),
    );
    expect(code).toBe("permission_denied");
  });
});

describe("ChangeMembershipRole — target must exist in the tenant", () => {
  it("rejects a missing target with not_found", async () => {
    const code = await rejection(
      useCase.execute(input({targetUid: "ghost"})),
    );
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
    const code = await rejection(useCase.execute(input({
      targetUid: "owner-1",
      newRole: "coordinator",
    })));
    expect(code).toBe("failed_precondition");
    expect((await memberships.get("owner-1", "tenant-a"))!.role)
      .toBe("owner");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("does not count inactive owners as a safety net", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    const code = await rejection(useCase.execute(input({
      targetUid: "owner-1",
      newRole: "teacher",
    })));
    expect(code).toBe("failed_precondition");
  });

  it("allows demoting an owner when another active owner remains", async () => {
    await memberships.save(member("owner-2", "owner"));
    await useCase.execute(input({
      targetUid: "owner-1",
      newRole: "coordinator",
    }));
    expect((await memberships.get("owner-1", "tenant-a"))!.role)
      .toBe("coordinator");
    expect(await memberships.countActiveByRole("tenant-a", "owner")).toBe(1);
  });
});

describe("ChangeMembershipRole — atomicity", () => {
  it("leaves the role untouched when the audit write fails", async () => {
    auditLog.failWith = new Error("audit down");
    await expect(useCase.execute(input())).rejects.toThrow("audit down");
    expect((await memberships.get("coord-1", "tenant-a"))!.role)
      .toBe("coordinator");
    expect(auditLog.entries).toHaveLength(0);
  });
});
