import {beforeEach, describe, expect, it} from "vitest";
import {setMembershipStatusOutput} from "./routes/setMembershipStatus/schema.js";
import type {Role} from "../../domain/role.js";
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
} from "./route-test-kit.js";

let ownerA: TestUser;
let ownerB: TestUser;
let coordinator: TestUser;

const setStatus = (
  caller: TestUser | undefined,
  data: unknown,
  {tenantId = "tenant-a", uid = coordinator.uid} = {},
) =>
  callApi(
    "membershipApi",
    "PATCH",
    `/tenants/${tenantId}/memberships/${uid}/status`,
    data,
    caller?.idToken,
  );

const statusOf = async (uid: string) =>
  (await repo.get(uid, "tenant-a"))?.status;

beforeEach(async () => {
  await resetEmulators();
  await seedVenue("venue-1");
  await seedVenue("venue-closed", {status: "closed"});
  ownerA = await member("owner-a@example.com", "tenant-a", "owner");
  ownerB = await member("owner-b@example.com", "tenant-b", "owner");
  coordinator = await member("coord@example.com", "tenant-a", "coordinator", {
    scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
  });
});

describe("PATCH /tenants/:tenantId/memberships/:uid/status — deactivating", () => {
  it("deactivates and writes one status_changed entry", async () => {
    const {status, body} = await setStatus(ownerA, {
      status: "inactive",
      reason: "left the club",
    });

    expect(status).toBe(200);
    expect(setMembershipStatusOutput.parse(body)).toEqual({
      membershipId: `${coordinator.uid}_tenant-a`,
      status: "inactive",
    });
    expect(await statusOf(coordinator.uid)).toBe("inactive");

    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUid: ownerA.uid,
      action: "membership.status_changed",
      target: {type: "membership", id: `${coordinator.uid}_tenant-a`},
      before: {status: "active"},
      after: {status: "inactive"},
      reason: "left the club",
    });
  });

  it("cuts access on the next call, in any route, with the same token", async () => {
    const structure = () =>
      callApi(
        "structureApi",
        "GET",
        "/tenants/tenant-a/structure",
        undefined,
        coordinator.idToken,
      );
    const listing = () =>
      callApi(
        "membershipApi",
        "GET",
        "/tenants/tenant-a/memberships",
        undefined,
        coordinator.idToken,
      );
    expect((await structure()).status).toBe(200);
    expect((await listing()).status).toBe(200);

    await setStatus(ownerA, {status: "inactive"});

    expect((await structure()).status).toBe(403);
    expect((await listing()).status).toBe(403);
  });

  it("keeps the membership, its history and the Auth account", async () => {
    await setStatus(ownerA, {status: "inactive"});

    expect(await repo.get(coordinator.uid, "tenant-a")).toMatchObject({
      role: "coordinator",
      scope: {venueIds: ["venue-1"]},
    });
    expect((await auditEntries()).length).toBeGreaterThan(0);
    expect((await auth.getUser(coordinator.uid)).email).toBe(
      "coord@example.com",
    );
  });

  it("refuses to deactivate the last active owner", async () => {
    const {status, body} = await setStatus(
      ownerA,
      {status: "inactive"},
      {uid: ownerA.uid},
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
    expect(await statusOf(ownerA.uid)).toBe("active");
    expect(await auditEntries()).toHaveLength(0);
  });

  it("lets an owner be deactivated while another active one remains", async () => {
    const second = await member("owner-2@example.com", "tenant-a", "owner");
    const {status} = await setStatus(
      ownerA,
      {status: "inactive"},
      {uid: second.uid},
    );
    expect(status).toBe(200);
    expect(await statusOf(second.uid)).toBe("inactive");
  });
});

describe("PATCH …/status — reactivating", () => {
  beforeEach(async () => {
    await setStatus(ownerA, {status: "inactive"});
  });

  it("reactivates and the same token works again", async () => {
    const {status, body} = await setStatus(ownerA, {status: "active"});

    expect(status).toBe(200);
    expect(body.status).toBe("active");
    const listing = await callApi(
      "membershipApi",
      "GET",
      "/tenants/tenant-a/memberships",
      undefined,
      coordinator.idToken,
    );
    expect(listing.status).toBe(200);
  });

  it("answers 409 when the stored scope points to a closed venue", async () => {
    await repo.save({
      ...(await repo.get(coordinator.uid, "tenant-a"))!,
      scope: {venueIds: ["venue-closed"], groupIds: [], playerIds: []},
    });

    const {status, body} = await setStatus(ownerA, {status: "active"});

    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
    expect(await statusOf(coordinator.uid)).toBe("inactive");
  });

  it("answers 409 when the stored scope points to a closed group", async () => {
    await seedGroup("group-closed", "venue-1", {status: "closed"});
    const teacher = await member("teach@example.com", "tenant-a", "teacher", {
      status: "inactive",
      scope: {venueIds: [], groupIds: ["group-closed"], playerIds: []},
    });

    const {status} = await setStatus(
      ownerA,
      {status: "active"},
      {uid: teacher.uid},
    );

    expect(status).toBe(409);
    expect(await statusOf(teacher.uid)).toBe("inactive");
  });
});

describe("PATCH …/status — no change and unknown targets", () => {
  it("refuses a status the membership already has", async () => {
    const {status, body} = await setStatus(ownerA, {status: "active"});
    expect(status).toBe(409);
    expect(body.error.code).toBe("failed_precondition");
  });

  it("answers not-found for a target without membership", async () => {
    const {status, body} = await setStatus(
      ownerA,
      {status: "inactive"},
      {uid: "nobody"},
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("PATCH …/status — authentication and isolation", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await setStatus(undefined, {status: "inactive"});
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
    expect(await statusOf(coordinator.uid)).toBe("active");
  });

  it("denies an owner of another organization", async () => {
    const {status, body} = await setStatus(ownerB, {status: "inactive"});
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect(await statusOf(coordinator.uid)).toBe("active");
    expect(await auditEntries()).toHaveLength(0);
  });

  it.each(["accountant", "coordinator", "teacher", "guardian"] as Role[])(
    "denies a %s",
    async (role) => {
      const caller = await member(`${role}@example.com`, "tenant-a", role);
      const target = role === "coordinator" ? ownerA.uid : coordinator.uid;
      const {status, body} = await setStatus(
        caller,
        {status: "inactive"},
        {uid: target},
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe("permission_denied");
      expect(await statusOf(target)).toBe("active");
      expect(await auditEntries()).toHaveLength(0);
    },
  );
});

describe("PATCH …/status — input validation", () => {
  it.each([
    ["missing status", {}],
    ["unknown status", {status: "banana"}],
    ["closed is not a membership status", {status: "closed"}],
    ["non-string reason", {status: "inactive", reason: 7}],
    ["reason too long", {status: "inactive", reason: "x".repeat(501)}],
    ["unexpected field", {status: "inactive", actorUid: "y"}],
    ["tenantId in the body", {status: "inactive", tenantId: "tenant-a"}],
    ["no body", undefined],
  ])("rejects %s as invalid_argument", async (_name, data) => {
    const {status, body} = await setStatus(ownerA, data);
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect(await statusOf(coordinator.uid)).toBe("active");
  });

  it.each([
    ["a null payload", "null"],
    ["malformed JSON", "{"],
  ])("rejects %s with 400", async (_name, raw) => {
    expect(
      await callRaw(
        "PATCH",
        `/tenants/tenant-a/memberships/${coordinator.uid}/status`,
        raw,
        ownerA.idToken,
      ),
    ).toBe(400);
    expect(await statusOf(coordinator.uid)).toBe("active");
  });
});
