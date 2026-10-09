import {ROLES} from "../../../src/membership/domain/role.js";
import {validateSchedule} from "../../../src/structure/domain/validation.js";
import {getAuth} from "firebase-admin/auth";
import {getStorage} from "firebase-admin/storage";
import {beforeEach, describe, expect, it} from "vitest";
import {
  parseSeedArgs,
  runSeed,
  SEED_CATEGORIES,
  SEED_GROUPS,
  SEED_GUARDIANS,
  SEED_PLAYERS,
  SEED_TENANTS,
  SEED_USERS,
  SEED_VENUES,
} from "../../../src/scripts/seed-lib.js";
import {buildSeedDocuments} from "../../../src/scripts/seed-documents.js";
import {documentKey, nameKey} from "../../../src/player/domain/normalize.js";
import {listPlayers} from "../../../src/player/infrastructure/firestore/player-list-query.js";
import {FirestorePlayerRepository} from "../../../src/player/infrastructure/firestore/firestore-player-repository.js";
import {clearAuth} from "../../../src/shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  testApp,
  testDb,
} from "../../../src/shared/infrastructure/testing/helpers.js";

const db = testDb();
const auth = getAuth(testApp());
const bucket = getStorage(testApp()).bucket(
  "demo-escuelas-integration.appspot.com",
);
const PASSWORD = "test-password-1";
const SEED_DOCUMENTS = buildSeedDocuments(new Date(), "owner");
const SEED_FILES = SEED_DOCUMENTS.filter((d) => d.file).length;

const snapshot = async () => {
  const collections = [
    "tenants",
    "memberships",
    ...SEED_TENANTS.flatMap((t) => [
      `tenants/${t.id}/venues`,
      `tenants/${t.id}/categories`,
      `tenants/${t.id}/groups`,
      `tenants/${t.id}/guardians`,
      `tenants/${t.id}/players`,
      `tenants/${t.id}/documents`,
    ]),
  ];
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
  await bucket.deleteFiles({prefix: "tenants/", force: true});
});

