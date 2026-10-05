import {beforeEach, describe, expect, it} from "vitest";
import {setMembershipScopeOutput} from "./routes/setMembershipScope/schema.js";
import type {Role} from "../../domain/role.js";
import {
  auditEntries,
  callApi,
  callRaw,
  member,
  repo,
  resetEmulators,
  seedGroup,
  seedVenue,
  type TestUser,
} from "./route-test-kit.js";

let ownerA: TestUser;
let ownerB: TestUser;
let coordinator: TestUser;
let teacher: TestUser;

const setScope = (
  caller: TestUser | undefined,
  data: unknown,
  {tenantId = "tenant-a", uid = coordinator.uid} = {},
) =>
  callApi(
    "membershipApi",
    "PUT",
    `/tenants/${tenantId}/memberships/${uid}/scope`,
    data,
    caller?.idToken,
  );

const scopeOf = async (uid: string) => (await repo.get(uid, "tenant-a"))!.scope;

beforeEach(async () => {
  await resetEmulators();
  await seedVenue("venue-1");
  await seedVenue("venue-2");
  await seedVenue("venue-closed", {status: "closed"});
  await seedVenue("venue-b", {}, "tenant-b");
  await seedGroup("group-1", "venue-1");
  await seedGroup("group-2", "venue-2");
  await seedGroup("group-closed", "venue-1", {status: "closed"});
  ownerA = await member("owner-a@example.com", "tenant-a", "owner");
  ownerB = await member("owner-b@example.com", "tenant-b", "owner");
  coordinator = await member("coord@example.com", "tenant-a", "coordinator", {
    scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
  });
  teacher = await member("teach@example.com", "tenant-a", "teacher", {
    scope: {venueIds: [], groupIds: ["group-1"], playerIds: []},
  });
});

describe("PUT /tenants/:tenantId/memberships/:uid/scope — success", () => {
  it("replaces the venues of a coordinator and writes one entry", async () => {
    const {status, body} = await setScope(ownerA, {
      scope: {venueIds: ["venue-1", "venue-2"]},
    });

    expect(status).toBe(200);
    expect(setMembershipScopeOutput.parse(body)).toEqual({
      membershipId: `${coordinator.uid}_tenant-a`,
      scope: {venueIds: ["venue-1", "venue-2"], groupIds: [], playerIds: []},
    });
    expect((await scopeOf(coordinator.uid)).venueIds).toEqual([
      "venue-1",
      "venue-2",
    ]);

    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUid: ownerA.uid,
      action: "membership.scope_changed",
      target: {type: "membership", id: `${coordinator.uid}_tenant-a`},
      before: {scope: {venueIds: ["venue-1"]}},
      after: {scope: {venueIds: ["venue-1", "venue-2"]}},
    });
  });

  it("replaces the groups of a teacher", async () => {
    const {status} = await setScope(
      ownerA,
      {scope: {groupIds: ["group-2"]}},
      {uid: teacher.uid},
    );
    expect(status).toBe(200);
    expect((await scopeOf(teacher.uid)).groupIds).toEqual(["group-2"]);
  });
});

describe("PUT …/scope — the scope must fit the role and the structure", () => {
  it.each([
    ["no venues for a coordinator", {scope: {}}, 400],
    ["empty venues for a coordinator", {scope: {venueIds: []}}, 400],
    [
      "groups for a coordinator",
      {scope: {venueIds: ["venue-1"], groupIds: ["group-1"]}},
      400,
    ],
    ["a venue of another organization", {scope: {venueIds: ["venue-b"]}}, 400],
    ["a venue that does not exist", {scope: {venueIds: ["venue-9"]}}, 400],
    ["a closed venue", {scope: {venueIds: ["venue-closed"]}}, 409],
  ])("rejects %s and changes nothing", async (_name, data, expected) => {
    const {status} = await setScope(ownerA, data);
    expect(status).toBe(expected);
    expect((await scopeOf(coordinator.uid)).venueIds).toEqual(["venue-1"]);
    expect(await auditEntries()).toHaveLength(0);
  });

  it("rejects venues for a teacher and a closed group", async () => {
    expect(
      (
        await setScope(
          ownerA,
          {scope: {venueIds: ["venue-1"]}},
          {uid: teacher.uid},
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await setScope(
          ownerA,
          {scope: {groupIds: ["group-closed"]}},
          {uid: teacher.uid},
        )
      ).status,
    ).toBe(409);
    expect((await scopeOf(teacher.uid)).groupIds).toEqual(["group-1"]);
  });

  it("does not manage the scope of a guardian", async () => {
    const guardian = await member(
      "guardian@example.com",
      "tenant-a",
      "guardian",
    );
    const {status, body} = await setScope(
      ownerA,
      {scope: {}},
      {uid: guardian.uid},
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
  });

  it("answers not-found for a target without membership", async () => {
    const {status, body} = await setScope(
      ownerA,
      {scope: {venueIds: ["venue-1"]}},
      {uid: "nobody"},
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("PUT …/scope — authentication and isolation", () => {
  const valid = {scope: {venueIds: ["venue-2"]}};

  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await setScope(undefined, valid);
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
    expect((await scopeOf(coordinator.uid)).venueIds).toEqual(["venue-1"]);
  });

  it("denies an owner of another organization", async () => {
    const {status, body} = await setScope(ownerB, valid);
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect((await scopeOf(coordinator.uid)).venueIds).toEqual(["venue-1"]);
    expect(await auditEntries()).toHaveLength(0);
  });

  it.each(["accountant", "coordinator", "teacher", "guardian"] as Role[])(
    "denies a %s",
    async (role) => {
      const caller = await member(`${role}@example.com`, "tenant-a", role);
      const {status, body} = await setScope(caller, valid);
      expect(status).toBe(403);
      expect(body.error.code).toBe("permission_denied");
      expect((await scopeOf(coordinator.uid)).venueIds).toEqual(["venue-1"]);
    },
  );

  it("denies an owner right after being deactivated, with the same token", async () => {
    await repo.save({
      ...(await repo.get(ownerA.uid, "tenant-a"))!,
      status: "inactive",
    });
    const {status} = await setScope(ownerA, valid);
    expect(status).toBe(403);
  });
});

describe("PUT …/scope — input validation", () => {
  it.each([
    ["missing scope", {}],
    ["scope is not an object", {scope: "venue-1"}],
    ["venueIds is not a list", {scope: {venueIds: "venue-1"}}],
    ["a blank id", {scope: {venueIds: [""]}}],
    ["too many ids", {scope: {venueIds: Array(101).fill("v")}}],
    ["playerIds in the scope", {scope: {venueIds: ["venue-1"], playerIds: []}}],
    ["unexpected field", {scope: {venueIds: ["venue-1"]}, actorUid: "y"}],
    ["tenantId in the body", {scope: {venueIds: ["venue-1"]}, tenantId: "x"}],
    ["no body", undefined],
  ])("rejects %s as invalid_argument", async (_name, data) => {
    const {status, body} = await setScope(ownerA, data);
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect((await scopeOf(coordinator.uid)).venueIds).toEqual(["venue-1"]);
  });

  it.each([
    ["a null payload", "null"],
    ["malformed JSON", "{"],
  ])("rejects %s with 400", async (_name, raw) => {
    expect(
      await callRaw(
        "PUT",
        `/tenants/tenant-a/memberships/${coordinator.uid}/scope`,
        raw,
        ownerA.idToken,
      ),
    ).toBe(400);
  });
});
