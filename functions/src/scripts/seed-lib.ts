import {ROLES, type Role} from "../membership/domain/role.js";
import type {PlayerDocument} from "../document/domain/document.js";
import {toDocumentDoc} from "../document/infrastructure/firestore/document-mapper.js";
import {FirestoreDocumentRepository} from "../document/infrastructure/firestore/firestore-document-repository.js";
import type {Bucket} from "../document/infrastructure/storage/gcs-file-storage.js";
import {buildSeedDocuments, seedFileBytes} from "./seed-documents.js";
import type {ContactPreference, Guardian} from "../player/domain/guardian.js";
import {documentKey, nameKey} from "../player/domain/normalize.js";
import type {
  PersonDocument,
  Player,
  PlayerStatus,
} from "../player/domain/player.js";
import {toGuardianDoc} from "../player/infrastructure/firestore/guardian-mapper.js";
import {toPlayerDoc} from "../player/infrastructure/firestore/player-mapper.js";
import {FirestoreGuardianRepository} from "../player/infrastructure/firestore/firestore-guardian-repository.js";
import {FirestorePlayerRepository} from "../player/infrastructure/firestore/firestore-player-repository.js";
import {
  type Category,
  type Group,
  type ScheduleSlot,
  type Venue,
} from "../structure/domain/structure.js";
import {type Membership, type Scope} from "../membership/domain/membership.js";
import type {Auth} from "firebase-admin/auth";
import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import {FirestoreMembershipRepository} from "../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreStructureRepository} from "../structure/infrastructure/firestore/firestore-structure-repository.js";
import {
  categoryMapper,
  groupMapper,
  venueMapper,
} from "../structure/infrastructure/firestore/structure-mapper.js";

export const DEV_PROJECT_ID = "escuelas-deportivas-dev";
const EMULATOR_DEFAULT_PASSWORD = "seed-password-1";

export const SEED_TENANTS = [
  {id: "tenant-a", name: "Escuela A (seed)"},
  {id: "tenant-b", name: "Escuela B (seed)"},
] as const;

// Fixed ids so the seed is idempotent and the users' scope can point at them.
export const VENUE_NORTE = "seed-venue-norte";
export const VENUE_SUR = "seed-venue-sur";
const VENUE_B = "seed-venue-b";
export const CATEGORY_SUB10 = "seed-category-sub10";
export const CATEGORY_SUB12 = "seed-category-sub12";
export const GROUP_NORTE_SUB10 = "seed-group-norte-sub10";
export const GROUP_NORTE_SUB12 = "seed-group-norte-sub12";
export const GROUP_SUR_SUB10 = "seed-group-sur-sub10";

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

// Fictitious people only (spec 06): no real data of minors goes into `dev`
// while Q12 is open. Every document number and every address is invented.
export type SeedGuardian = {
  id: string;
  tenantId: string;
  firstNames: string;
  lastNames: string;
  document: PersonDocument;
  phone: string;
  email: string;
  preferredContact: ContactPreference;
};

export type SeedPlayer = {
  id: string;
  tenantId: string;
  groupId: string;
  firstNames: string;
  lastNames: string;
  birthDate: string;
  document: PersonDocument | null;
  status: PlayerStatus;
  statusReason: string | null;
  guardians: {
    guardianId: string;
    relationship: string;
    isPaymentResponsible: boolean;
  }[];
  consentBy: string | null; // the guardian who gave the data consent
};

const guardian = (
  n: number,
  firstNames: string,
  lastNames: string,
  preferredContact: ContactPreference = "whatsapp",
): SeedGuardian => ({
  id: `seed-guardian-${n}`,
  tenantId: "tenant-a",
  firstNames,
  lastNames,
  document: {type: "CC", number: `9000000${String(n).padStart(2, "0")}`},
  phone: `30000000${String(n).padStart(2, "0")}`,
  email: `acudiente.${n}@seed.escuelas.test`,
  preferredContact,
});

