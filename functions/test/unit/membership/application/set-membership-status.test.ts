import {beforeEach, describe, expect, it} from "vitest";
import {SetMembershipStatus} from "../../../../src/membership/application/set-membership-status.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import type {
  Membership,
  MembershipStatus,
} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import type {Group, Venue} from "../../../../src/structure/domain/structure.js";
import type {MembershipDeactivationGuard} from "../../../../src/membership/application/membership-deactivation-guard.js";
import {FakeClock} from "../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {AllowAllDeactivationGuard} from "../../../../src/membership/application/testing/allow-all-deactivation-guard.js";
import {InMemoryMembershipRepository} from "../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {RejectingDeactivationGuard} from "../../../../src/membership/application/testing/rejecting-deactivation-guard.js";
import {InMemoryUnitOfWork} from "../../../../src/shared/application/testing/in-memory-unit-of-work.js";

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
let clock: FakeClock;

const build = (
  guard: MembershipDeactivationGuard = new AllowAllDeactivationGuard(),
) => new SetMembershipStatus(uow, guard, clock);

beforeEach(async () => {
  clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  await memberships.save(member("owner-1", "owner"));
  await memberships.save(
    member("coord-1", "coordinator", {
      scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
    }),
  );
  await uow.venues.save(venue());
  await uow.venues.save(venue({id: "venue-closed", status: "closed"}));
  await uow.groups.save(group());
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
  status: "inactive" as MembershipStatus,
  ...overrides,
});

const statusOf = async (uid: string) =>
  (await memberships.get(uid, "tenant-a"))!.status;

