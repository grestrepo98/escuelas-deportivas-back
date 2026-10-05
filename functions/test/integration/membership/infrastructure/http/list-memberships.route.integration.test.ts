import {beforeEach, describe, expect, it} from "vitest";
import {listMembershipsOutput} from "../../../../../src/membership/infrastructure/http/routes/listMemberships/schema.js";
import {
  callApi,
  member,
  repo,
  resetEmulators,
  seedGroup,
  seedVenue,
  type TestUser,
} from "../../../../../src/membership/infrastructure/http/route-test-kit.js";

const users: Record<string, TestUser> = {};

const list = (caller: TestUser | undefined, tenantId = "tenant-a") =>
  callApi(
    "membershipApi",
    "GET",
    `/tenants/${tenantId}/memberships`,
    undefined,
    caller?.idToken,
  );

const scoped = (venueIds: string[], groupIds: string[] = []) => ({
  venueIds,
  groupIds,
  playerIds: [],
});

const add = async (
  name: string,
  role: Parameters<typeof member>[2],
  overrides: Parameters<typeof member>[3] = {},
  tenantId = "tenant-a",
) => {
  users[name] = await member(`${name}@example.com`, tenantId, role, overrides);
};

const emailsSeenBy = async (caller: TestUser) => {
  const {status, body} = await list(caller);
  expect(status).toBe(200);
  return listMembershipsOutput
    .parse(body)
    .memberships.map((m) => m.email)
    .sort();
};

beforeEach(async () => {
  await resetEmulators();
  await seedVenue("venue-1");
  await seedVenue("venue-2");
  await seedGroup("group-1", "venue-1");
  await seedGroup("group-2", "venue-2");

  await add("owner", "owner");
  await add("accountant", "accountant");
  await add("coord1", "coordinator", {scope: scoped(["venue-1"])});
  await add("coord2", "coordinator", {scope: scoped(["venue-2"])});
  await add("teacher1", "teacher", {scope: scoped([], ["group-1"])});
  await add("teacher2", "teacher", {scope: scoped([], ["group-2"])});
  await add("guardian", "guardian");
  await add("gone", "teacher", {
    status: "inactive",
    scope: scoped([], ["group-1"]),
  });
  await add("ownerB", "owner", {}, "tenant-b");
});

const all = [
  "accountant",
  "coord1",
  "coord2",
  "gone",
  "guardian",
  "owner",
  "teacher1",
  "teacher2",
].map((n) => `${n}@example.com`);

describe("GET /tenants/:tenantId/memberships — who sees what", () => {
  it.each(["owner", "accountant"])("%s sees every member", async (name) => {
    expect(await emailsSeenBy(users[name])).toEqual(all);
  });

  it("a coordinator sees only the members of their venues", async () => {
    expect(await emailsSeenBy(users.coord1)).toEqual(
      ["coord1", "gone", "teacher1"].map((n) => `${n}@example.com`),
    );
  });

  it.each(["teacher1", "guardian"])("denies a %s with 403", async (name) => {
    const {status, body} = await list(users[name]);
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
  });

  it("never exposes members of another organization", async () => {
    const seen = await emailsSeenBy(users.owner);
    expect(seen).not.toContain("ownerB@example.com");
  });
});

describe("GET …/memberships — the payload", () => {
  it("returns uid, email, role, status and scope", async () => {
    const {body} = await list(users.owner);

    const found = listMembershipsOutput
      .parse(body)
      .memberships.find((m) => m.email === "teacher1@example.com");
    expect(found).toEqual({
      uid: users.teacher1.uid,
      email: "teacher1@example.com",
      role: "teacher",
      status: "active",
      scope: scoped([], ["group-1"]),
    });
  });
});

describe("GET …/memberships — authentication and isolation", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await list(undefined);
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
  });

  it("denies an owner of another organization", async () => {
    const {status, body} = await list(users.ownerB);
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
  });

  it("denies a member right after being deactivated, with the same token", async () => {
    expect((await list(users.coord1)).status).toBe(200);

    await repo.save({
      ...(await repo.get(users.coord1.uid, "tenant-a"))!,
      status: "inactive",
    });

    const {status, body} = await list(users.coord1);
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
  });
});
