import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {ChangePlayerPlacement} from "../../application/change-player-placement.js";
import {ChangePlayerStatus} from "../../application/change-player-status.js";
import {EnrollPlayer} from "../../application/enroll-player.js";
import {RecordDataConsent} from "../../application/record-data-consent.js";
import {SetPlayerGuardians} from "../../application/set-player-guardians.js";
import {UpdateGuardian} from "../../application/update-guardian.js";
import {
  buildGroup,
  buildGuardian,
  buildMember,
  buildPlayer,
} from "../../application/testing/fixtures.js";
import {FakeClock} from "../../../shared/application/testing/fake-clock.js";
import {FirestoreMembershipRepository} from "../../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreStructureRepository} from "../../../structure/infrastructure/firestore/firestore-structure-repository.js";
import {FirestoreUnitOfWork} from "../../../shared/infrastructure/firestore-unit-of-work.js";
import {groupMapper} from "../../../structure/infrastructure/firestore/structure-mapper.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";
import {FirestoreGuardianRepository} from "./firestore-guardian-repository.js";
import {FirestorePlayerHistoryWriter} from "./firestore-player-history-writer.js";
import {FirestorePlayerRepository} from "./firestore-player-repository.js";

const db = testDb();
const NOW = new Date("2026-10-05T12:00:00Z");

const players = new FirestorePlayerRepository(db);
const guardians = new FirestoreGuardianRepository(db);

beforeEach(clearFirestore);

describe("FirestorePlayerRepository", () => {
  it("returns null for a missing player", async () => {
    expect(await players.get("tenant-a", "nope")).toBeNull();
  });

  it("round-trips a full player stored at tenants/{tenantId}/players/{id}", async () => {
    const player = buildPlayer({
      document: {type: "TI", number: "123"},
      documentKey: "TI:123",
      medical: {bloodType: "O+", allergies: "penicilina"},
      status: "activo",
      statusReason: "ok",
      guardians: [
        {
          guardianId: "guardian-1",
          fullName: "Ana Perez",
          relationship: "madre",
          isPaymentResponsible: true,
        },
      ],
      guardianIds: ["guardian-1"],
      dataConsent: {guardianId: "guardian-1", recordedBy: "staff-1", at: NOW},
    });
    await players.save(player);
    expect(await players.get("tenant-a", "player-1")).toEqual(player);

    const raw = (
      await db.doc("tenants/tenant-a/players/player-1").get()
    ).data()!;
    expect(raw.joinedAt).toBeInstanceOf(Timestamp);
    expect(raw.dataConsent.at).toBeInstanceOf(Timestamp);
    expect(raw).not.toHaveProperty("id");
    expect(raw).not.toHaveProperty("tenantId");
  });

  it("round-trips a player with null document and consent", async () => {
    await players.save(buildPlayer());
    const read = await players.get("tenant-a", "player-1");
    expect(read).toMatchObject({
      document: null,
      documentKey: null,
      dataConsent: null,
      medical: {},
    });
  });

  it("drops undefined medical fields instead of failing", async () => {
    await players.save(
      buildPlayer({medical: {bloodType: undefined, notes: "asma"}}),
    );
    expect((await players.get("tenant-a", "player-1"))!.medical).toEqual({
      notes: "asma",
    });
  });

  it("isolates tenants", async () => {
    await players.save(buildPlayer());
    expect(await players.get("tenant-b", "player-1")).toBeNull();
  });

  it("generates distinct ids", () => {
    expect(players.newId()).not.toBe(players.newId());
  });

  it("finds by document key within the tenant", async () => {
    await players.save(buildPlayer({documentKey: "TI:123"}));
    await players.save(
      buildPlayer({
        id: "player-b",
        tenantId: "tenant-b",
        documentKey: "TI:123",
      }),
    );
    expect((await players.findByDocumentKey("tenant-a", "TI:123"))!.id).toBe(
      "player-1",
    );
    expect(await players.findByDocumentKey("tenant-a", "TI:999")).toBeNull();
  });

  it("finds by name key and birth date", async () => {
    await players.save(buildPlayer());
    await players.save(buildPlayer({id: "player-2"}));
    await players.save(buildPlayer({id: "player-3", birthDate: "2013-01-01"}));
    await players.save(buildPlayer({id: "player-4", tenantId: "tenant-b"}));
    const found = await players.findByNameAndBirthDate(
      "tenant-a",
      "perez juan",
      "2014-05-01",
    );
    expect(found.map((p) => p.id).sort()).toEqual(["player-1", "player-2"]);
  });

  it("lists the players of a guardian", async () => {
    await players.save(buildPlayer({guardianIds: ["g1", "g2"]}));
    await players.save(buildPlayer({id: "player-2", guardianIds: ["g2"]}));
    await players.save(buildPlayer({id: "player-3", guardianIds: []}));
    const linked = await players.listByGuardian("tenant-a", "g2");
    expect(linked.map((p) => p.id).sort()).toEqual(["player-1", "player-2"]);
  });
});

