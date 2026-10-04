import {ROLES} from "@escuelas/domain";
import {getAuth} from "firebase-admin/auth";
import {beforeEach, describe, expect, it} from "vitest";
import {
  parseSeedArgs,
  runSeed,
  SEED_TENANTS,
  SEED_USERS,
} from "../../../scripts/seed-lib.js";
import {clearAuth} from "./emulator-helpers.js";
import {clearFirestore, testApp, testDb} from "./helpers.js";

const db = testDb();
const auth = getAuth(testApp());
const PASSWORD = "test-password-1";

const snapshot = async () => {
  const collections = ["tenants", "memberships"];
  const out: Record<string, unknown> = {};
  for (const name of collections) {
    for (const doc of (await db.collection(name).get()).docs) {
      out[`${name}/${doc.id}`] = doc.data();
    }
  }
  return out;
};

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
});

describe("seed data definition", () => {
  it("has one user per role in tenant-a and an owner in tenant-b", () => {
    const inA = SEED_USERS.filter((u) => u.tenantId === "tenant-a");
    expect(inA.map((u) => u.role).sort()).toEqual([...ROLES].sort());
    const inB = SEED_USERS.filter((u) => u.tenantId === "tenant-b");
    expect(inB.map((u) => u.role)).toEqual(["owner"]);
    expect(SEED_TENANTS.map((t) => t.id)).toEqual(["tenant-a", "tenant-b"]);
  });

  it("uses unique uids and emails", () => {
    expect(new Set(SEED_USERS.map((u) => u.uid)).size).toBe(SEED_USERS.length);
    expect(new Set(SEED_USERS.map((u) => u.email)).size)
      .toBe(SEED_USERS.length);
  });
});

describe("runSeed", () => {
  it("creates tenants, auth users and active memberships", async () => {
    await runSeed({db, auth, password: PASSWORD});

    const tenants = await db.collection("tenants").get();
    expect(tenants.docs.map((d) => d.id).sort())
      .toEqual(["tenant-a", "tenant-b"]);

    const memberships = await db.collection("memberships").get();
    expect(memberships.size).toBe(SEED_USERS.length);
    for (const user of SEED_USERS) {
      const id = `${user.uid}_${user.tenantId}`;
      const doc = await db.doc(`memberships/${id}`).get();
      expect(doc.data()).toMatchObject({
        uid: user.uid,
        tenantId: user.tenantId,
        role: user.role,
        status: "active",
        scope: {venueIds: [], groupIds: [], playerIds: []},
      });
      expect((await auth.getUser(user.uid)).email).toBe(user.email);
    }
  });

  it("lets a seeded user sign in with the given password", async () => {
    await runSeed({db, auth, password: PASSWORD});
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const response = await fetch(
      `http://${host}/identitytoolkit.googleapis.com/v1/` +
      "accounts:signInWithPassword?key=fake",
      {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          email: SEED_USERS[0].email,
          password: PASSWORD,
          returnSecureToken: true,
        }),
      },
    );
    expect(response.ok).toBe(true);
  });

  it("is idempotent: a second run changes nothing and adds nothing",
    async () => {
      await runSeed({db, auth, password: PASSWORD});
      const before = await snapshot();
      const usersBefore = (await auth.listUsers()).users.length;

      const summary = await runSeed({db, auth, password: PASSWORD});

      expect(await snapshot()).toEqual(before);
      expect((await auth.listUsers()).users.length).toBe(usersBefore);
      expect(usersBefore).toBe(SEED_USERS.length);
      expect(summary.memberships).toEqual({
        created: 0,
        updated: 0,
        unchanged: SEED_USERS.length,
      });
    });

  it("restores a drifted membership back to the seed baseline", async () => {
    await runSeed({db, auth, password: PASSWORD});
    const coordinator = SEED_USERS.find(
      (u) => u.tenantId === "tenant-a" && u.role === "coordinator")!;
    await db.doc(`memberships/${coordinator.uid}_tenant-a`)
      .update({role: "teacher"});

    const summary = await runSeed({db, auth, password: PASSWORD});

    expect(summary.memberships.updated).toBe(1);
    expect((await db.doc(`memberships/${coordinator.uid}_tenant-a`).get())
      .data()?.role).toBe("coordinator");
  });
});

describe("parseSeedArgs", () => {
  const emulatorEnv = {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  };

  it("requires an explicit --target", () => {
    expect(() => parseSeedArgs([], {})).toThrow(/--target/);
  });

  it.each(["prod", "production", "staging", ""])(
    "rejects target %j", (target) => {
      expect(() => parseSeedArgs(["--target", target], emulatorEnv))
        .toThrow(/emulator|dev/);
    });

  it("accepts the emulator target with emulator hosts and a default password",
    () => {
      const args = parseSeedArgs(["--target", "emulator"], emulatorEnv);
      expect(args.target).toBe("emulator");
      expect(args.password.length).toBeGreaterThanOrEqual(6);
    });

  it("refuses the emulator target when the emulators are not configured",
    () => {
      expect(() => parseSeedArgs(["--target", "emulator"], {}))
        .toThrow(/EMULATOR_HOST/);
    });

  it("requires SEED_PASSWORD for dev", () => {
    expect(() => parseSeedArgs(["--target", "dev"], {}))
      .toThrow(/SEED_PASSWORD/);
  });

  it("targets the dev project when SEED_PASSWORD is given", () => {
    const args = parseSeedArgs(
      ["--target", "dev"], {SEED_PASSWORD: "a-strong-pass"});
    expect(args).toMatchObject({
      target: "dev",
      projectId: "escuelas-deportivas-dev",
      password: "a-strong-pass",
    });
  });

  it("refuses dev when emulator variables are set (would hit the emulator)",
    () => {
      expect(() => parseSeedArgs(
        ["--target", "dev"],
        {...emulatorEnv, SEED_PASSWORD: "a-strong-pass"},
      )).toThrow(/emulator/i);
    });
});
