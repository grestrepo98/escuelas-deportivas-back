import {ROLES, type Role} from "../membership/domain/role.js";
import {
  type Category,
  type Group,
  type ScheduleSlot,
  type Venue,
} from "../structure/domain/structure.js";
import {
  type Membership,
  type Scope,
} from "../membership/domain/membership.js";
import {
  type StructureRepository,
} from "../structure/application/structure-repository.js";
import type {Auth} from "firebase-admin/auth";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {
  FirestoreMembershipRepository,
} from "../membership/infrastructure/firestore/firestore-membership-repository.js";
import {
  FirestoreStructureRepository,
} from "../structure/infrastructure/firestore/firestore-structure-repository.js";
import {
  categoryMapper,
  groupMapper,
  venueMapper,
  type StructureMapper,
} from "../structure/infrastructure/firestore/structure-mapper.js";

export const DEV_PROJECT_ID = "escuelas-deportivas-dev";
const EMULATOR_DEFAULT_PASSWORD = "seed-password-1";

export const SEED_TENANTS = [
  {id: "tenant-a", name: "Escuela A (seed)"},
  {id: "tenant-b", name: "Escuela B (seed)"},
] as const;

// Fixed ids so the seed is idempotent and the users' scope can point at them.
const VENUE_NORTE = "seed-venue-norte";
const VENUE_SUR = "seed-venue-sur";
const VENUE_B = "seed-venue-b";
const CATEGORY_SUB10 = "seed-category-sub10";
const CATEGORY_SUB12 = "seed-category-sub12";
const GROUP_NORTE_SUB10 = "seed-group-norte-sub10";
const GROUP_NORTE_SUB12 = "seed-group-norte-sub12";
const GROUP_SUR_SUB10 = "seed-group-sur-sub10";

export type SeedVenue = {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  facility: string;
};

export type SeedCategory = {
  id: string;
  tenantId: string;
  name: string;
  birthYears: number[];
};

export type SeedGroup = {
  id: string;
  tenantId: string;
  venueId: string;
  categoryId: string;
  name: string;
  schedule: ScheduleSlot[];
};

export const SEED_VENUES: SeedVenue[] = [
  {
    id: VENUE_NORTE,
    tenantId: "tenant-a",
    name: "Sede Norte",
    address: "Calle 100 # 15-20, Bogotá",
    facility: "Cancha sintética 1",
  },
  {
    id: VENUE_SUR,
    tenantId: "tenant-a",
    name: "Sede Sur",
    address: "Carrera 30 # 5-10, Bogotá",
    facility: "Cancha sintética 2",
  },
  {
    id: VENUE_B,
    tenantId: "tenant-b",
    name: "Sede B",
    address: "Avenida 68 # 40-12, Bogotá",
    facility: "Cancha 1",
  },
];

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: CATEGORY_SUB10,
    tenantId: "tenant-a",
    name: "Sub-10",
    birthYears: [2016, 2015],
  },
  {
    id: CATEGORY_SUB12,
    tenantId: "tenant-a",
    name: "Sub-12",
    birthYears: [2014, 2013],
  },
];

export const SEED_GROUPS: SeedGroup[] = [
  {
    id: GROUP_NORTE_SUB10,
    tenantId: "tenant-a",
    venueId: VENUE_NORTE,
    categoryId: CATEGORY_SUB10,
    name: "Sub-10 Norte",
    schedule: [
      {weekday: 2, start: "16:00", end: "17:30"},
      {weekday: 4, start: "16:00", end: "17:30"},
    ],
  },
  {
    id: GROUP_NORTE_SUB12,
    tenantId: "tenant-a",
    venueId: VENUE_NORTE,
    categoryId: CATEGORY_SUB12,
    name: "Sub-12 Norte",
    schedule: [
      {weekday: 1, start: "17:30", end: "19:00"},
      {weekday: 3, start: "17:30", end: "19:00"},
    ],
  },
  {
    id: GROUP_SUR_SUB10,
    tenantId: "tenant-a",
    venueId: VENUE_SUR,
    categoryId: CATEGORY_SUB10,
    name: "Sub-10 Sur",
    schedule: [
      {weekday: 3, start: "16:00", end: "17:30"},
      {weekday: 5, start: "16:00", end: "17:30"},
    ],
  },
];

