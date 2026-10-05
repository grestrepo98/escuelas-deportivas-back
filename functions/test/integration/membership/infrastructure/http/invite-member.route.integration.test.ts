import {beforeEach, describe, expect, it} from "vitest";
import {inviteMemberOutput} from "../../../../../src/membership/infrastructure/http/routes/inviteMember/schema.js";
import type {Role} from "../../../../../src/membership/domain/role.js";
import {
  auditEntries,
  auth,
  callApi,
  callRaw,
  member,
  repo,
  resetEmulators,
  seedGroup,
  seedVenue,
  type TestUser,
} from "../../../../../src/membership/infrastructure/http/route-test-kit.js";

let ownerA: TestUser;
let ownerB: TestUser;

const invite = (
  caller: TestUser | undefined,
  data: unknown,
  tenantId = "tenant-a",
) =>
  callApi(
    "membershipApi",
    "POST",
    `/tenants/${tenantId}/memberships`,
    data,
    caller?.idToken,
  );

const validInput = (overrides = {}) => ({
  email: "ana@club.co",
  role: "coordinator",
  scope: {venueIds: ["venue-1"]},
  ...overrides,
});

const accountExists = async (email: string) =>
  auth
    .getUserByEmail(email)
    .then(() => true)
    .catch(() => false);

const memberCount = async () => (await repo.listByTenant("tenant-a")).length;

beforeEach(async () => {
  await resetEmulators();
  ownerA = await member("owner-a@example.com", "tenant-a", "owner");
  ownerB = await member("owner-b@example.com", "tenant-b", "owner");
  await seedVenue("venue-1");
  await seedVenue("venue-closed", {status: "closed"});
  await seedVenue("venue-b", {}, "tenant-b");
  await seedGroup("group-1", "venue-1");
});

describe("POST /tenants/:tenantId/memberships — a new account", () => {
  it("creates the account, an active membership and returns the link", async () => {
    const {status, body} = await invite(ownerA, validInput());

    expect(status).toBe(201);
    const result = inviteMemberOutput.parse(body);
    const account = await auth.getUserByEmail("ana@club.co");
    expect(result).toMatchObject({
      uid: account.uid,
      membershipId: `${account.uid}_tenant-a`,
      role: "coordinator",
    });
    expect(result.passwordResetLink).toContain("oobCode=");
    expect(await repo.get(account.uid, "tenant-a")).toMatchObject({
      role: "coordinator",
      status: "active",
      scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
    });
  });

  it("writes exactly one membership.invited entry", async () => {
    const {body} = await invite(ownerA, validInput());

    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      tenantId: "tenant-a",
      actorUid: ownerA.uid,
      actorRole: "owner",
      action: "membership.invited",
      target: {type: "membership", id: body.membershipId},
      before: {},
      after: {
        role: "coordinator",
        status: "active",
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      },
    });
    expect(JSON.stringify(entries)).not.toContain("ana@club.co");
  });

  it("invites a teacher with groups and an accountant without scope", async () => {
    const teacher = await invite(
      ownerA,
      validInput({
        email: "teo@club.co",
        role: "teacher",
        scope: {groupIds: ["group-1"]},
      }),
    );
    const accountant = await invite(
      ownerA,
      validInput({email: "ace@club.co", role: "accountant", scope: undefined}),
    );

    expect(teacher.status).toBe(201);
    expect(accountant.status).toBe(201);
    expect(
      (await repo.get(teacher.body.uid, "tenant-a"))!.scope.groupIds,
    ).toEqual(["group-1"]);
    expect((await repo.get(accountant.body.uid, "tenant-a"))!.role).toBe(
      "accountant",
    );
  });
});

describe("POST …/memberships — an existing account", () => {
  it("reuses the uid of someone who already signed in elsewhere, with no link", async () => {
    const other = await member("ana@club.co", "tenant-b", "teacher");

    const {status, body} = await invite(ownerA, validInput());

    expect(status).toBe(201);
    expect(body.uid).toBe(other.uid);
    expect("passwordResetLink" in body).toBe(false);
    expect((await repo.get(other.uid, "tenant-a"))!.role).toBe("coordinator");
    expect((await repo.get(other.uid, "tenant-b"))!.role).toBe("teacher");
  });

  it("gives a link again to an account that never signed in", async () => {
    const orphan = await auth.createUser({email: "ana@club.co"});

    const {status, body} = await invite(ownerA, validInput());

    expect(status).toBe(201);
    expect(body.uid).toBe(orphan.uid);
    expect(body.passwordResetLink).toContain("oobCode=");
  });

  it.each(["active", "inactive"] as const)(
    "answers 409 when the person already has a %s membership",
    async (state) => {
      const existing = await member("ana@club.co", "tenant-a", "teacher", {
        status: state,
      });

      const {status, body} = await invite(ownerA, validInput());

      expect(status).toBe(409);
      expect(body.error.code).toBe("failed_precondition");
      expect((await repo.get(existing.uid, "tenant-a"))!.role).toBe("teacher");
      expect(await auditEntries()).toHaveLength(0);
    },
  );
});

