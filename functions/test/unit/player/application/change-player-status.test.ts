import {beforeEach, describe, expect, it} from "vitest";
import {
  ChangePlayerStatus,
  type ChangePlayerStatusInput,
} from "../../../../src/player/application/change-player-status.js";
import type {
  Player,
  PlayerStatus,
} from "../../../../src/player/domain/player.js";
import {
  buildGroup,
  buildPlayer,
} from "../../../../src/player/application/testing/fixtures.js";
import {
  createWorld,
  failure,
  NOW,
  type World,
} from "../../../../src/player/application/testing/world.js";

let world: World;
let change: ChangePlayerStatus;

const input = (
  overrides: Partial<ChangePlayerStatusInput> = {},
): ChangePlayerStatusInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  playerId: "player-1",
  status: "activo",
  ...overrides,
});

// A player that meets every requirement to become active.
const ready = (overrides: Partial<Player> = {}): Player =>
  buildPlayer({
    guardians: [
      {
        guardianId: "guardian-1",
        fullName: "Ana Perez",
        relationship: "madre",
        isPaymentResponsible: true,
      },
    ],
    guardianIds: ["guardian-1"],
    dataConsent: {guardianId: "guardian-1", recordedBy: "owner-1", at: NOW},
    ...overrides,
  });

const statusOf = async (): Promise<PlayerStatus> =>
  (await world.uow.players.get("tenant-a", "player-1"))!.status;

beforeEach(async () => {
  world = await createWorld();
  change = new ChangePlayerStatus(world.uow, world.clock);
  await world.uow.players.save(ready());
});

