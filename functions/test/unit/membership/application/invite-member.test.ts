import {beforeEach, describe, expect, it} from "vitest";
import {InviteMember} from "../../../../src/membership/application/invite-member.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import type {Group, Venue} from "../../../../src/structure/domain/structure.js";
import {FakeClock} from "../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryIdentityProvider} from "../../../../src/membership/application/testing/in-memory-identity-provider.js";
import {InMemoryMembershipRepository} from "../../../../src/membership/application/testing/in-memory-membership-repository.js";
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
let identity: InMemoryIdentityProvider;
let uow: InMemoryUnitOfWork;
let invite: InviteMember;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  identity = new InMemoryIdentityProvider();
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  invite = new InviteMember(uow, identity, clock);
  await memberships.save(member("owner-1", "owner"));
  await uow.venues.save(venue());
  await uow.venues.save(venue({id: "venue-closed", status: "closed"}));
  await uow.venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
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
  email: "ana@club.co",
  role: "coordinator" as const,
  scope: {venueIds: ["venue-1"]},
  ...overrides,
});

const nothingWritten = async () => {
  expect(await memberships.listByTenant("tenant-a")).toHaveLength(1);
  expect(auditLog.entries).toHaveLength(0);
};

describe("InviteMember — a new account", () => {
  it("creates the account, an active membership and a reset link", async () => {
    const result = await invite.execute(input());

    const account = await identity.findByEmail("ana@club.co");
    expect(account).not.toBeNull();
    expect(result).toEqual({
      uid: account!.uid,
      membershipId: `${account!.uid}_tenant-a`,
      role: "coordinator",
      passwordResetLink: await identity.createPasswordResetLink("ana@club.co"),
    });
    expect(await memberships.get(account!.uid, "tenant-a")).toEqual({
      uid: account!.uid,
      tenantId: "tenant-a",
      role: "coordinator",
      status: "active",
      scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("normalizes the email before using it", async () => {
    await invite.execute(input({email: "  Ana@Club.CO "}));
    expect(await identity.findByEmail("ana@club.co")).not.toBeNull();
  });

  it("writes one membership.invited entry with the scope", async () => {
    const {uid} = await invite.execute(input());

    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "membership.invited",
      target: {type: "membership", id: `${uid}_tenant-a`},
      before: {},
      after: {
        role: "coordinator",
        status: "active",
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      },
      at: NOW,
    });
  });

  it("does not store the email in the audit log", async () => {
    await invite.execute(input());
    expect(JSON.stringify(auditLog.entries)).not.toContain("ana@club.co");
  });

  it("passes the device and keeps it in the audit entry", async () => {
    await invite.execute(input({device: {userAgent: "jest"}}));
    expect(auditLog.entries[0].device).toEqual({userAgent: "jest"});
  });

  it("invites a teacher with groups", async () => {
    const {uid} = await invite.execute(
      input({role: "teacher", scope: {groupIds: ["group-1"]}}),
    );
    expect((await memberships.get(uid, "tenant-a"))?.scope).toEqual({
      venueIds: [],
      groupIds: ["group-1"],
      playerIds: [],
    });
  });

  it("invites an accountant without scope", async () => {
    const {uid} = await invite.execute(
      input({role: "accountant", scope: undefined}),
    );
    expect((await memberships.get(uid, "tenant-a"))?.role).toBe("accountant");
  });
});

describe("InviteMember — an existing account", () => {
  it("reuses a uid that has signed in and returns no link", async () => {
    const {uid} = identity.seed("ana@club.co", {hasSignedIn: true});

    const result = await invite.execute(input());

    expect(result.uid).toBe(uid);
    expect(result.passwordResetLink).toBeUndefined();
    expect("passwordResetLink" in result).toBe(false);
    expect((await memberships.get(uid, "tenant-a"))?.status).toBe("active");
  });

  it("returns a link when the account never signed in", async () => {
    const {uid} = identity.seed("ana@club.co", {hasSignedIn: false});

    const result = await invite.execute(input());

    expect(result.uid).toBe(uid);
    expect(result.passwordResetLink).toBe(
      await identity.createPasswordResetLink("ana@club.co"),
    );
  });

  it("adds a membership to a user who belongs to another tenant", async () => {
    const {uid} = identity.seed("ana@club.co", {hasSignedIn: true});
    await memberships.save(member(uid, "teacher", {tenantId: "tenant-b"}));

    await invite.execute(input());

    expect((await memberships.get(uid, "tenant-a"))?.role).toBe("coordinator");
    expect((await memberships.get(uid, "tenant-b"))?.role).toBe("teacher");
  });
});

describe("InviteMember — duplicates", () => {
  it.each(["active", "inactive"] as const)(
    "rejects someone who already has a %s membership with failed_precondition",
    async (status) => {
      const {uid} = identity.seed("ana@club.co", {hasSignedIn: true});
      await memberships.save(member(uid, "teacher", {status}));

      expect(await rejection(invite.execute(input()))).toBe(
        "failed_precondition",
      );
      expect((await memberships.get(uid, "tenant-a"))?.role).toBe("teacher");
      expect(auditLog.entries).toHaveLength(0);
    },
  );
});

describe("InviteMember — who may invite", () => {
  it.each(["accountant", "coordinator", "teacher", "guardian"] as const)(
    "rejects a %s with permission_denied and touches nothing",
    async (role) => {
      await memberships.save(member("actor-1", role));

      expect(
        await rejection(invite.execute(input({actorUid: "actor-1"}))),
      ).toBe("permission_denied");
      expect(await identity.findByEmail("ana@club.co")).toBeNull();
      expect(auditLog.entries).toHaveLength(0);
    },
  );

  it("rejects an inactive owner", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    expect(await rejection(invite.execute(input({actorUid: "owner-2"})))).toBe(
      "permission_denied",
    );
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    expect(await rejection(invite.execute(input({actorUid: "owner-b"})))).toBe(
      "permission_denied",
    );
    expect(await identity.findByEmail("ana@club.co")).toBeNull();
  });

  it("rejects an unknown actor", async () => {
    expect(await rejection(invite.execute(input({actorUid: "ghost"})))).toBe(
      "permission_denied",
    );
  });
});

describe("InviteMember — roles", () => {
  it.each(["owner", "guardian", "adultPlayer"] as const)(
    "does not invite a %s",
    async (role) => {
      expect(
        await rejection(invite.execute(input({role, scope: undefined}))),
      ).toBe("invalid_argument");
      expect(await identity.findByEmail("ana@club.co")).toBeNull();
      await nothingWritten();
    },
  );
});

describe("InviteMember — invalid scope", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    [
      "a coordinator without venues",
      {role: "coordinator", scope: undefined},
      "invalid_argument",
    ],
    [
      "a coordinator with groups",
      {
        role: "coordinator",
        scope: {venueIds: ["venue-1"], groupIds: ["group-1"]},
      },
      "invalid_argument",
    ],
    [
      "a teacher without groups",
      {role: "teacher", scope: undefined},
      "invalid_argument",
    ],
    [
      "a teacher with venues",
      {role: "teacher", scope: {venueIds: ["venue-1"], groupIds: ["group-1"]}},
      "invalid_argument",
    ],
    [
      "an accountant with a scope",
      {role: "accountant", scope: {venueIds: ["venue-1"]}},
      "invalid_argument",
    ],
    [
      "a venue from another organization",
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
      {role: "teacher", scope: {groupIds: ["group-closed"]}},
      "failed_precondition",
    ],
  ];

  it.each(cases)(
    "rejects %s without creating the account, membership or audit",
    async (_name, overrides, code) => {
      expect(await rejection(invite.execute(input(overrides)))).toBe(code);
      expect(await identity.findByEmail("ana@club.co")).toBeNull();
      await nothingWritten();
    },
  );
});

describe("InviteMember — email", () => {
  it("rejects a blank email", async () => {
    expect(await rejection(invite.execute(input({email: "   "})))).toBe(
      "invalid_argument",
    );
    await nothingWritten();
  });
});

describe("InviteMember — a failure after the account exists", () => {
  it("leaves no membership and lets the next invitation reuse the account", async () => {
    auditLog.failWith = new Error("audit down");

    await expect(invite.execute(input())).rejects.toThrow("audit down");

    const orphan = await identity.findByEmail("ana@club.co");
    expect(orphan).not.toBeNull();
    expect(await memberships.get(orphan!.uid, "tenant-a")).toBeNull();
    await nothingWritten();

    auditLog.failWith = null;
    const retry = await invite.execute(input());

    expect(retry.uid).toBe(orphan!.uid);
    expect(retry.passwordResetLink).toBeDefined();
    expect((await memberships.get(orphan!.uid, "tenant-a"))?.status).toBe(
      "active",
    );
  });
});
