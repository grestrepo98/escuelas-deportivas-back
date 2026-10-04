import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {afterAll, beforeAll, beforeEach, describe, it} from "vitest";
import {CALLERS, contextFor, initRulesEnv} from "./helpers";

// Seeded documents the callers are NOT allowed to touch directly.
const DOCS = [
  "tenants/tenant-a",
  "tenants/tenant-b",
  "tenants/tenant-a/auditLog/entry-1",
  "memberships/user-a_tenant-a",
  "memberships/user-b_tenant-b",
];
const COLLECTIONS = [
  "tenants",
  "tenants/tenant-a/auditLog",
  "memberships",
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initRulesEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const path of DOCS) {
      await setDoc(doc(ctx.firestore(), path), {seeded: true});
    }
  });
});

describe.each(CALLERS)("firestore rules — %s", (caller) => {
  const db = () => contextFor(env, caller).firestore();

  it.each(DOCS)("cannot read %s", async (path) => {
    await assertFails(getDoc(doc(db(), path)));
  });

  it.each(DOCS)("cannot create or overwrite %s", async (path) => {
    await assertFails(setDoc(doc(db(), path), {hacked: true}));
  });

  it.each(DOCS)("cannot update %s", async (path) => {
    await assertFails(updateDoc(doc(db(), path), {hacked: true}));
  });

  it.each(DOCS)("cannot delete %s", async (path) => {
    await assertFails(deleteDoc(doc(db(), path)));
  });

  it.each(COLLECTIONS)("cannot list %s", async (path) => {
    await assertFails(getDocs(collection(db(), path)));
  });

  it.each(COLLECTIONS)("cannot add a document to %s", async (path) => {
    await assertFails(addDoc(collection(db(), path), {hacked: true}));
  });
});
