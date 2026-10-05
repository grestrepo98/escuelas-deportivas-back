// Shared setup of the membership route integration tests (emulators only).
import {Timestamp} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {FirestoreMembershipRepository} from "../firestore/firestore-membership-repository.js";
import type {Membership} from "../../domain/membership.js";
import type {Role} from "../../domain/role.js";
import {
  callApi,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  INTEGRATION_PROJECT_ID,
  testApp,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";

export {callApi, createUser, INTEGRATION_PROJECT_ID, type TestUser};

export const db = testDb();
export const auth = getAuth(testApp());
export const repo = new FirestoreMembershipRepository(db);

export const T0 = new Date("2026-10-01T00:00:00Z");

export const noScope = {venueIds: [], groupIds: [], playerIds: []};

export const membership = (
  uid: string,
  tenantId: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId,
  role,
  status: "active",
  scope: noScope,
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

// An Auth user (already signed in) plus its membership.
export async function member(
  email: string,
  tenantId: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Promise<TestUser> {
  const user = await createUser(email);
  await repo.save(membership(user.uid, tenantId, role, overrides));
  return user;
}

export const seedVenue = (
  id: string,
  fields: Record<string, unknown> = {},
  tenantId = "tenant-a",
) =>
  db.doc(`tenants/${tenantId}/venues/${id}`).set({
    name: `Sede ${id}`,
    address: "Calle 1",
    status: "active",
    createdAt: Timestamp.fromDate(T0),
    updatedAt: Timestamp.fromDate(T0),
    ...fields,
  });

export const seedGroup = (
  id: string,
  venueId: string,
  fields: Record<string, unknown> = {},
  tenantId = "tenant-a",
) =>
  db.doc(`tenants/${tenantId}/groups/${id}`).set({
    venueId,
    categoryId: "cat-1",
    name: `Grupo ${id}`,
    schedule: [],
    status: "active",
    createdAt: Timestamp.fromDate(T0),
    updatedAt: Timestamp.fromDate(T0),
    ...fields,
  });

export async function auditEntries(tenantId = "tenant-a") {
  const snap = await db.collection(`tenants/${tenantId}/auditLog`).get();
  return snap.docs.map((d) => d.data());
}

export async function resetEmulators(): Promise<void> {
  await clearFirestore();
  await clearAuth();
}

// Sends a raw body, which the Functions runtime may reject before the app.
export async function callRaw(
  method: string,
  path: string,
  raw: string,
  idToken: string,
): Promise<number> {
  const response = await fetch(
    `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001"}/` +
      `${INTEGRATION_PROJECT_ID}/us-central1/membershipApi${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: raw,
    },
  );
  return response.status;
}
