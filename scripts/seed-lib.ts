import {ROLES, type Membership, type Role} from "@escuelas/domain";
import type {Auth} from "firebase-admin/auth";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {
  FirestoreMembershipRepository,
} from "../functions/src/adapters/firestore/firestore-membership-repository.js";

export const DEV_PROJECT_ID = "escuelas-deportivas-dev";
const EMULATOR_DEFAULT_PASSWORD = "seed-password-1";

export const SEED_TENANTS = [
  {id: "tenant-a", name: "Escuela A (seed)"},
  {id: "tenant-b", name: "Escuela B (seed)"},
] as const;

export type SeedUser = {
  uid: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: Role;
};

const seedUser = (role: Role, tenantId: string, suffix: string): SeedUser => ({
  uid: `seed-${role}-${suffix}`,
  // Auth stores emails lowercased, so define them that way.
  email: `${role}.${suffix}@seed.escuelas.test`.toLowerCase(),
  displayName: `Seed ${role} ${suffix.toUpperCase()}`,
  tenantId,
  role,
});

// One user per role in tenant-a, plus an owner in tenant-b to prove isolation.
export const SEED_USERS: SeedUser[] = [
  ...ROLES.map((role) => seedUser(role, "tenant-a", "a")),
  seedUser("owner", "tenant-b", "b"),
];

export type SeedTarget = "emulator" | "dev";

export type SeedArgs = {
  target: SeedTarget;
  projectId: string;
  password: string;
};

// The seed never runs against anything implicit: the target is mandatory and
// `prod` does not exist as an option.
export function parseSeedArgs(
  argv: string[],
  env: Record<string, string | undefined>,
): SeedArgs {
  const index = argv.indexOf("--target");
  const target = index === -1 ? undefined : argv[index + 1];
  if (target === undefined) {
    throw new Error("Missing --target. Use --target emulator or --target dev");
  }
  const hasEmulators = Boolean(
    env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);

  if (target === "emulator") {
    if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error(
        "--target emulator needs FIRESTORE_EMULATOR_HOST and " +
        "FIREBASE_AUTH_EMULATOR_HOST (run it through firebase emulators:exec)");
    }
    return {
      target,
      projectId: env.GCLOUD_PROJECT ?? DEV_PROJECT_ID,
      password: env.SEED_PASSWORD ?? EMULATOR_DEFAULT_PASSWORD,
    };
  }

  if (target === "dev") {
    if (hasEmulators) {
      throw new Error(
        "--target dev refused: emulator variables are set, so writes would " +
        "go to the emulator, not to dev. Unset them first");
    }
    if (!env.SEED_PASSWORD) {
      throw new Error(
        "--target dev needs SEED_PASSWORD (no default password in a real " +
        "project)");
    }
    return {
      target,
      projectId: DEV_PROJECT_ID,
      password: env.SEED_PASSWORD,
    };
  }

  throw new Error(
    `Unknown target "${target}". Allowed: emulator, dev (never prod)`);
}

export type SeedSummary = {
  tenants: number;
  users: number;
  memberships: {created: number; updated: number; unchanged: number};
};

type SeedDeps = {
  db: Firestore;
  auth: Auth;
  password: string;
  now?: Date;
};

const sameScope = (a: Membership["scope"], b: Membership["scope"]) =>
  JSON.stringify(a) === JSON.stringify(b);

// Idempotent: fixed uids and ids, and untouched documents are not rewritten,
// so a second run leaves every field (timestamps included) identical.
export async function runSeed(deps: SeedDeps): Promise<SeedSummary> {
  const {db, auth, password} = deps;
  const now = deps.now ?? new Date();
  const repo = new FirestoreMembershipRepository(db);

  for (const tenant of SEED_TENANTS) {
    const ref = db.doc(`tenants/${tenant.id}`);
    if ((await ref.get()).exists) {
      await ref.set({name: tenant.name, status: "active"}, {merge: true});
    } else {
      await ref.set({
        name: tenant.name,
        status: "active",
        createdAt: Timestamp.fromDate(now),
      });
    }
  }

  for (const user of SEED_USERS) {
    const profile = {
      email: user.email,
      displayName: user.displayName,
      password,
    };
    try {
      await auth.getUser(user.uid);
      await auth.updateUser(user.uid, profile);
    } catch (error) {
      if ((error as {code?: string}).code !== "auth/user-not-found") {
        throw error;
      }
      await auth.createUser({uid: user.uid, ...profile});
    }
  }

  const memberships = {created: 0, updated: 0, unchanged: 0};
  for (const user of SEED_USERS) {
    const existing = await repo.get(user.uid, user.tenantId);
    const scope = {venueIds: [], groupIds: [], playerIds: []};
    if (existing && existing.role === user.role &&
        existing.status === "active" && sameScope(existing.scope, scope)) {
      memberships.unchanged++;
      continue;
    }
    await repo.save({
      uid: user.uid,
      tenantId: user.tenantId,
      role: user.role,
      status: "active",
      scope,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (existing) memberships.updated++;
    else memberships.created++;
  }

  return {
    tenants: SEED_TENANTS.length,
    users: SEED_USERS.length,
    memberships,
  };
}