describe("seed data definition", () => {
  it("has one user per role in tenant-a and an owner in tenant-b", () => {
    const inA = SEED_USERS.filter((u) => u.tenantId === "tenant-a");
    expect(inA.map((u) => u.role).sort()).toEqual([...ROLES].sort());
    const inB = SEED_USERS.filter((u) => u.tenantId === "tenant-b");
    expect(inB.map((u) => u.role)).toEqual(["owner"]);
    expect(SEED_TENANTS.map((t) => t.id)).toEqual(["tenant-a", "tenant-b"]);
  });

  it(
    "defines 2 venues, 2 categories and 3 groups in tenant-a, 1 venue " +
      "in tenant-b",
    () => {
      const count = (items: {tenantId: string}[], tenantId: string) =>
        items.filter((i) => i.tenantId === tenantId).length;
      expect(count(SEED_VENUES, "tenant-a")).toBe(2);
      expect(count(SEED_VENUES, "tenant-b")).toBe(1);
      expect(count(SEED_CATEGORIES, "tenant-a")).toBe(2);
      expect(count(SEED_GROUPS, "tenant-a")).toBe(3);
    },
  );

  it("keeps the structure references consistent and the data valid", () => {
    for (const group of SEED_GROUPS) {
      expect(
        SEED_VENUES.some(
          (v) => v.id === group.venueId && v.tenantId === group.tenantId,
        ),
      ).toBe(true);
      expect(
        SEED_CATEGORIES.some(
          (c) => c.id === group.categoryId && c.tenantId === group.tenantId,
        ),
      ).toBe(true);
      expect(() => validateSchedule(group.schedule)).not.toThrow();
    }
    const names = SEED_GROUPS.map((g) => `${g.venueId}/${g.name}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it("points the coordinator and teacher scope at seeded structure", () => {
    const find = (role: string) =>
      SEED_USERS.find((u) => u.tenantId === "tenant-a" && u.role === role)!;
    const coordinator = find("coordinator");
    const teacher = find("teacher");
    expect(coordinator.scope.venueIds).toHaveLength(1);
    expect(teacher.scope.groupIds).toHaveLength(1);
    expect(SEED_VENUES.map((v) => v.id)).toContain(
      coordinator.scope.venueIds[0],
    );
    expect(SEED_GROUPS.map((g) => g.id)).toContain(teacher.scope.groupIds[0]);
    const others = SEED_USERS.filter((u) => u !== coordinator && u !== teacher);
    for (const user of others) {
      expect(user.scope).toEqual({venueIds: [], groupIds: [], playerIds: []});
    }
  });

  it("uses unique uids and emails", () => {
    expect(new Set(SEED_USERS.map((u) => u.uid)).size).toBe(SEED_USERS.length);
    expect(new Set(SEED_USERS.map((u) => u.email)).size).toBe(
      SEED_USERS.length,
    );
  });
});

describe("runSeed", () => {
  it("creates tenants, auth users and active memberships", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});

    const tenants = await db.collection("tenants").get();
    expect(tenants.docs.map((d) => d.id).sort()).toEqual([
      "tenant-a",
      "tenant-b",
    ]);

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
        scope: user.scope,
      });
      expect((await auth.getUser(user.uid)).email).toBe(user.email);
    }
  });

  it("writes the structure with the expected fields", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});

    for (const venue of SEED_VENUES) {
      const data = (
        await db.doc(`tenants/${venue.tenantId}/venues/${venue.id}`).get()
      ).data()!;
      expect(data).toMatchObject({
        name: venue.name,
        address: venue.address,
        status: "active",
      });
      expect(data.createdAt).toBeDefined();
    }
    for (const category of SEED_CATEGORIES) {
      expect(
        (
          await db
            .doc(`tenants/${category.tenantId}/categories/${category.id}`)
            .get()
        ).data(),
      ).toMatchObject({
        name: category.name,
        birthYears: category.birthYears,
        status: "active",
      });
    }
    for (const group of SEED_GROUPS) {
      expect(
        (
          await db.doc(`tenants/${group.tenantId}/groups/${group.id}`).get()
        ).data(),
      ).toMatchObject({
        venueId: group.venueId,
        categoryId: group.categoryId,
        name: group.name,
        schedule: group.schedule,
        status: "active",
      });
    }
    expect((await db.collection("tenants/tenant-a/venues").get()).size).toBe(2);
    expect((await db.collection("tenants/tenant-b/venues").get()).size).toBe(1);
  });

  it("lets a seeded user sign in with the given password", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
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

  it("is idempotent: a second run changes nothing and adds nothing", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const before = await snapshot();
    const usersBefore = (await auth.listUsers()).users.length;

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(await snapshot()).toEqual(before);
    expect((await auth.listUsers()).users.length).toBe(usersBefore);
    expect(usersBefore).toBe(SEED_USERS.length);
    expect(summary.memberships).toEqual({
      created: 0,
      updated: 0,
      unchanged: SEED_USERS.length,
    });
    expect(summary.structure).toEqual({
      created: 0,
      updated: 0,
      unchanged:
        SEED_VENUES.length + SEED_CATEGORIES.length + SEED_GROUPS.length,
    });
    expect(summary.guardians).toEqual({
      created: 0,
      updated: 0,
      unchanged: SEED_GUARDIANS.length,
    });
    expect(summary.players).toEqual({
      created: 0,
      updated: 0,
      unchanged: SEED_PLAYERS.length,
    });
    expect(summary.documents).toEqual({
      created: 0,
      updated: 0,
      unchanged: SEED_DOCUMENTS.length,
    });
    expect(summary.files).toEqual({created: 0, unchanged: SEED_FILES});
  });

  it("restores a closed or renamed structure document to the baseline", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const venue = SEED_VENUES[0];
    const group = SEED_GROUPS[0];
    await db
      .doc(`tenants/${venue.tenantId}/venues/${venue.id}`)
      .update({status: "closed"});
    await db
      .doc(`tenants/${group.tenantId}/groups/${group.id}`)
      .update({name: "Renombrado"});

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(summary.structure.updated).toBe(2);
    expect(
      (
        await db.doc(`tenants/${venue.tenantId}/venues/${venue.id}`).get()
      ).data()?.status,
    ).toBe("active");
    expect(
      (
        await db.doc(`tenants/${group.tenantId}/groups/${group.id}`).get()
      ).data()?.name,
    ).toBe(group.name);
  });

  it("restores a drifted coordinator scope", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const coordinator = SEED_USERS.find(
      (u) => u.tenantId === "tenant-a" && u.role === "coordinator",
    )!;
    await db
      .doc(`memberships/${coordinator.uid}_tenant-a`)
      .update({"scope.venueIds": []});

    await runSeed({db, auth, bucket, password: PASSWORD});

    expect(
      (await db.doc(`memberships/${coordinator.uid}_tenant-a`).get()).data()
        ?.scope.venueIds,
    ).toEqual(coordinator.scope.venueIds);
  });

  it("restores a drifted membership back to the seed baseline", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const coordinator = SEED_USERS.find(
      (u) => u.tenantId === "tenant-a" && u.role === "coordinator",
    )!;
    await db
      .doc(`memberships/${coordinator.uid}_tenant-a`)
      .update({role: "teacher"});

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(summary.memberships.updated).toBe(1);
    expect(
      (await db.doc(`memberships/${coordinator.uid}_tenant-a`).get()).data()
        ?.role,
    ).toBe("coordinator");
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
    "rejects target %j",
    (target) => {
      expect(() => parseSeedArgs(["--target", target], emulatorEnv)).toThrow(
        /emulator|dev/,
      );
    },
  );

  it("accepts the emulator target with emulator hosts and a default password", () => {
    const args = parseSeedArgs(["--target", "emulator"], emulatorEnv);
    expect(args.target).toBe("emulator");
    expect(args.password.length).toBeGreaterThanOrEqual(6);
  });

  it("refuses the emulator target when the emulators are not configured", () => {
    expect(() => parseSeedArgs(["--target", "emulator"], {})).toThrow(
      /EMULATOR_HOST/,
    );
  });

  it("requires SEED_PASSWORD for dev", () => {
    expect(() => parseSeedArgs(["--target", "dev"], {})).toThrow(
      /SEED_PASSWORD/,
    );
  });

  it("targets the dev project when SEED_PASSWORD is given", () => {
    const args = parseSeedArgs(["--target", "dev"], {
      SEED_PASSWORD: "a-strong-pass",
    });
    expect(args).toMatchObject({
      target: "dev",
      projectId: "escuelas-deportivas-dev",
      password: "a-strong-pass",
    });
  });

  it("refuses dev when emulator variables are set (would hit the emulator)", () => {
    expect(() =>
      parseSeedArgs(["--target", "dev"], {
        ...emulatorEnv,
        SEED_PASSWORD: "a-strong-pass",
      }),
    ).toThrow(/emulator/i);
  });
});

describe("seed players and guardians — definition", () => {
  it("defines the players and the guardians they need, all in tenant-a", () => {
    expect(SEED_PLAYERS).toHaveLength(9);
    expect(SEED_GUARDIANS.length).toBeGreaterThanOrEqual(6);
    for (const item of [...SEED_PLAYERS, ...SEED_GUARDIANS]) {
      expect(item.tenantId).toBe("tenant-a");
    }
  });

  it("puts each player in a seeded group, in the age range of its category", () => {
    for (const player of SEED_PLAYERS) {
      const group = SEED_GROUPS.find((g) => g.id === player.groupId)!;
      expect(group).toBeDefined();
      const category = SEED_CATEGORIES.find((c) => c.id === group.categoryId)!;
      const year = Number(player.birthDate.slice(0, 4));
      expect(category.birthYears).toContain(year);
    }
  });

  it("covers every group and every status", () => {
    for (const group of SEED_GROUPS) {
      expect(SEED_PLAYERS.some((p) => p.groupId === group.id)).toBe(true);
    }
    expect(new Set(SEED_PLAYERS.map((p) => p.status))).toEqual(
      new Set(["preinscrito", "activo", "pausado", "retirado"]),
    );
  });

  it("links only seeded guardians, once each, with at most one responsible", () => {
    const known = new Set(SEED_GUARDIANS.map((g) => g.id));
    for (const player of SEED_PLAYERS) {
      const ids = player.guardians.map((g) => g.guardianId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(known.has(id)).toBe(true);
      expect(
        player.guardians.filter((g) => g.isPaymentResponsible).length,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("lets a guardian have several players (siblings)", () => {
    const counts = new Map<string, number>();
    for (const player of SEED_PLAYERS) {
      for (const link of player.guardians) {
        counts.set(link.guardianId, (counts.get(link.guardianId) ?? 0) + 1);
      }
    }
    expect(Math.max(...counts.values())).toBeGreaterThan(1);
  });

  it("makes every active player ready: one responsible and a consent from a linked guardian", () => {
    for (const player of SEED_PLAYERS.filter((p) => p.status === "activo")) {
      expect(
        player.guardians.filter((g) => g.isPaymentResponsible),
      ).toHaveLength(1);
      expect(player.guardians.map((g) => g.guardianId)).toContain(
        player.consentBy,
      );
    }
  });

  it("gives a reason to every paused or withdrawn player", () => {
    for (const player of SEED_PLAYERS) {
      if (player.status === "pausado" || player.status === "retirado") {
        expect(player.statusReason).toBeTruthy();
      }
    }
  });

  it("uses unique ids and unique fictitious documents", () => {
    for (const items of [SEED_PLAYERS, SEED_GUARDIANS]) {
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    }
    const keys = [
      ...SEED_PLAYERS.flatMap((p) =>
        p.document ? [documentKey(p.document)] : [],
      ),
      ...SEED_GUARDIANS.map((g) => documentKey(g.document)),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only fictitious contact data", () => {
    for (const guardian of SEED_GUARDIANS) {
      expect(guardian.email).toMatch(/@seed\.escuelas\.test$/);
    }
  });
});

describe("runSeed — players and guardians", () => {
  const playerPath = (id: string) => `tenants/tenant-a/players/${id}`;
  const guardianPath = (id: string) => `tenants/tenant-a/guardians/${id}`;

  it("creates the guardians and the players with their derived fields", async () => {
    const summary = await runSeed({db, auth, bucket, password: PASSWORD});
    expect(summary.guardians.created).toBe(SEED_GUARDIANS.length);
    expect(summary.players.created).toBe(SEED_PLAYERS.length);

    const repo = new FirestorePlayerRepository(db);
    for (const seeded of SEED_PLAYERS) {
      const group = SEED_GROUPS.find((g) => g.id === seeded.groupId)!;
      const stored = (await repo.get("tenant-a", seeded.id))!;
      expect(stored).toMatchObject({
        firstNames: seeded.firstNames,
        lastNames: seeded.lastNames,
        nameKey: nameKey(seeded.firstNames, seeded.lastNames),
        birthDate: seeded.birthDate,
        groupId: group.id,
        venueId: group.venueId,
        categoryId: group.categoryId,
        status: seeded.status,
        guardianIds: seeded.guardians.map((g) => g.guardianId),
      });
      expect(stored.guardians.every((g) => g.fullName.length > 0)).toBe(true);
      expect(stored.dataConsent === null).toBe(seeded.consentBy === null);
    }
  });

  it("does not seed players or guardians in tenant-b", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    expect((await db.collection("tenants/tenant-b/players").get()).size).toBe(
      0,
    );
    expect((await db.collection("tenants/tenant-b/guardians").get()).size).toBe(
      0,
    );
  });

  it("gives the seeded players to the real list query", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const owner = SEED_USERS.find(
      (u) => u.tenantId === "tenant-a" && u.role === "owner",
    )!;
    const {players, nextCursor} = await listPlayers(
      db,
      "tenant-a",
      {
        uid: owner.uid,
        tenantId: "tenant-a",
        role: "owner",
        status: "active",
        scope: owner.scope,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {limit: 100},
    );
    expect(players).toHaveLength(SEED_PLAYERS.length);
    expect(nextCursor).toBeNull();
  });

  it("restores a drifted player to the seed baseline", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const seeded = SEED_PLAYERS.find((p) => p.status === "activo")!;
    await db.doc(playerPath(seeded.id)).update({status: "retirado"});

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(summary.players.updated).toBe(1);
    expect((await db.doc(playerPath(seeded.id)).get()).data()?.status).toBe(
      "activo",
    );
  });

  it("restores a drifted guardian", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const guardian = SEED_GUARDIANS[0];
    await db.doc(guardianPath(guardian.id)).update({firstNames: "Cambiado"});

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(summary.guardians.updated).toBe(1);
    expect(
      (await db.doc(guardianPath(guardian.id)).get()).data()?.firstNames,
    ).toBe(guardian.firstNames);
  });

  it("keeps the created timestamp of a restored player", async () => {
    await runSeed({
      db,
      auth,
      bucket,
      password: PASSWORD,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const seeded = SEED_PLAYERS[0];
    const before = (await db.doc(playerPath(seeded.id)).get()).data()!
      .createdAt;
    await db.doc(playerPath(seeded.id)).update({status: "pausado"});

    await runSeed({
      db,
      auth,
      bucket,
      password: PASSWORD,
      now: new Date("2026-06-01T00:00:00Z"),
    });

    const after = (await db.doc(playerPath(seeded.id)).get()).data()!;
    expect(after.createdAt.isEqual(before)).toBe(true);
  });
});

describe("seeded documents and files", () => {
  const documentPath = (id: string) => `tenants/tenant-a/documents/${id}`;

  it("creates the documents and a file for each one that has one", async () => {
    const summary = await runSeed({db, auth, bucket, password: PASSWORD});
    expect(summary.documents).toEqual({
      created: SEED_DOCUMENTS.length,
      updated: 0,
      unchanged: 0,
    });
    expect(summary.files).toEqual({created: SEED_FILES, unchanged: 0});
    for (const document of SEED_DOCUMENTS) {
      expect((await db.doc(documentPath(document.id)).get()).exists).toBe(true);
      if (!document.file) continue;
      const [exists] = await bucket.file(document.file.path).exists();
      expect(exists).toBe(true);
      const [metadata] = await bucket.file(document.file.path).getMetadata();
      expect(Number(metadata.size)).toBe(document.file.size);
      expect(metadata.contentType).toBe(document.file.contentType);
    }
  });

  it("restores a drifted document and a missing file", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const withFile = SEED_DOCUMENTS.find((d) => d.file)!;
    await db
      .doc(documentPath("seed-doc-p1-policy"))
      .update({status: "superseded"});
    await bucket.file(withFile.file!.path).delete();

    const summary = await runSeed({db, auth, bucket, password: PASSWORD});

    expect(summary.documents.updated).toBe(1);
    expect(summary.files.created).toBe(1);
    expect(
      (await db.doc(documentPath("seed-doc-p1-policy")).get()).data()?.status,
    ).toBe("current");
    expect((await bucket.file(withFile.file!.path).exists())[0]).toBe(true);
  });

  it("keeps the created timestamp of a restored document", async () => {
    await runSeed({db, auth, bucket, password: PASSWORD});
    const before = (
      await db.doc(documentPath("seed-doc-p2-policy")).get()
    ).data()!.createdAt;
    await db.doc(documentPath("seed-doc-p2-policy")).update({type: "photo"});
    await runSeed({db, auth, bucket, password: PASSWORD});
    const after = (
      await db.doc(documentPath("seed-doc-p2-policy")).get()
    ).data()!;
    expect(after.createdAt.isEqual(before)).toBe(true);
    expect(after.type).toBe("policy");
  });
});
