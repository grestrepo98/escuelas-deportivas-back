import {ROLES, type Role} from "../../../../../src/membership/domain/role.js";
import {type Membership} from "../../../../../src/membership/domain/membership.js";
import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "../../../../../src/membership/infrastructure/firestore/firestore-membership-repository.js";
import {
  callApi,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../../../src/shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  testDb,
} from "../../../../../src/shared/infrastructure/testing/helpers.js";
import {updateTenantProfileOutput} from "../../../../../src/tenant/infrastructure/http/routes/updateTenantProfile/schema.js";

const db = testDb();
const memberships = new FirestoreMembershipRepository(db);
const T0 = new Date("2026-10-01T00:00:00Z");

const membership = (
  uid: string,
  tenantId: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const tenantDoc = async (id = "tenant-a") =>
  (await db.doc(`tenants/${id}`).get()).data();
const audit = async (tenantId = "tenant-a") =>
  (await db.collection(`tenants/${tenantId}/auditLog`).get()).docs.map((d) =>
    d.data(),
  );

let owner: TestUser;
let ownerB: TestUser;

const update = (
  caller: TestUser | undefined,
  data: unknown,
  tenantId = "tenant-a",
) =>
  callApi(
    "tenantApi",
    "PUT",
    `/tenants/${tenantId}/profile`,
    data,
    caller?.idToken,
  );

const validInput = (overrides = {}) => ({
  name: "Escuela Nueva",
  idrdRegistration: "IDRD-123",
  contact: {email: "info@escuela.co", phone: "3001112233"},
  ...overrides,
});

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  owner = await createUser("owner-a@example.com");
  ownerB = await createUser("owner-b@example.com");
  for (const id of ["tenant-a", "tenant-b"]) {
    await db.doc(`tenants/${id}`).set({
      name: `Escuela ${id}`,
      status: "active",
      contact: {},
      createdAt: Timestamp.fromDate(T0),
      updatedAt: Timestamp.fromDate(T0),
    });
  }
  await memberships.save(membership(owner.uid, "tenant-a", "owner"));
  await memberships.save(membership(ownerB.uid, "tenant-b", "owner"));
});

describe("PUT /tenants/:tenantId/profile — success", () => {
  it("updates the profile and writes exactly one audit entry", async () => {
    const {status, body} = await update(owner, validInput());
    expect(status).toBe(200);
    expect(updateTenantProfileOutput.parse(body)).toEqual({
      tenantId: "tenant-a",
    });

    expect(await tenantDoc()).toMatchObject({
      name: "Escuela Nueva",
      status: "active",
      idrdRegistration: "IDRD-123",
      contact: {email: "info@escuela.co", phone: "3001112233"},
    });
    const entries = await audit();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      tenantId: "tenant-a",
      actorUid: owner.uid,
      actorRole: "owner",
      action: "tenant.updated",
      target: {type: "tenant", id: "tenant-a"},
      before: {name: "Escuela tenant-a"},
      after: {name: "Escuela Nueva"},
    });
  });

  it("stores blank optional text as absent", async () => {
    const {status} = await update(
      owner,
      validInput({
        idrdRegistration: "  ",
        contact: {email: "", phone: " "},
      }),
    );
    expect(status).toBe(200);
    const data = await tenantDoc();
    expect(data).not.toHaveProperty("idrdRegistration");
    expect(data?.contact).toEqual({});
  });
});

describe("PUT /tenants/:tenantId/profile — policyWarningDays", () => {
  it("reads a tenant without the field as 30 and keeps it when omitted", async () => {
    const {status} = await update(owner, validInput());
    expect(status).toBe(200);
    expect((await tenantDoc())?.policyWarningDays).toBe(30);
  });

  it("stores a new value between 1 and 365", async () => {
    const {status} = await update(owner, validInput({policyWarningDays: 45}));
    expect(status).toBe(200);
    expect((await tenantDoc())?.policyWarningDays).toBe(45);
  });

  it.each([0, 366, 1.5, "30"])("rejects %s", async (days) => {
    const {status, body} = await update(
      owner,
      validInput({policyWarningDays: days}),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect(await audit()).toHaveLength(0);
  });
});

describe("PUT /tenants/:tenantId/profile — authentication", () => {
  it("rejects a caller without a token as unauthenticated", async () => {
    const {status, body} = await update(undefined, validInput());
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
  });
});

describe("PUT /tenants/:tenantId/profile — tenant isolation", () => {
  it("denies an owner of tenant-b who targets tenant-a", async () => {
    const {status, body} = await update(ownerB, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
    expect(await audit()).toHaveLength(0);
  });
});

describe("PUT /tenants/:tenantId/profile — only owners", () => {
  it.each(ROLES.filter((r) => r !== "owner"))("denies a %s", async (role) => {
    const caller = await createUser(`${role}@example.com`);
    await memberships.save(membership(caller.uid, "tenant-a", role));
    const {status, body} = await update(caller, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
    expect(await audit()).toHaveLength(0);
  });

  it("denies an owner right after being deactivated, with the same token", async () => {
    await memberships.save(
      membership(owner.uid, "tenant-a", "owner", {status: "inactive"}),
    );
    const {status, body} = await update(owner, validInput());
    expect(status).toBe(403);
    expect(body.error.code).toBe("permission_denied");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
  });
});

describe("PUT /tenants/:tenantId/profile — business rules", () => {
  it("rejects a blank name as invalid_argument", async () => {
    const {status, body} = await update(owner, validInput({name: "   "}));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
  });
});

describe("PUT /tenants/:tenantId/profile — input validation", () => {
  it.each([
    ["missing name", {contact: {}}],
    ["missing contact", {name: "X"}],
    ["malformed email", {name: "X", contact: {email: "not-an-email"}}],
    ["non-string name", {name: 7, contact: {}}],
    ["unexpected field", {name: "X", contact: {}, status: "suspended"}],
    ["unexpected contact field", {name: "X", contact: {fax: "1"}}],
    ["tenantId in the body", {name: "X", contact: {}, tenantId: "tenant-a"}],
    ["no body", undefined],
  ])("rejects %s as invalid_argument", async (_name, data) => {
    const {status, body} = await update(owner, data);
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_argument");
    expect((await tenantDoc())?.name).toBe("Escuela tenant-a");
    expect(await audit()).toHaveLength(0);
  });
});

describe("tenantApi — shared behavior", () => {
  it("answers 404 on an unknown route", async () => {
    const {status, body} = await callApi(
      "tenantApi",
      "GET",
      "/nowhere",
      undefined,
      owner.idToken,
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});