describe("SetMembershipStatus — deactivating", () => {
  it("deactivates, keeps the rest and stamps updatedAt", async () => {
    const result = await build().execute(input());

    expect(result).toEqual({
      membershipId: "coord-1_tenant-a",
      status: "inactive",
    });
    const saved = (await memberships.get("coord-1", "tenant-a"))!;
    expect(saved).toEqual(
      member("coord-1", "coordinator", {
        status: "inactive",
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
        updatedAt: NOW,
      }),
    );
  });

  it("writes one status_changed entry with the reason and device", async () => {
    await build().execute(
      input({reason: "left the club", device: {userAgent: "vitest"}}),
    );

    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toEqual({
      at: NOW,
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.status_changed",
      target: {type: "membership", id: "coord-1_tenant-a"},
      before: {status: "active"},
      after: {status: "inactive"},
      reason: "left the club",
      device: {userAgent: "vitest"},
    });
  });

  it("omits the reason and defaults the device when not given", async () => {
    await build().execute(input());
    expect(auditLog.entries[0].reason).toBeUndefined();
    expect("reason" in auditLog.entries[0]).toBe(false);
    expect(auditLog.entries[0].device).toEqual({});
  });

  it("asks the guard with the membership being deactivated", async () => {
    const asked: Membership[] = [];
    await build({
      assertCanDeactivate: async (m) => {
        asked.push(m);
      },
    }).execute(input());

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({uid: "coord-1", role: "coordinator"});
  });

  it("changes nothing when the guard rejects (C21)", async () => {
    const guard = new RejectingDeactivationGuard("Open cash register");

    expect(await rejection(build(guard).execute(input()))).toBe(
      "failed_precondition",
    );
    expect(await statusOf("coord-1")).toBe("active");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("allows it with the default guard", async () => {
    await build(new AllowAllDeactivationGuard()).execute(input());
    expect(await statusOf("coord-1")).toBe("inactive");
  });
});

describe("SetMembershipStatus — the last active owner", () => {
  it("rejects deactivating the sole active owner", async () => {
    expect(
      await rejection(build().execute(input({targetUid: "owner-1"}))),
    ).toBe("failed_precondition");
    expect(await statusOf("owner-1")).toBe("active");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("does not count an inactive owner as a safety net", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    expect(
      await rejection(build().execute(input({targetUid: "owner-1"}))),
    ).toBe("failed_precondition");
  });

  it("allows deactivating an owner when another active one remains", async () => {
    await memberships.save(member("owner-2", "owner"));
    await build().execute(input({targetUid: "owner-1"}));
    expect(await statusOf("owner-1")).toBe("inactive");
    expect(await memberships.countActiveByRole("tenant-a", "owner")).toBe(1);
  });

  it("does not block deactivating a non-owner when the owner is alone", async () => {
    await build().execute(input());
    expect(await statusOf("coord-1")).toBe("inactive");
  });
});

describe("SetMembershipStatus — reactivating", () => {
  beforeEach(async () => {
    await memberships.save(
      member("coord-1", "coordinator", {
        status: "inactive",
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      }),
    );
  });

  it("reactivates when the stored scope is still valid", async () => {
    const result = await build().execute(input({status: "active"}));

    expect(result).toEqual({
      membershipId: "coord-1_tenant-a",
      status: "active",
    });
    expect(await statusOf("coord-1")).toBe("active");
    expect(auditLog.entries[0]).toMatchObject({
      action: "membership.status_changed",
      before: {status: "inactive"},
      after: {status: "active"},
    });
  });

  it("does not consult the deactivation guard", async () => {
    await build(new RejectingDeactivationGuard()).execute(
      input({status: "active"}),
    );
    expect(await statusOf("coord-1")).toBe("active");
  });

  it("rejects when a stored venue is now closed", async () => {
    await memberships.save(
      member("coord-1", "coordinator", {
        status: "inactive",
        scope: {venueIds: ["venue-closed"], groupIds: [], playerIds: []},
      }),
    );
    expect(await rejection(build().execute(input({status: "active"})))).toBe(
      "failed_precondition",
    );
    expect(await statusOf("coord-1")).toBe("inactive");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects when a stored group is now closed", async () => {
    await memberships.save(
      member("teacher-1", "teacher", {
        status: "inactive",
        scope: {venueIds: [], groupIds: ["group-closed"], playerIds: []},
      }),
    );
    expect(
      await rejection(
        build().execute(input({targetUid: "teacher-1", status: "active"})),
      ),
    ).toBe("failed_precondition");
    expect(await statusOf("teacher-1")).toBe("inactive");
  });

  it("reactivates an owner, whose scope is empty", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    await build().execute(input({targetUid: "owner-2", status: "active"}));
    expect(await statusOf("owner-2")).toBe("active");
  });
});

describe("SetMembershipStatus — no change", () => {
  it.each([
    ["active", "active"],
    ["inactive", "inactive"],
  ] as const)(
    "rejects setting %s on an already %s membership",
    async (status, current) => {
      await memberships.save(
        member("coord-1", "coordinator", {
          status: current,
          scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
        }),
      );
      expect(await rejection(build().execute(input({status})))).toBe(
        "failed_precondition",
      );
      expect(auditLog.entries).toHaveLength(0);
    },
  );
});

describe("SetMembershipStatus — only an active owner of the tenant", () => {
  it.each(["accountant", "coordinator", "teacher", "guardian"] as const)(
    "rejects a %s actor with permission_denied",
    async (role) => {
      await memberships.save(member("actor-x", role));
      expect(
        await rejection(build().execute(input({actorUid: "actor-x"}))),
      ).toBe("permission_denied");
      expect(await statusOf("coord-1")).toBe("active");
    },
  );

  it("rejects an inactive owner", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    expect(await rejection(build().execute(input({actorUid: "owner-2"})))).toBe(
      "permission_denied",
    );
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    expect(await rejection(build().execute(input({actorUid: "owner-b"})))).toBe(
      "permission_denied",
    );
    expect(await statusOf("coord-1")).toBe("active");
  });
});

describe("SetMembershipStatus — the target", () => {
  it("rejects a missing target with not_found", async () => {
    expect(await rejection(build().execute(input({targetUid: "ghost"})))).toBe(
      "not_found",
    );
  });

  it("does not see a target that only exists in another tenant", async () => {
    await memberships.save(
      member("other-1", "coordinator", {tenantId: "tenant-b"}),
    );
    expect(
      await rejection(build().execute(input({targetUid: "other-1"}))),
    ).toBe("not_found");
  });
});

describe("SetMembershipStatus — atomicity", () => {
  it("leaves the status untouched when the audit write fails", async () => {
    auditLog.failWith = new Error("audit down");
    await expect(build().execute(input())).rejects.toThrow("audit down");
    expect(await statusOf("coord-1")).toBe("active");
  });
});