export type SeedUser = {
  uid: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: Role;
  scope: Scope;
};

const emptyScope = (): Scope => ({venueIds: [], groupIds: [], playerIds: []});

const seedUser = (
  role: Role,
  tenantId: string,
  suffix: string,
  scope: Scope = emptyScope(),
): SeedUser => ({
  uid: `seed-${role}-${suffix}`,
  // Auth stores emails lowercased, so define them that way.
  email: `${role}.${suffix}@seed.escuelas.test`.toLowerCase(),
  displayName: `Seed ${role} ${suffix.toUpperCase()}`,
  tenantId,
  role,
  scope,
});

// Only the coordinator and the teacher are restricted; the others keep an
// empty scope (which means "no restriction" for owner and accountant).
const scopeFor = (role: Role): Scope => {
  if (role === "coordinator") return {...emptyScope(), venueIds: [VENUE_NORTE]};
  if (role === "teacher") {
    return {...emptyScope(), groupIds: [GROUP_NORTE_SUB10]};
  }
  return emptyScope();
};

// One user per role in tenant-a, plus an owner in tenant-b to prove isolation.
export const SEED_USERS: SeedUser[] = [
  ...ROLES.map((role) => seedUser(role, "tenant-a", "a", scopeFor(role))),
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

type Counts = {created: number; updated: number; unchanged: number};

export type SeedSummary = {
  tenants: number;
  users: number;
  memberships: Counts;
  structure: Counts;
};

type SeedDeps = {
  db: Firestore;
  auth: Auth;
  password: string;
  now?: Date;
};

const sameScope = (a: Membership["scope"], b: Membership["scope"]) =>
  JSON.stringify(a) === JSON.stringify(b);

type Stored = {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
};

// The fields the seed owns, as a string: everything but the timestamps.
const baseline = <T extends Stored>(mapper: StructureMapper<T>, entity: T) => {
  const fields = mapper.toDoc(entity); // a fresh object, safe to trim
  delete fields.createdAt;
  delete fields.updatedAt;
  return JSON.stringify(fields);
};

// Creates missing documents, restores drifted ones and leaves untouched ones
// alone (timestamps included), always as active.
async function syncStructure<T extends Stored>(
  repo: StructureRepository<T>,
  mapper: StructureMapper<T>,
  desired: T[],
  counts: Counts,
): Promise<void> {
  for (const item of desired) {
    const existing = await repo.get(item.tenantId, item.id);
    if (existing && baseline(mapper, existing) === baseline(mapper, item)) {
      counts.unchanged++;
      continue;
    }
    const createdAt = existing?.createdAt ?? item.createdAt;
    await repo.save({...item, createdAt});
    if (existing) counts.updated++;
    else counts.created++;
  }
}

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

  const structure = {created: 0, updated: 0, unchanged: 0};
  const stamps = {createdAt: now, updatedAt: now};
  await syncStructure(
    new FirestoreStructureRepository<Venue>(db, "venues", venueMapper),
    venueMapper,
    SEED_VENUES.map((v) => ({...v, status: "active" as const, ...stamps})),
    structure,
  );
  await syncStructure(
    new FirestoreStructureRepository<Category>(
      db, "categories", categoryMapper),
    categoryMapper,
    SEED_CATEGORIES.map((c) => ({...c, status: "active" as const, ...stamps})),
    structure,
  );
  await syncStructure(
    new FirestoreStructureRepository<Group>(db, "groups", groupMapper),
    groupMapper,
    SEED_GROUPS.map((g) => ({...g, status: "active" as const, ...stamps})),
    structure,
  );

  const memberships = {created: 0, updated: 0, unchanged: 0};
  for (const user of SEED_USERS) {
    const existing = await repo.get(user.uid, user.tenantId);
    const scope = user.scope;
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
    structure,
  };
}