describe("ChangePlayerStatus", () => {
  it("activates a ready player", async () => {
    const result = await change.execute(input());
    expect(result).toEqual({playerId: "player-1", status: "activo"});
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved).toMatchObject({
      status: "activo",
      statusReason: null,
      updatedAt: NOW,
    });
  });

  it("appends a status entry to the history", async () => {
    await change.execute(input());
    const entries = world.uow.playerHistory.entriesOf("tenant-a", "player-1");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "status",
      before: {status: "preinscrito"},
      after: {status: "activo"},
      reason: null,
      actorUid: "owner-1",
      at: NOW,
    });
  });

  it("records player.status_changed in the audit log", async () => {
    await change.execute({...input(), device: {userAgent: "test"}});
    expect(world.auditLog.entries).toHaveLength(1);
    expect(world.auditLog.entries[0]).toMatchObject({
      actorUid: "owner-1",
      actorRole: "owner",
      action: "player.status_changed",
      target: {type: "player", id: "player-1"},
      before: {status: "preinscrito"},
      after: {status: "activo"},
      device: {userAgent: "test"},
    });
  });

  it("rolls the change and the history back when the audit write fails", async () => {
    world.auditLog.failWith = new Error("audit down");
    await expect(change.execute(input())).rejects.toThrow("audit down");
    expect(await statusOf()).toBe("preinscrito");
    expect(world.uow.playerHistory.entriesOf("tenant-a", "player-1")).toEqual(
      [],
    );
  });

  describe("activation requirements", () => {
    it("answers 409 without a payment responsible", async () => {
      await world.uow.players.save(
        ready({
          guardians: [
            {
              guardianId: "guardian-1",
              fullName: "Ana Perez",
              relationship: "madre",
              isPaymentResponsible: false,
            },
          ],
        }),
      );
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
      expect(await statusOf()).toBe("preinscrito");
    });

    it("answers 409 without the data consent", async () => {
      await world.uow.players.save(ready({dataConsent: null}));
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
      expect(world.auditLog.entries).toHaveLength(0);
      expect(world.uow.playerHistory.entriesOf("tenant-a", "player-1")).toEqual(
        [],
      );
    });

    it("answers 409 when the group is closed", async () => {
      await world.uow.groups.save(buildGroup({status: "closed"}));
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
    });

    it("answers 409 when the group no longer exists", async () => {
      await world.uow.players.save(ready({groupId: "missing"}));
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
    });
  });

  describe("transitions", () => {
    it("pauses an active player with a reason", async () => {
      await world.uow.players.save(ready({status: "activo"}));
      const result = await change.execute(
        input({status: "pausado", reason: "  lesión "}),
      );
      expect(result.status).toBe("pausado");
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved).toMatchObject({status: "pausado", statusReason: "lesión"});
      const [entry] = world.uow.playerHistory.entriesOf("tenant-a", "player-1");
      expect(entry).toMatchObject({
        before: {status: "activo"},
        after: {status: "pausado"},
        reason: "lesión",
      });
    });

    it("answers 400 when pausing or withdrawing without a reason", async () => {
      await world.uow.players.save(ready({status: "activo"}));
      for (const status of ["pausado", "retirado"] as const) {
        const error = await failure(change.execute(input({status})));
        expect(error.code).toBe("invalid_argument");
        const blank = await failure(
          change.execute(input({status, reason: "   "})),
        );
        expect(blank.code).toBe("invalid_argument");
      }
      expect(await statusOf()).toBe("activo");
    });

    it("answers 409 for a transition that is not allowed", async () => {
      const error = await failure(
        change.execute(input({status: "pausado", reason: "x"})),
      );
      expect(error.code).toBe("failed_precondition");
      expect(await statusOf()).toBe("preinscrito");
    });

    it("answers 409 when the status does not change", async () => {
      const error = await failure(
        change.execute(input({status: "preinscrito"})),
      );
      expect(error.code).toBe("failed_precondition");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it("clears the reason when the player becomes active again", async () => {
      await world.uow.players.save(
        ready({status: "pausado", statusReason: "lesión"}),
      );
      await change.execute(input());
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved).toMatchObject({status: "activo", statusReason: null});
    });

    it("withdraws and re-enrolls the same profile, keeping its history", async () => {
      await world.uow.players.save(ready({status: "activo"}));
      const joinedAt = (await world.uow.players.get("tenant-a", "player-1"))!
        .joinedAt;

      await change.execute(input({status: "retirado", reason: "mudanza"}));
      await change.execute(input({status: "activo"}));

      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved).toMatchObject({
        id: "player-1",
        status: "activo",
        joinedAt,
        guardianIds: ["guardian-1"],
      });
      const entries = world.uow.playerHistory.entriesOf("tenant-a", "player-1");
      expect(entries.map((e) => e.after.status)).toEqual([
        "retirado",
        "activo",
      ]);
      expect(entries[0].reason).toBe("mudanza");
    });

    it("lets a withdrawn player go back to pre-enrolled without requirements", async () => {
      await world.uow.players.save(
        buildPlayer({status: "retirado", statusReason: "mudanza"}),
      );
      await expect(
        change.execute(input({status: "preinscrito"})),
      ).resolves.toEqual({playerId: "player-1", status: "preinscrito"});
    });

    it("re-enrolling to active still needs the requirements", async () => {
      await world.uow.players.save(
        buildPlayer({status: "retirado", statusReason: "mudanza"}),
      );
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
    });
  });

  describe("permissions", () => {
    it.each(["acc-1", "coord-1"])("lets %s change the status", async (uid) => {
      await expect(
        change.execute(input({actorUid: uid})),
      ).resolves.toMatchObject({status: "activo"});
    });

    it("denies a coordinator a player of another venue", async () => {
      const error = await failure(change.execute(input({actorUid: "coord-2"})));
      expect(error.code).toBe("permission_denied");
      expect(await statusOf()).toBe("preinscrito");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it.each(["teacher-1", "nobody"])("denies %s", async (uid) => {
      const error = await failure(change.execute(input({actorUid: uid})));
      expect(error.code).toBe("permission_denied");
    });

    it("fails with not_found for a missing player", async () => {
      const error = await failure(change.execute(input({playerId: "missing"})));
      expect(error.code).toBe("not_found");
    });

    it("fails with not_found for a player of another organization", async () => {
      await world.uow.players.save(
        buildPlayer({id: "player-b", tenantId: "tenant-b"}),
      );
      const error = await failure(
        change.execute(input({playerId: "player-b"})),
      );
      expect(error.code).toBe("not_found");
    });
  });
});
