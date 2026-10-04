import {getAuth} from "firebase-admin/auth";
import {beforeEach, describe, expect, it} from "vitest";
import {
  parseCreateTenantArgs,
  runCreateTenant,
} from "./create-tenant-lib.js";
import {
  clearAuth,
} from "../shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  testApp,
  testDb,
} from "../shared/infrastructure/testing/helpers.js";

const db = testDb();
const auth = getAuth(testApp());
const NOW = new Date("2026-10-03T12:00:00Z");

const input = (overrides = {}) => ({
  db,
  auth,
  tenantId: "escuela-nueva",
  name: "Escuela Nueva",
  ownerEmail: "dueno@escuela-nueva.co",
  now: NOW,
  ...overrides,
});

const emulatorEnv = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
};
const flags = [
  "--tenant-id", "escuela-nueva",
  "--name", "Escuela Nueva",
  "--owner-email", "dueno@escuela-nueva.co",
];

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
});

describe("parseCreateTenantArgs", () => {
  it("accepts the emulator target inside an emulator session", () => {
    expect(parseCreateTenantArgs(
      ["--target", "emulator", ...flags], emulatorEnv,
    )).toMatchObject({
      target: "emulator",
      tenantId: "escuela-nueva",
      name: "Escuela Nueva",
      ownerEmail: "dueno@escuela-nueva.co",
    });
  });

  it("accepts the dev target and points at the dev project", () => {
    expect(parseCreateTenantArgs(["--target", "dev", ...flags], {}))
      .toMatchObject({target: "dev", projectId: "escuelas-deportivas-dev"});
  });

  it("requires --target", () => {
    expect(() => parseCreateTenantArgs(flags, emulatorEnv))
      .toThrow(/--target/);
  });

  it("has no prod target", () => {
    expect(() => parseCreateTenantArgs(["--target", "prod", ...flags], {}))
      .toThrow(/never prod/);
  });

  it("refuses the emulator target outside an emulator session", () => {
    expect(() => parseCreateTenantArgs(["--target", "emulator", ...flags], {}))
      .toThrow(/FIRESTORE_EMULATOR_HOST/);
  });

  it("refuses the dev target when emulator variables are set", () => {
    expect(() => parseCreateTenantArgs(
      ["--target", "dev", ...flags], emulatorEnv,
    )).toThrow(/emulator variables/);
  });

  it.each(["--tenant-id", "--name", "--owner-email"])(
    "requires %s", (flag) => {
      const index = flags.indexOf(flag);
      const without = [...flags.slice(0, index), ...flags.slice(index + 2)];
      expect(() => parseCreateTenantArgs(
        ["--target", "dev", ...without], {},
      )).toThrow(flag);
    });

  it.each(["UPPER", "has space", "under_score", "ab", "-lead", "x".repeat(41)])(
    "rejects the tenant id %j", (tenantId) => {
      const bad = flags.map((f) => f === "escuela-nueva" ? tenantId : f);
      expect(() => parseCreateTenantArgs(["--target", "dev", ...bad], {}))
        .toThrow(/tenant id/i);
    });

  it("rejects a malformed owner email and a blank name", () => {
    const badEmail = flags.map((f) => f.includes("@") ? "not-an-email" : f);
    expect(() => parseCreateTenantArgs(["--target", "dev", ...badEmail], {}))
      .toThrow(/email/i);
    const blank = flags.map((f) => f === "Escuela Nueva" ? "  " : f);
    expect(() => parseCreateTenantArgs(["--target", "dev", ...blank], {}))
      .toThrow(/name/i);
  });
});

describe("runCreateTenant", () => {
  it("creates the tenant, the owner user and an active owner membership",
    async () => {
      const result = await runCreateTenant(input());

      const tenant = (await db.doc("tenants/escuela-nueva").get()).data()!;
      expect(tenant).toMatchObject({
        name: "Escuela Nueva",
        status: "active",
        contact: {},
      });
      expect(tenant.createdAt.toDate()).toEqual(NOW);

      const user = await auth.getUserByEmail("dueno@escuela-nueva.co");
      expect(result).toMatchObject({
        tenantId: "escuela-nueva",
        ownerUid: user.uid,
        ownerCreated: true,
      });

      const membership = (await db
        .doc(`memberships/${user.uid}_escuela-nueva`).get()).data()!;
      expect(membership).toMatchObject({
        uid: user.uid,
        tenantId: "escuela-nueva",
        role: "owner",
        status: "active",
        scope: {venueIds: [], groupIds: [], playerIds: []},
      });
    });

  it("returns a password reset link for the owner", async () => {
    const {resetLink} = await runCreateTenant(input());
    expect(resetLink).toMatch(/^https?:\/\//);
    expect(resetLink).toContain("oobCode");
  });

  it("fails when the tenant exists and changes nothing", async () => {
    await runCreateTenant(input());
    const before = {
      tenants: (await db.collection("tenants").get()).size,
      memberships: (await db.collection("memberships").get()).size,
      users: (await auth.listUsers()).users.length,
      name: (await db.doc("tenants/escuela-nueva").get()).data()!.name,
    };

    await expect(runCreateTenant(input({
      name: "Otro Nombre",
      ownerEmail: "otro@escuela-nueva.co",
    }))).rejects.toThrow(/already exists/);

    expect({
      tenants: (await db.collection("tenants").get()).size,
      memberships: (await db.collection("memberships").get()).size,
      users: (await auth.listUsers()).users.length,
      name: (await db.doc("tenants/escuela-nueva").get()).data()!.name,
    }).toEqual(before);
  });

  it("reuses an existing Auth user for the owner", async () => {
    const existing = await auth.createUser({email: "dueno@escuela-nueva.co"});
    const result = await runCreateTenant(input());
    expect(result.ownerUid).toBe(existing.uid);
    expect(result.ownerCreated).toBe(false);
    expect((await auth.listUsers()).users).toHaveLength(1);
    expect((await db.doc(`memberships/${existing.uid}_escuela-nueva`).get())
      .exists).toBe(true);
  });

  it("keeps the memberships the owner already had in other tenants",
    async () => {
      await runCreateTenant(input({
        tenantId: "escuela-uno",
        name: "Escuela Uno",
      }));
      const {ownerUid} = await runCreateTenant(input());
      const memberships = await db.collection("memberships")
        .where("uid", "==", ownerUid).get();
      expect(memberships.docs.map((d) => d.data().tenantId).sort())
        .toEqual(["escuela-nueva", "escuela-uno"]);
    });

  it("trims the organization name", async () => {
    await runCreateTenant(input({name: "  Escuela Nueva  "}));
    expect((await db.doc("tenants/escuela-nueva").get()).data()!.name)
      .toBe("Escuela Nueva");
  });
});