describe("POST …/memberships — scope that does not fit", () => {
  it.each([
    [
      "a coordinator without venues",
      {role: "coordinator", scope: undefined},
      400,
    ],
    [
      "a coordinator with groups",
      {
        role: "coordinator",
        scope: {venueIds: ["venue-1"], groupIds: ["group-1"]},
      },
      400,
    ],
    ["a teacher without groups", {role: "teacher", scope: undefined}, 400],
    [
      "an accountant with a scope",
      {role: "accountant", scope: {venueIds: ["venue-1"]}},
      400,
    ],
    ["a venue of another organization", {scope: {venueIds: ["venue-b"]}}, 400],
    ["a venue that does not exist", {scope: {venueIds: ["venue-9"]}}, 400],
    ["a closed venue", {scope: {venueIds: ["venue-closed"]}}, 409],
  ])("rejects %s and creates nothing", async (_name, overrides, expected) => {
    const {status} = await invite(ownerA, validInput(overrides));

    expect(status).toBe(expected);
    expect(await accountExists("ana@club.co")).toBe(false);
    expect(await memberCount()).toBe(1);
    expect(await auditEntries()).toHaveLength(0);
  });
});

describe("POST …/memberships — authentication and isolation", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await invite(undefined, validInput());
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
    expect(await accountExists("ana@club.co")).toBe(false);
  });

  it("denies an owner of another organization", async () => {
    const {status, body} = await invite(ownerB, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect(await accountExists("ana@club.co")).toBe(false);
    expect(await memberCount()).toBe(1);
  });

  it.each(["accountant", "coordinator", "teacher", "guardian"] as Role[])(
    "denies a %s",
    async (role) => {
      const caller = await member(`${role}@example.com`, "tenant-a", role);
      const {status, body} = await invite(caller, validInput());
      expect(status).toBe(403);
      expect(body.error.code).toBe("permission_denied");
      expect(await accountExists("ana@club.co")).toBe(false);
      expect(await auditEntries()).toHaveLength(0);
    },
  );

  it("denies an owner right after being deactivated, with the same token", async () => {
    await repo.save({
      ...(await repo.get(ownerA.uid, "tenant-a"))!,
      status: "inactive",
    });
    const {status, body} = await invite(ownerA, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
  });
});

describe("POST …/memberships — input validation", () => {
  it.each([
    ["missing email", {role: "teacher", scope: {groupIds: ["group-1"]}}],
    ["malformed email", validInput({email: "not-an-email"})],
    ["blank email", validInput({email: ""})],
    ["missing role", {email: "ana@club.co"}],
    ["owner is not invitable", validInput({role: "owner", scope: undefined})],
    ["guardian is not invitable", validInput({role: "guardian"})],
    ["unknown role", validInput({role: "boss"})],
    ["venueIds is not a list", validInput({scope: {venueIds: "venue-1"}})],
    ["a blank venue id", validInput({scope: {venueIds: [""]}})],
    ["too many venues", validInput({scope: {venueIds: Array(101).fill("v")}})],
    [
      "playerIds in the scope",
      validInput({scope: {venueIds: ["venue-1"], playerIds: ["p"]}}),
    ],
    ["unexpected field", validInput({actorUid: "y"})],
    ["tenantId in the body", validInput({tenantId: "tenant-a"})],
    ["no body", undefined],
  ])("rejects %s as invalid_argument", async (_name, data) => {
    const {status, body} = await invite(ownerA, data);
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect(await accountExists("ana@club.co")).toBe(false);
    expect(await memberCount()).toBe(1);
  });

  it.each([
    ["a null payload", "null"],
    ["malformed JSON", "{"],
  ])("rejects %s with 400", async (_name, raw) => {
    expect(
      await callRaw(
        "POST",
        "/tenants/tenant-a/memberships",
        raw,
        ownerA.idToken,
      ),
    ).toBe(400);
    expect(await memberCount()).toBe(1);
  });
});