export const SEED_GUARDIANS: SeedGuardian[] = [
  guardian(1, "Marta", "Mora"),
  guardian(2, "Jorge", "Ríos", "phone"),
  guardian(3, "Paola", "Pardo"),
  guardian(4, "Andrés", "Castro"),
  guardian(5, "Lucía", "Vega", "email"),
  guardian(6, "Carolina", "León"),
  guardian(7, "Felipe", "Herrera", "phone"),
  guardian(8, "Natalia", "Díaz"),
  guardian(9, "Ricardo", "Vargas", "email"),
  guardian(10, "Diana", "Roa"),
];

const link = (
  n: number,
  relationship: string,
  isPaymentResponsible: boolean,
) => ({
  guardianId: `seed-guardian-${n}`,
  relationship,
  isPaymentResponsible,
});

const player = (
  n: number,
  groupId: string,
  firstNames: string,
  lastNames: string,
  birthDate: string,
  rest: Partial<SeedPlayer> & Pick<SeedPlayer, "status" | "guardians">,
): SeedPlayer => ({
  id: `seed-player-${n}`,
  tenantId: "tenant-a",
  groupId,
  firstNames,
  lastNames,
  birthDate,
  document: {type: "TI", number: `10000000${String(n).padStart(2, "0")}`},
  statusReason: null,
  consentBy: null,
  ...rest,
});

// Three players per group, with every status. Two are siblings (they share a
// guardian) and one has no document yet.
export const SEED_PLAYERS: SeedPlayer[] = [
  player(1, GROUP_NORTE_SUB10, "Santiago", "Ríos Mora", "2016-03-14", {
    status: "activo",
    guardians: [link(1, "madre", true), link(2, "padre", false)],
    consentBy: "seed-guardian-1",
  }),
  player(2, GROUP_NORTE_SUB10, "Valentina", "Ríos Mora", "2015-08-02", {
    status: "activo",
    guardians: [link(1, "madre", true), link(2, "padre", false)],
    consentBy: "seed-guardian-1",
  }),
  player(3, GROUP_NORTE_SUB10, "Mateo", "Gómez Pardo", "2016-11-21", {
    document: null,
    status: "preinscrito",
    guardians: [link(3, "madre", true)],
  }),
  player(4, GROUP_NORTE_SUB12, "Samuel", "Castro Vega", "2014-01-30", {
    status: "activo",
    guardians: [link(4, "padre", true), link(5, "madre", false)],
    consentBy: "seed-guardian-4",
  }),
  player(5, GROUP_NORTE_SUB12, "Isabela", "Torres León", "2013-06-09", {
    status: "pausado",
    statusReason: "Lesión de rodilla",
    guardians: [link(6, "madre", true)],
    consentBy: "seed-guardian-6",
  }),
  player(6, GROUP_NORTE_SUB12, "Daniel", "Herrera Ruiz", "2014-09-17", {
    status: "preinscrito",
    guardians: [link(7, "padre", true)],
  }),
  player(7, GROUP_SUR_SUB10, "Emilia", "Suárez Díaz", "2015-04-25", {
    status: "activo",
    guardians: [link(8, "madre", true)],
    consentBy: "seed-guardian-8",
  }),
  player(8, GROUP_SUR_SUB10, "Tomás", "Vargas Peña", "2016-02-08", {
    status: "retirado",
    statusReason: "Traslado de ciudad",
    guardians: [link(9, "padre", true)],
    consentBy: "seed-guardian-9",
  }),
  player(9, GROUP_SUR_SUB10, "Sofía", "Mejía Roa", "2015-12-19", {
    status: "preinscrito",
    guardians: [link(10, "madre", true)],
  }),
];

// Fixed, so a seeded record is byte-identical on every run.
const SEED_DATE = new Date("2026-01-15T12:00:00Z");