describe("FirestoreGuardianRepository", () => {
  it("round-trips a guardian stored at tenants/{tenantId}/guardians/{id}", async () => {
    await guardians.save(buildGuardian({email: "ana@example.com"}));
    expect(await guardians.get("tenant-a", "guardian-1")).toEqual(
      buildGuardian({email: "ana@example.com"}),
    );
    const raw = (
      await db.doc("tenants/tenant-a/guardians/guardian-1").get()
    ).data()!;
    expect(raw.createdAt).toBeInstanceOf(Timestamp);
  });

  it("round-trips a missing email as null", async () => {
    await guardians.save(buildGuardian());
    expect((await guardians.get("tenant-a", "guardian-1"))!.email).toBeNull();
  });

  it("returns null for a missing guardian and isolates tenants", async () => {
    expect(await guardians.get("tenant-a", "nope")).toBeNull();
    await guardians.save(buildGuardian());
    expect(await guardians.get("tenant-b", "guardian-1")).toBeNull();
  });

  it("finds by document key within the tenant", async () => {
    await guardians.save(buildGuardian());
    expect(
      (await guardians.findByDocumentKey("tenant-a", "CC:1020304"))!.id,
    ).toBe("guardian-1");
    expect(
      await guardians.findByDocumentKey("tenant-b", "CC:1020304"),
    ).toBeNull();
  });
});

describe("FirestorePlayerHistoryWriter", () => {
  const writer = new FirestorePlayerHistoryWriter(db);
  const historyOf = (playerId: string) =>
    db.collection(`tenants/tenant-a/players/${playerId}/history`);

  it("creates entries under players/{id}/history with server time", async () => {
    await writer.append("tenant-a", "player-1", {
      type: "status",
      before: {status: "preinscrito"},
      after: {status: "activo"},
      reason: null,
      actorUid: "staff-1",
    });
    await writer.append("tenant-a", "player-1", {
      type: "status",
      before: {status: "activo"},
      after: {status: "pausado"},
      reason: "lesión",
      actorUid: "staff-1",
    });
    const docs = (await historyOf("player-1").get()).docs;
    expect(docs).toHaveLength(2);
    const data = docs.map((doc) => doc.data());
    expect(data[0].at).toBeInstanceOf(Timestamp);
    expect(data.map((d) => d.after.status).sort()).toEqual([
      "activo",
      "pausado",
    ]);
  });

  it("keeps the history of each player apart", async () => {
    const entry = {
      type: "status" as const,
      before: {},
      after: {status: "activo" as const},
      reason: null,
      actorUid: "staff-1",
    };
    await writer.append("tenant-a", "player-1", entry);
    await writer.append("tenant-a", "player-2", entry);
    expect((await historyOf("player-1").get()).size).toBe(1);
  });

  it("drops undefined fields of a placement state", async () => {
    await writer.append("tenant-a", "player-1", {
      type: "placement",
      before: {groupId: "g1", status: undefined},
      after: {groupId: "g2"},
      reason: null,
      actorUid: "staff-1",
    });
    const [doc] = (await historyOf("player-1").get()).docs;
    expect(doc.data().before).toEqual({groupId: "g1"});
  });
});

