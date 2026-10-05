import {beforeEach, describe, expect, it} from "vitest";
import {
  SetPlayerGuardians,
  type SetPlayerGuardiansInput,
} from "../../../../src/player/application/set-player-guardians.js";
import {
  buildGuardian,
  buildPlayer,
} from "../../../../src/player/application/testing/fixtures.js";
import {
  createWorld,
  failure,
  NOW,
  type World,
} from "../../../../src/player/application/testing/world.js";

let world: World;
let setGuardians: SetPlayerGuardians;

const link = (guardianId: string, isPaymentResponsible = false) => ({
  guardianId,
  relationship: "madre",
  isPaymentResponsible,
});

const input = (
  overrides: Partial<SetPlayerGuardiansInput> = {},
): SetPlayerGuardiansInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  playerId: "player-1",
  guardians: [link("guardian-1", true)],
  ...overrides,
});

const newGuardian = {
  firstNames: "Luis",
  lastNames: "Gomez",
  document: {type: "CC" as const, number: "555"},
  phone: "3000000000",
  preferredContact: "phone" as const,
};

const newLink = {
  guardian: newGuardian,
  relationship: "padre",
  isPaymentResponsible: false,
};

beforeEach(async () => {
  world = await createWorld();
  setGuardians = new SetPlayerGuardians(world.uow, world.clock);
  await world.uow.guardians.save(buildGuardian());
  await world.uow.guardians.save(
    buildGuardian({
      id: "guardian-2",
      firstNames: "Luis",
      lastNames: "Perez",
      documentKey: "CC:2",
    }),
  );
  await world.uow.players.save(buildPlayer());
});

describe("SetPlayerGuardians", () => {
  it("replaces the set of guardians", async () => {
    const result = await setGuardians.execute(
      input({guardians: [link("guardian-1", true), link("guardian-2")]}),
    );
    expect(result).toEqual({playerId: "player-1", createdGuardianIds: []});
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.guardianIds).toEqual(["guardian-1", "guardian-2"]);
    expect(saved!.guardians.map((g) => g.fullName)).toEqual([
      "Ana Perez",
      "Luis Perez",
    ]);
    expect(saved!.updatedAt).toEqual(NOW);
  });

  it("removes the guardians that are no longer sent", async () => {
    await setGuardians.execute(input());
    await setGuardians.execute(input({guardians: [link("guardian-2")]}));
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.guardianIds).toEqual(["guardian-2"]);
  });

  it("creates new guardians in the same call", async () => {
    const result = await setGuardians.execute(
      input({guardians: [link("guardian-1", true), newLink]}),
    );
    expect(result.createdGuardianIds).toHaveLength(1);
    const created = await world.uow.guardians.get(
      "tenant-a",
      result.createdGuardianIds[0],
    );
    expect(created).toMatchObject({firstNames: "Luis", documentKey: "CC:555"});
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.guardianIds).toHaveLength(2);
  });

  it("allows no guardians while the player is not active", async () => {
    await setGuardians.execute(input({guardians: []}));
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved).toMatchObject({guardians: [], guardianIds: []});
  });

  it("keeps the data consent already recorded", async () => {
    const dataConsent = {
      guardianId: "guardian-1",
      recordedBy: "owner-1",
      at: NOW,
    };
    await world.uow.players.save(buildPlayer({dataConsent}));
    await setGuardians.execute(input({guardians: [link("guardian-2", true)]}));
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.dataConsent).toEqual(dataConsent);
  });

  it("records player.guardians_changed and guardian.created", async () => {
    const result = await setGuardians.execute(
      input({guardians: [link("guardian-1", true), newLink]}),
    );
    expect(world.auditLog.entries.map((e) => e.action).sort()).toEqual([
      "guardian.created",
      "player.guardians_changed",
    ]);
    const changed = world.auditLog.entries.find(
      (e) => e.action === "player.guardians_changed",
    );
    expect(changed).toMatchObject({
      target: {type: "player", id: "player-1"},
      before: {guardianIds: []},
      after: {
        guardianIds: ["guardian-1", result.createdGuardianIds[0]],
        paymentResponsibleId: "guardian-1",
      },
    });
  });

  describe("active player", () => {
    beforeEach(async () => {
      await world.uow.players.save(
        buildPlayer({
          status: "activo",
          guardianIds: ["guardian-1"],
          guardians: [
            {
              guardianId: "guardian-1",
              fullName: "Ana Perez",
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        }),
      );
    });

    it("answers 409 when the change leaves it without a payment responsible", async () => {
      const error = await failure(
        setGuardians.execute(input({guardians: [link("guardian-1", false)]})),
      );
      expect(error.code).toBe("failed_precondition");
      expect(world.auditLog.entries).toHaveLength(0);
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved!.guardians[0].isPaymentResponsible).toBe(true);
    });

    it("answers 409 when every guardian is removed", async () => {
      const error = await failure(setGuardians.execute(input({guardians: []})));
      expect(error.code).toBe("failed_precondition");
    });

    it("accepts a swap of the payment responsible", async () => {
      await setGuardians.execute(
        input({guardians: [link("guardian-1"), link("guardian-2", true)]}),
      );
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(
        saved!.guardians.find((g) => g.isPaymentResponsible)!.guardianId,
      ).toBe("guardian-2");
    });
  });

  describe("errors", () => {
    it("fails with not_found for an unknown guardian", async () => {
      const error = await failure(
        setGuardians.execute(input({guardians: [link("missing", true)]})),
      );
      expect(error.code).toBe("not_found");
    });

    it("rejects the same guardian twice", async () => {
      const error = await failure(
        setGuardians.execute(
          input({guardians: [link("guardian-1"), link("guardian-1")]}),
        ),
      );
      expect(error.code).toBe("invalid_argument");
    });

    it("rejects two payment responsibles", async () => {
      const error = await failure(
        setGuardians.execute(
          input({
            guardians: [link("guardian-1", true), link("guardian-2", true)],
          }),
        ),
      );
      expect(error.code).toBe("invalid_argument");
    });

    it("answers 409 with the guardian id when a new guardian's document exists", async () => {
      const error = await failure(
        setGuardians.execute(
          input({
            guardians: [
              {
                ...newLink,
                guardian: {
                  ...newGuardian,
                  document: {type: "CC", number: "1020304"},
                },
              },
            ],
          }),
        ),
      );
      expect(error.details).toEqual({guardianId: "guardian-1"});
    });

    it("fails with not_found for a missing player", async () => {
      const error = await failure(
        setGuardians.execute(input({playerId: "missing"})),
      );
      expect(error.code).toBe("not_found");
    });

    it("leaves no guardian behind when the transaction fails", async () => {
      world.auditLog.failWith = new Error("audit down");
      await expect(
        setGuardians.execute(input({guardians: [newLink]})),
      ).rejects.toThrow("audit down");
      expect(
        await world.uow.guardians.findByDocumentKey("tenant-a", "CC:555"),
      ).toBeNull();
    });
  });

  describe("permissions", () => {
    it.each(["acc-1", "coord-1"])(
      "lets %s change a player of venue-1",
      async (uid) => {
        await expect(
          setGuardians.execute(input({actorUid: uid})),
        ).resolves.toMatchObject({playerId: "player-1"});
      },
    );

    it.each(["coord-2", "teacher-1", "nobody"])("denies %s", async (uid) => {
      const error = await failure(setGuardians.execute(input({actorUid: uid})));
      expect(error.code).toBe("permission_denied");
      expect(world.auditLog.entries).toHaveLength(0);
    });
  });
});
