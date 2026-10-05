import {validateName} from "../structure/domain/validation.js";
import type {Auth, UserRecord} from "firebase-admin/auth";
import type {Firestore} from "firebase-admin/firestore";
import {FirestoreMembershipRepository} from "../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreTenantRepository} from "../tenant/infrastructure/firestore/firestore-tenant-repository.js";
import {DEV_PROJECT_ID, type SeedTarget} from "./seed-lib.js";

// Lowercase letters, digits and hyphens, 3-40 characters. No underscore: the
// membership id is `{uid}_{tenantId}`, so the separator must stay unambiguous.
const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateTenantArgs = {
  target: SeedTarget;
  projectId: string;
  tenantId: string;
  name: string;
  ownerEmail: string;
};

function flagValue(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing ${flag}`);
  }
  return value;
}

// Same guard rails as the seed: the target is mandatory, `prod` does not
// exist, and a dev run is refused if emulator variables would redirect it.
export function parseCreateTenantArgs(
  argv: string[],
  env: Record<string, string | undefined>,
): CreateTenantArgs {
  const index = argv.indexOf("--target");
  const target = index === -1 ? undefined : argv[index + 1];
  if (target === undefined) {
    throw new Error("Missing --target. Use --target emulator or --target dev");
  }

  let projectId: string;
  if (target === "emulator") {
    if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error(
        "--target emulator needs FIRESTORE_EMULATOR_HOST and " +
          "FIREBASE_AUTH_EMULATOR_HOST (run it through firebase emulators:exec)",
      );
    }
    projectId = env.GCLOUD_PROJECT ?? DEV_PROJECT_ID;
  } else if (target === "dev") {
    if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error(
        "--target dev refused: emulator variables are set, so writes would " +
          "go to the emulator, not to dev. Unset them first",
      );
    }
    projectId = DEV_PROJECT_ID;
  } else {
    throw new Error(
      `Unknown target "${target}". Allowed: emulator, dev (never prod)`,
    );
  }

  const tenantId = flagValue(argv, "--tenant-id");
  if (!TENANT_ID.test(tenantId)) {
    throw new Error(
      `Invalid tenant id "${tenantId}": use 3-40 lowercase letters, digits ` +
        "or hyphens, not starting or ending with a hyphen",
    );
  }
  const name = validateName(flagValue(argv, "--name"), "--name");
  const ownerEmail = flagValue(argv, "--owner-email").trim().toLowerCase();
  if (!EMAIL.test(ownerEmail)) {
    throw new Error(`Invalid owner email "${ownerEmail}"`);
  }

  return {target, projectId, tenantId, name, ownerEmail};
}

export type CreateTenantResult = {
  tenantId: string;
  ownerUid: string;
  ownerEmail: string;
  ownerCreated: boolean;
  resetLink: string;
};

type CreateTenantDeps = {
  db: Firestore;
  auth: Auth;
  tenantId: string;
  name: string;
  ownerEmail: string;
  now?: Date;
};

const alreadyExists = (tenantId: string) =>
  new Error(`Tenant "${tenantId}" already exists; nothing was changed`);

async function findOrCreateOwner(
  auth: Auth,
  email: string,
): Promise<{user: UserRecord; created: boolean}> {
  try {
    return {user: await auth.getUserByEmail(email), created: false};
  } catch (error) {
    if ((error as {code?: string}).code !== "auth/user-not-found") {
      throw error;
    }
    return {user: await auth.createUser({email}), created: true};
  }
}

// Everything that can fail on its own (existence check, Auth user, reset link)
// runs before the single Firestore transaction that writes the tenant and the
// owner membership together, so a refused run changes nothing and a failed
// commit leaves at most a reusable Auth user.
export async function runCreateTenant(
  deps: CreateTenantDeps,
): Promise<CreateTenantResult> {
  const {db, auth, tenantId} = deps;
  const now = deps.now ?? new Date();
  const name = validateName(deps.name, "name");
  const email = deps.ownerEmail.trim().toLowerCase();

  if ((await db.doc(`tenants/${tenantId}`).get()).exists) {
    throw alreadyExists(tenantId);
  }

  const {user, created} = await findOrCreateOwner(auth, email);
  const resetLink = await auth.generatePasswordResetLink(email);

  await db.runTransaction(async (tx) => {
    const tenants = new FirestoreTenantRepository(db, tx);
    if (await tenants.get(tenantId)) {
      throw alreadyExists(tenantId);
    }
    await tenants.save({
      id: tenantId,
      name,
      status: "active",
      contact: {},
      createdAt: now,
      updatedAt: now,
    });
    await new FirestoreMembershipRepository(db, tx).save({
      uid: user.uid,
      tenantId,
      role: "owner",
      status: "active",
      scope: {venueIds: [], groupIds: [], playerIds: []},
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    tenantId,
    ownerUid: user.uid,
    ownerEmail: email,
    ownerCreated: created,
    resetLink,
  };
}