const guardianOf = (id: string): SeedGuardian => {
  const found = SEED_GUARDIANS.find((g) => g.id === id);
  if (!found) throw new Error(`Seed guardian ${id} is not defined`);
  return found;
};

function toGuardian(seed: SeedGuardian, now: Date): Guardian {
  return {
    ...seed,
    documentKey: documentKey(seed.document),
    createdAt: now,
    updatedAt: now,
  };
}

function toPlayer(seed: SeedPlayer, ownerUid: string, now: Date): Player {
  const group = SEED_GROUPS.find((g) => g.id === seed.groupId);
  if (!group) throw new Error(`Seed group ${seed.groupId} is not defined`);
  // Same key order the mapper reads back, so the idempotency check (which
  // compares serialized documents) sees an untouched player as unchanged.
  const links = seed.guardians.map((l) => {
    const g = guardianOf(l.guardianId);
    return {
      guardianId: l.guardianId,
      fullName: `${g.firstNames} ${g.lastNames}`,
      relationship: l.relationship,
      isPaymentResponsible: l.isPaymentResponsible,
    };
  });
  const contact = guardianOf(seed.guardians[0].guardianId);
  return {
    id: seed.id,
    tenantId: seed.tenantId,
    firstNames: seed.firstNames,
    lastNames: seed.lastNames,
    nameKey: nameKey(seed.firstNames, seed.lastNames),
    document: seed.document,
    documentKey: seed.document ? documentKey(seed.document) : null,
    birthDate: seed.birthDate,
    groupId: group.id,
    venueId: group.venueId,
    categoryId: group.categoryId,
    status: seed.status,
    statusReason: seed.statusReason,
    joinedAt: SEED_DATE,
    emergencyContact: {
      name: `${contact.firstNames} ${contact.lastNames}`,
      phone: contact.phone,
      relationship: seed.guardians[0].relationship,
    },
    medical: {},
    guardians: links,
    guardianIds: links.map((l) => l.guardianId),
    dataConsent: seed.consentBy
      ? {guardianId: seed.consentBy, recordedBy: ownerUid, at: SEED_DATE}
      : null,
    createdAt: now,
    updatedAt: now,
  };
}

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
    env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST,
  );

  if (target === "emulator") {
    if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error(
        "--target emulator needs FIRESTORE_EMULATOR_HOST and " +
          "FIREBASE_AUTH_EMULATOR_HOST (run it through firebase emulators:exec)",
      );
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
          "go to the emulator, not to dev. Unset them first",
      );
    }
    if (!env.SEED_PASSWORD) {
      throw new Error(
        "--target dev needs SEED_PASSWORD (no default password in a real " +
          "project)",
      );
    }
    return {
      target,
      projectId: DEV_PROJECT_ID,
      password: env.SEED_PASSWORD,
    };
  }

  throw new Error(
    `Unknown target "${target}". Allowed: emulator, dev (never prod)`,
  );
}

type Counts = {created: number; updated: number; unchanged: number};

export type SeedSummary = {
  tenants: number;
  users: number;
  memberships: Counts;
  structure: Counts;
  guardians: Counts;
  players: Counts;
  documents: Counts;
  files: {created: number; unchanged: number};
};

