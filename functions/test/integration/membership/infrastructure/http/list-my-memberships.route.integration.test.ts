import type {Membership} from "../../../../../src/membership/domain/membership.js";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "../../../../../src/membership/infrastructure/firestore/firestore-membership-repository.js";
import {listMyMembershipsOutput} from "../../../../../src/membership/infrastructure/http/routes/listMyMemberships/schema.js";
import {
  callApi,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../../../src/shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  INTEGRATION_PROJECT_ID,
  testDb,
} from "../../../../../src/shared/infrastructure/testing/helpers.js";

const db = testDb();
const repo = new FirestoreMembershipRepository(db);

const membership = (
  uid: string,
  tenantId: string,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role: "coordinator",
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

let userA: TestUser;
let userB: TestUser;

const list = (caller?: TestUser) =>
  callApi(
    "membershipApi",
    "GET",
    "/me/memberships",
    undefined,
    caller?.idToken,
  );

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  userA = await createUser("a@example.com");
  userB = await createUser("b@example.com");
  await db.doc("tenants/tenant-a").set({name: "Escuela A", status: "active"});
  await db.doc("tenants/tenant-b").set({name: "Escuela B", status: "active"});
  await repo.save(membership(userA.uid, "tenant-a", {role: "owner"}));
  await repo.save(membership(userB.uid, "tenant-b"));
});

describe("GET /me/memberships", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await list();
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
  });

  it("rejects an invalid token as unauthenticated", async () => {
    const {status, body} = await callApi(
      "membershipApi",
      "GET",
      "/me/memberships",
      undefined,
      "not-a-token",
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
  });

  it("returns the caller's memberships matching the output schema", async () => {
    const {status, body} = await list(userA);
    expect(status).toBe(200);
    expect(listMyMembershipsOutput.parse(body).memberships).toEqual([
      {
        tenantId: "tenant-a",
        tenantName: "Escuela A",
        role: "owner",
        scope: {venueIds: [], groupIds: [], playerIds: []},
      },
    ]);
  });

  it("does not return tenant-a to a user who only belongs to tenant-b", async () => {
    const {body} = await list(userB);
    const tenantIds = body.memberships.map(
      (m: {tenantId: string}) => m.tenantId,
    );
    expect(tenantIds).toEqual(["tenant-b"]);
  });

  it("stops listing a membership right after it is deactivated", async () => {
    await repo.save(
      membership(userA.uid, "tenant-a", {role: "owner", status: "inactive"}),
    );
    const {body} = await list(userA);
    expect(body.memberships).toEqual([]);
  });
});

describe("membershipApi — shared behavior", () => {
  it("answers 404 on an unknown route", async () => {
    const {status, body} = await callApi(
      "membershipApi",
      "GET",
      "/nowhere",
      undefined,
      userA.idToken,
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("answers a preflight from any origin with the CORS header", async () => {
    const host = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";
    const response = await fetch(
      `http://${host}/${INTEGRATION_PROJECT_ID}/us-central1/membershipApi` +
        "/me/memberships",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.org",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      },
    );
    expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
  });
});
