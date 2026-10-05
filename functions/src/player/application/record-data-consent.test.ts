import {beforeEach, describe, expect, it} from "vitest";
import {RecordDataConsent} from "./record-data-consent.js";
import {buildPlayer} from "./testing/fixtures.js";
import {createWorld, failure, NOW, type World} from "./testing/world.js";

let world: World;
let record: RecordDataConsent;

const input = (overrides: Record<string, string> = {}) => ({
  tenantId: "tenant-a",
  actorUid: "coord-1",
  playerId: "player-1",
  guardianId: "guardian-1",
  ...overrides,
});

const linked = (id: string) => ({
  guardianId: id,
  fullName: `Guardian ${id}`,
  relationship: "madre",
  isPaymentResponsible: false,
});

beforeEach(async () => {
  world = await createWorld();
  record = new RecordDataConsent(world.uow, world.clock);
  await world.uow.players.save(
    buildPlayer({
      guardians: [linked("guardian-1"), linked("guardian-2")],
      guardianIds: ["guardian-1", "guardian-2"],
    }),
  );
});

describe("RecordDataConsent", () => {
  it("records the guardian, the staff member and the time", async () => {
    const result = await record.execute(input());
    const expected = {guardianId: "guardian-1", recordedBy: "coord-1", at: NOW};
    expect(result).toEqual({playerId: "player-1", dataConsent: expected});
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.dataConsent).toEqual(expected);
    expect(saved!.updatedAt).toEqual(NOW);
  });

  it("overwrites a previous consent and keeps both in the audit log", async () => {
    await record.execute(input());
    await record.execute(
      input({guardianId: "guardian-2", actorUid: "owner-1"}),
    );
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.dataConsent).toMatchObject({
      guardianId: "guardian-2",
      recordedBy: "owner-1",
    });
    expect(world.auditLog.entries.map((e) => e.action)).toEqual([
      "player.consent_recorded",
      "player.consent_recorded",
    ]);
  });

  it("records player.consent_recorded in the audit log", async () => {
    await record.execute({...input(), device: {userAgent: "test"}});
    expect(world.auditLog.entries[0]).toMatchObject({
      actorUid: "coord-1",
      actorRole: "coordinator",
      action: "player.consent_recorded",
      target: {type: "player", id: "player-1"},
      before: {guardianId: null},
      after: {guardianId: "guardian-1"},
      device: {userAgent: "test"},
    });
  });

  it("answers 409 when the guardian is not linked to the player", async () => {
    const error = await failure(
      record.execute(input({guardianId: "guardian-9"})),
    );
    expect(error.code).toBe("failed_precondition");
    expect(world.auditLog.entries).toHaveLength(0);
  });

  it("fails with not_found for a missing player", async () => {
    const error = await failure(record.execute(input({playerId: "missing"})));
    expect(error.code).toBe("not_found");
  });

  it.each(["owner-1", "acc-1", "coord-1"])("lets %s record it", async (uid) => {
    await expect(record.execute(input({actorUid: uid}))).resolves.toMatchObject(
      {
        playerId: "player-1",
      },
    );
  });

  it.each(["coord-2", "teacher-1", "nobody"])("denies %s", async (uid) => {
    const error = await failure(record.execute(input({actorUid: uid})));
    expect(error.code).toBe("permission_denied");
  });
});