describe("FirestoreUnitOfWork with the player repositories", () => {
  const uow = new FirestoreUnitOfWork(db);
  const audit = () => db.collection("tenants/tenant-a/auditLog").get();
  const historyCount = async () =>
    (await db.collection("tenants/tenant-a/players/player-1/history").get())
      .size;

  it("commits players, guardians, history and audit together", async () => {
    await uow.run(async (tx) => {
      await tx.players.save(buildPlayer());
      await tx.guardians.save(buildGuardian());
      await tx.playerHistory.append("tenant-a", "player-1", {
        type: "status",
        before: {},
        after: {status: "preinscrito"},
        reason: null,
        actorUid: "staff-1",
      });
      await tx.auditLog.append({
        tenantId: "tenant-a",
        actorUid: "staff-1",
        actorRole: "owner",
        action: "player.created",
        target: {type: "player", id: "player-1"},
        before: {},
        after: {},
        device: {},
      });
    });
    expect(await players.get("tenant-a", "player-1")).not.toBeNull();
    expect(await guardians.get("tenant-a", "guardian-1")).not.toBeNull();
    expect(await historyCount()).toBe(1);
    expect((await audit()).size).toBe(1);
  });

  it("changes nothing when the work throws", async () => {
    await expect(
      uow.run(async (tx) => {
        await tx.players.save(buildPlayer());
        await tx.guardians.save(buildGuardian());
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await players.get("tenant-a", "player-1")).toBeNull();
    expect(await guardians.get("tenant-a", "guardian-1")).toBeNull();
  });

  it("changes nothing when Firestore rejects the audit write", async () => {
    await expect(
      uow.run(async (tx) => {
        await tx.players.save(buildPlayer());
        await tx.guardians.save(buildGuardian());
        await tx.playerHistory.append("tenant-a", "player-1", {
          type: "status",
          before: {},
          after: {status: "preinscrito"},
          reason: null,
          actorUid: "staff-1",
        });
        await tx.auditLog.append({
          tenantId: "tenant-a",
          actorUid: "staff-1",
          actorRole: "owner",
          action: "player.created",
          target: {type: "player", id: "player-1"},
          before: {role: undefined},
          after: {},
          device: {},
        });
      }),
    ).rejects.toThrow();
    expect(await players.get("tenant-a", "player-1")).toBeNull();
    expect(await guardians.get("tenant-a", "guardian-1")).toBeNull();
    expect(await historyCount()).toBe(0);
  });
});

// The use cases run end to end against the emulator: this proves their reads
// come before their writes, which Firestore transactions require.
describe("player use cases on Firestore", () => {
  const uow = new FirestoreUnitOfWork(db);
  const clock = new FakeClock(NOW);
  const enroll = new EnrollPlayer(uow, clock);
  const setGuardians = new SetPlayerGuardians(uow, clock);
  const consent = new RecordDataConsent(uow, clock);
  const status = new ChangePlayerStatus(uow, clock);
  const placement = new ChangePlayerPlacement(uow, clock);
  const updateGuardian = new UpdateGuardian(uow, clock);

  const newGuardian = {
    firstNames: "Ana",
    lastNames: "Gómez",
    document: {type: "CC" as const, number: "1.020.304"},
    phone: "3001112233",
    preferredContact: "whatsapp" as const,
  };

  beforeEach(async () => {
    const memberships = new FirestoreMembershipRepository(db);
    await memberships.save(buildMember("owner-1", "owner"));
    await memberships.save(
      buildMember("coord-1", "coordinator", {venueIds: ["venue-1"]}),
    );
    const groups = new FirestoreStructureRepository(db, "groups", groupMapper);
    await groups.save(buildGroup());
    await groups.save(
      buildGroup({id: "group-3", venueId: "venue-1", categoryId: "category-2"}),
    );
  });

  const enrollJuan = () =>
    enroll.execute({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      firstNames: "Juan",
      lastNames: "Pérez",
      document: {type: "TI", number: "123"},
      birthDate: "2014-05-01",
      groupId: "group-1",
      emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
      medical: {allergies: "penicilina"},
      guardians: [
        {
          guardian: newGuardian,
          relationship: "madre",
          isPaymentResponsible: true,
        },
      ],
    });

  it("enrolls a player with a new guardian in one transaction", async () => {
    const result = await enrollJuan();
    const player = await players.get("tenant-a", result.playerId);
    expect(player).toMatchObject({
      status: "preinscrito",
      venueId: "venue-1",
      categoryId: "category-1",
      documentKey: "TI:123",
      guardianIds: result.createdGuardianIds,
    });
    expect(
      await guardians.get("tenant-a", result.createdGuardianIds[0]),
    ).toMatchObject({documentKey: "CC:1020304"});
    expect((await db.collection("tenants/tenant-a/auditLog").get()).size).toBe(
      2,
    );
  });

  it("answers 409 for a repeated document, reading inside the transaction", async () => {
    const first = await enrollJuan();
    await expect(enrollJuan()).rejects.toMatchObject({
      code: "failed_precondition",
      details: {playerId: first.playerId},
    });
  });

  it("creates no guardian when the player cannot be created", async () => {
    await expect(
      enroll.execute({
        tenantId: "tenant-a",
        actorUid: "owner-1",
        firstNames: "Juan",
        lastNames: "Pérez",
        birthDate: "2014-05-01",
        groupId: "missing",
        emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
        guardians: [
          {
            guardian: newGuardian,
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
      }),
    ).rejects.toMatchObject({code: "not_found"});
    expect(
      await guardians.findByDocumentKey("tenant-a", "CC:1020304"),
    ).toBeNull();
  });

  it("runs the whole life of a player", async () => {
    const {playerId, createdGuardianIds} = await enrollJuan();
    const [guardianId] = createdGuardianIds;
    const base = {tenantId: "tenant-a", actorUid: "coord-1", playerId};

    await consent.execute({...base, guardianId});
    await status.execute({...base, status: "activo"});
    await placement.execute({...base, groupId: "group-3", reason: "sube"});
    await status.execute({...base, status: "pausado", reason: "lesión"});
    await status.execute({...base, status: "activo"});
    await setGuardians.execute({
      ...base,
      guardians: [
        {guardianId, relationship: "mamá", isPaymentResponsible: true},
      ],
    });
    await updateGuardian.execute({
      tenantId: "tenant-a",
      actorUid: "coord-1",
      guardianId,
      ...newGuardian,
      firstNames: "Ana María",
    });

    const player = await players.get("tenant-a", playerId);
    expect(player).toMatchObject({
      status: "activo",
      groupId: "group-3",
      categoryId: "category-2",
      dataConsent: {guardianId, recordedBy: "coord-1"},
    });
    expect(player!.guardians[0]).toMatchObject({
      fullName: "Ana María Gómez",
      relationship: "mamá",
    });
    const history = await db
      .collection(`tenants/tenant-a/players/${playerId}/history`)
      .get();
    expect(history.size).toBe(4);
  });
});
