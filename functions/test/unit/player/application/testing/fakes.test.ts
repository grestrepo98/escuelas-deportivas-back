import {describe, expect, it} from "vitest";
import {FakeClock} from "../../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../../../../src/shared/application/testing/in-memory-unit-of-work.js";
import {
  buildGuardian,
  buildPlayer,
} from "../../../../../src/player/application/testing/fixtures.js";

const setup = () => {
  const clock = new FakeClock(new Date("2026-10-04T12:00:00Z"));
  const auditLog = new InMemoryAuditLogWriter(clock);
  const uow = new InMemoryUnitOfWork(
    new InMemoryMembershipRepository(),
    auditLog,
  );
  return {clock, auditLog, uow};
};

const historyEntry = {
  type: "status" as const,
  before: {status: "preinscrito" as const},
  after: {status: "activo" as const},
  reason: null,
  actorUid: "staff-1",
};

describe("InMemoryPlayerRepository", () => {
  it("generates distinct ids", () => {
    const {uow} = setup();
    expect(uow.players.newId()).not.toBe(uow.players.newId());
  });

  it("gets by tenant and id, isolating tenants", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer());
    expect(await uow.players.get("tenant-a", "player-1")).toEqual(
      buildPlayer(),
    );
    expect(await uow.players.get("tenant-b", "player-1")).toBeNull();
  });

  it("does not leak mutations through returned objects", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer());
    const read = await uow.players.get("tenant-a", "player-1");
    read!.firstNames = "Otro";
    expect((await uow.players.get("tenant-a", "player-1"))!.firstNames).toBe(
      "Juan",
    );
  });

  it("finds a player by document key within its tenant", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer({documentKey: "TI:123"}));
    expect(
      (await uow.players.findByDocumentKey("tenant-a", "TI:123"))!.id,
    ).toBe("player-1");
    expect(
      await uow.players.findByDocumentKey("tenant-b", "TI:123"),
    ).toBeNull();
    expect(
      await uow.players.findByDocumentKey("tenant-a", "TI:999"),
    ).toBeNull();
  });

  it("finds players with the same name key and birth date", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer());
    await uow.players.save(buildPlayer({id: "player-2"}));
    await uow.players.save(
      buildPlayer({id: "player-3", birthDate: "2013-01-01"}),
    );
    await uow.players.save(buildPlayer({id: "player-4", tenantId: "tenant-b"}));
    const found = await uow.players.findByNameAndBirthDate(
      "tenant-a",
      "perez juan",
      "2014-05-01",
    );
    expect(found.map((p) => p.id).sort()).toEqual(["player-1", "player-2"]);
  });

  it("lists the players linked to a guardian", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer({guardianIds: ["g1", "g2"]}));
    await uow.players.save(buildPlayer({id: "player-2", guardianIds: ["g2"]}));
    await uow.players.save(buildPlayer({id: "player-3", guardianIds: []}));
    const linked = await uow.players.listByGuardian("tenant-a", "g2");
    expect(linked.map((p) => p.id).sort()).toEqual(["player-1", "player-2"]);
  });
});

describe("InMemoryGuardianRepository", () => {
  it("generates distinct ids", () => {
    const {uow} = setup();
    expect(uow.guardians.newId()).not.toBe(uow.guardians.newId());
  });

  it("gets by tenant and id, isolating tenants", async () => {
    const {uow} = setup();
    await uow.guardians.save(buildGuardian());
    expect(await uow.guardians.get("tenant-a", "guardian-1")).toEqual(
      buildGuardian(),
    );
    expect(await uow.guardians.get("tenant-b", "guardian-1")).toBeNull();
  });

  it("finds a guardian by document key within its tenant", async () => {
    const {uow} = setup();
    await uow.guardians.save(buildGuardian());
    expect(
      (await uow.guardians.findByDocumentKey("tenant-a", "CC:1020304"))!.id,
    ).toBe("guardian-1");
    expect(
      await uow.guardians.findByDocumentKey("tenant-b", "CC:1020304"),
    ).toBeNull();
  });
});

describe("InMemoryPlayerHistoryWriter", () => {
  it("stamps each entry with an id and the clock time", async () => {
    const {uow} = setup();
    await uow.playerHistory.append("tenant-a", "player-1", historyEntry);
    await uow.playerHistory.append("tenant-a", "player-1", historyEntry);
    const entries = uow.playerHistory.entriesOf("tenant-a", "player-1");
    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[0].at.toISOString()).toBe("2026-10-04T12:00:00.000Z");
    expect(entries[0].actorUid).toBe("staff-1");
  });

  it("keeps the history of each player apart", async () => {
    const {uow} = setup();
    await uow.playerHistory.append("tenant-a", "player-1", historyEntry);
    await uow.playerHistory.append("tenant-a", "player-2", historyEntry);
    await uow.playerHistory.append("tenant-b", "player-1", historyEntry);
    expect(uow.playerHistory.entriesOf("tenant-a", "player-1")).toHaveLength(1);
  });
});

describe("InMemoryUnitOfWork with player repositories", () => {
  it("exposes players, guardians and history in the transaction", async () => {
    const {uow} = setup();
    await uow.run(async (tx) => {
      await tx.players.save(buildPlayer());
      await tx.guardians.save(buildGuardian());
      await tx.playerHistory.append("tenant-a", "player-1", historyEntry);
    });
    expect(await uow.players.get("tenant-a", "player-1")).not.toBeNull();
    expect(await uow.guardians.get("tenant-a", "guardian-1")).not.toBeNull();
    expect(uow.playerHistory.entriesOf("tenant-a", "player-1")).toHaveLength(1);
  });

  it("rolls back players, guardians and history when the work throws", async () => {
    const {uow} = setup();
    await uow.players.save(buildPlayer());
    await expect(
      uow.run(async (tx) => {
        await tx.players.save(buildPlayer({firstNames: "Cambiado"}));
        await tx.guardians.save(buildGuardian());
        await tx.playerHistory.append("tenant-a", "player-1", historyEntry);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await uow.players.get("tenant-a", "player-1"))!.firstNames).toBe(
      "Juan",
    );
    expect(await uow.guardians.get("tenant-a", "guardian-1")).toBeNull();
    expect(uow.playerHistory.entriesOf("tenant-a", "player-1")).toHaveLength(0);
  });

  it("rolls back the guardians created when the audit write fails", async () => {
    const {uow, auditLog} = setup();
    auditLog.failWith = new Error("audit down");
    await expect(
      uow.run(async (tx) => {
        await tx.guardians.save(buildGuardian());
        await tx.auditLog.append({
          tenantId: "tenant-a",
          actorUid: "staff-1",
          actorRole: "owner",
          action: "guardian.created",
          target: {type: "guardian", id: "guardian-1"},
          before: {},
          after: {},
          device: {},
        });
      }),
    ).rejects.toThrow("audit down");
    expect(await uow.guardians.get("tenant-a", "guardian-1")).toBeNull();
  });
});