type SeedDeps = {
  db: Firestore;
  auth: Auth;
  bucket: Bucket;
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

type Repo<T> = {
  get(tenantId: string, id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
};

// The fields the seed owns, as a string: everything but the timestamps.
const baseline = <T>(toDoc: (entity: T) => DocumentData, entity: T) => {
  const fields = toDoc(entity); // a fresh object, safe to trim
  delete fields.createdAt;
  delete fields.updatedAt;
  return JSON.stringify(fields);
};

// Creates missing documents, restores drifted ones and leaves untouched ones
// alone (timestamps included), always as the seed defines them.
async function syncDocuments<T extends Stored>(
  repo: Repo<T>,
  toDoc: (entity: T) => DocumentData,
  desired: T[],
  counts: Counts,
): Promise<void> {
  for (const item of desired) {
    const existing = await repo.get(item.tenantId, item.id);
    if (existing && baseline(toDoc, existing) === baseline(toDoc, item)) {
      counts.unchanged++;
      continue;
    }
    const createdAt = existing?.createdAt ?? item.createdAt;
    await repo.save({...item, createdAt});
    if (existing) counts.updated++;
    else counts.created++;
  }
}

type StoredDocument = PlayerDocument & {updatedAt: Date};

// Documents carry no `updatedAt`; `syncDocuments` ignores it anyway.
function documentRepo(repo: FirestoreDocumentRepository): Repo<StoredDocument> {
  return {
    get: async (tenantId, id) => {
      const found = await repo.get(tenantId, id);
      return found && {...found, updatedAt: found.createdAt};
    },
    save: (document) => repo.save(document),
  };
}

// Writes the fictitious file of each seeded document that has one, unless an
// identical object is already there.
async function syncFiles(
  bucket: Bucket,
  seedDocuments: PlayerDocument[],
): Promise<{created: number; unchanged: number}> {
  const counts = {created: 0, unchanged: 0};
  for (const document of seedDocuments) {
    if (!document.file) continue;
    const {path, contentType} = document.file;
    const bytes = seedFileBytes(contentType);
    const file = bucket.file(path);
    if ((await file.exists())[0]) {
      const [metadata] = await file.getMetadata();
      if (
        Number(metadata.size) === bytes.length &&
        metadata.contentType === contentType
      ) {
        counts.unchanged++;
        continue;
      }
    }
    await file.save(bytes, {contentType});
    counts.created++;
  }
  return counts;
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
  await syncDocuments(
    new FirestoreStructureRepository<Venue>(db, "venues", venueMapper),
    venueMapper.toDoc,
    SEED_VENUES.map((v) => ({...v, status: "active" as const, ...stamps})),
    structure,
  );
  await syncDocuments(
    new FirestoreStructureRepository<Category>(
      db,
      "categories",
      categoryMapper,
    ),
    categoryMapper.toDoc,
    SEED_CATEGORIES.map((c) => ({...c, status: "active" as const, ...stamps})),
    structure,
  );
  await syncDocuments(
    new FirestoreStructureRepository<Group>(db, "groups", groupMapper),
    groupMapper.toDoc,
    SEED_GROUPS.map((g) => ({...g, status: "active" as const, ...stamps})),
    structure,
  );

  const ownerUid = SEED_USERS.find(
    (u) => u.tenantId === "tenant-a" && u.role === "owner",
  )!.uid;
  const guardians = {created: 0, updated: 0, unchanged: 0};
  await syncDocuments(
    new FirestoreGuardianRepository(db),
    toGuardianDoc,
    SEED_GUARDIANS.map((g) => toGuardian(g, now)),
    guardians,
  );
  const players = {created: 0, updated: 0, unchanged: 0};
  await syncDocuments(
    new FirestorePlayerRepository(db),
    toPlayerDoc,
    SEED_PLAYERS.map((p) => toPlayer(p, ownerUid, now)),
    players,
  );

  const documents = {created: 0, updated: 0, unchanged: 0};
  const seedDocuments = buildSeedDocuments(now, ownerUid);
  await syncDocuments(
    documentRepo(new FirestoreDocumentRepository(db)),
    toDocumentDoc,
    seedDocuments.map((d) => ({...d, updatedAt: d.createdAt})),
    documents,
  );
  const files = await syncFiles(deps.bucket, seedDocuments);

  const memberships = {created: 0, updated: 0, unchanged: 0};
  for (const user of SEED_USERS) {
    const existing = await repo.get(user.uid, user.tenantId);
    const scope = user.scope;
    if (
      existing &&
      existing.role === user.role &&
      existing.status === "active" &&
      sameScope(existing.scope, scope)
    ) {
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
    guardians,
    players,
    documents,
    files,
  };
}
