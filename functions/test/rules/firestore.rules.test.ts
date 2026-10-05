import {
  addDoc,
  collection,
  collectionGroup,
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
  "tenants/tenant-a/venues/venue-1",
  "tenants/tenant-a/categories/category-1",
  "tenants/tenant-a/groups/group-1",
  "tenants/tenant-b/venues/venue-2",
  "tenants/tenant-b/categories/category-2",
  "tenants/tenant-b/groups/group-2",
  "tenants/tenant-a/players/player-1",
  "tenants/tenant-a/players/player-1/history/entry-1",
  "tenants/tenant-a/guardians/guardian-1",
  "tenants/tenant-b/players/player-2",
  "tenants/tenant-b/players/player-2/history/entry-2",
  "tenants/tenant-b/guardians/guardian-2",
  "memberships/user-a_tenant-a",
  "memberships/user-b_tenant-b",
];
const COLLECTIONS = [
  "tenants",
  "tenants/tenant-a/auditLog",
  "tenants/tenant-a/venues",
  "tenants/tenant-a/categories",
  "tenants/tenant-a/groups",
  "tenants/tenant-b/venues",
  "tenants/tenant-b/categories",
  "tenants/tenant-b/groups",
  "tenants/tenant-a/players",
  "tenants/tenant-a/players/player-1/history",
  "tenants/tenant-a/guardians",
  "tenants/tenant-b/players",
  "tenants/tenant-b/players/player-2/history",
  "tenants/tenant-b/guardians",
  "memberships",
];

// A collection group query would reach every tenant at once.
const COLLECTION_GROUPS = ["players", "history", "guardians"];

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

  it.each(COLLECTION_GROUPS)(
    "cannot query the collection group %s",
    async (name) => {
      await assertFails(getDocs(collectionGroup(db(), name)));
    },
  );

  it.each(COLLECTIONS)("cannot add a document to %s", async (path) => {
    await assertFails(addDoc(collection(db(), path), {hacked: true}));
  });
});
