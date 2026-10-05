import {beforeEach, describe, expect, it} from "vitest";
import {
  UpdateGuardian,
  type UpdateGuardianInput,
} from "../../../../src/player/application/update-guardian.js";
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
let update: UpdateGuardian;

const input = (
  overrides: Partial<UpdateGuardianInput> = {},
): UpdateGuardianInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  guardianId: "guardian-1",
  firstNames: "Ana María",
  lastNames: "Perez",
  document: {type: "CC", number: "1020304"},
  phone: "3110000000",
  email: "ana@example.com",
  preferredContact: "email",
  ...overrides,
});

const linkTo = (playerId: string, venueId: string) =>
  buildPlayer({
    id: playerId,
    venueId,
    groupId: venueId === "venue-1" ? "group-1" : "group-2",
    guardianIds: ["guardian-1"],
    guardians: [
      {
        guardianId: "guardian-1",
        fullName: "Ana Perez",
        relationship: "madre",
        isPaymentResponsible: true,
      },
    ],
  });

beforeEach(async () => {
  world = await createWorld();
  update = new UpdateGuardian(world.uow, world.clock);
  await world.uow.guardians.save(buildGuardian());
  await world.uow.players.save(linkTo("player-1", "venue-1"));
});

describe("UpdateGuardian", () => {
  it("updates the guardian's data", async () => {
    const result = await update.execute(input());
    expect(result).toEqual({guardianId: "guardian-1"});
    const saved = await world.uow.guardians.get("tenant-a", "guardian-1");
    expect(saved).toMatchObject({
      firstNames: "Ana María",
      phone: "3110000000",
      email: "ana@example.com",
      preferredContact: "email",
      updatedAt: NOW,
    });
  });

  it("clears the email when none is sent", async () => {
    await world.uow.guardians.save(buildGuardian({email: "old@example.com"}));
    await update.execute(input({email: undefined}));
    const saved = await world.uow.guardians.get("tenant-a", "guardian-1");
    expect(saved!.email).toBeNull();
  });

  it("copies the new full name into every linked player, in any venue", async () => {
    await world.uow.players.save(linkTo("player-2", "venue-2"));
    await world.uow.players.save(buildPlayer({id: "player-3"}));
    await update.execute(input());
    for (const id of ["player-1", "player-2"]) {
      const player = await world.uow.players.get("tenant-a", id);
      expect(player!.guardians[0].fullName).toBe("Ana María Perez");
      expect(player!.updatedAt).toEqual(NOW);
    }
    const unlinked = await world.uow.players.get("tenant-a", "player-3");
    expect(unlinked!.updatedAt).not.toEqual(NOW);
  });

  it("leaves the players alone when the full name does not change", async () => {
    await update.execute(input({firstNames: "Ana", phone: "3119999999"}));
    const player = await world.uow.players.get("tenant-a", "player-1");
    expect(player!.updatedAt).not.toEqual(NOW);
  });

  it("rolls the guardian and the players back when the audit write fails", async () => {
    world.auditLog.failWith = new Error("audit down");
    await expect(update.execute(input())).rejects.toThrow("audit down");
    const guardian = await world.uow.guardians.get("tenant-a", "guardian-1");
    expect(guardian!.firstNames).toBe("Ana");
    const player = await world.uow.players.get("tenant-a", "player-1");
    expect(player!.guardians[0].fullName).toBe("Ana Perez");
  });

  it("records guardian.updated without the document or the phone", async () => {
    await update.execute({...input(), device: {userAgent: "test"}});
    expect(world.auditLog.entries).toHaveLength(1);
    const [entry] = world.auditLog.entries;
    expect(entry).toMatchObject({
      action: "guardian.updated",
      target: {type: "guardian", id: "guardian-1"},
      before: {firstNames: "Ana", lastNames: "Perez"},
      after: {firstNames: "Ana María", lastNames: "Perez"},
      device: {userAgent: "test"},
    });
    expect(JSON.stringify(entry)).not.toContain("1020304");
    expect(JSON.stringify(entry)).not.toContain("3110000000");
  });

  describe("document", () => {
    it("updates the document and its key", async () => {
      await update.execute(input({document: {type: "CE", number: "9.9"}}));
      const saved = await world.uow.guardians.get("tenant-a", "guardian-1");
      expect(saved).toMatchObject({
        document: {type: "CE", number: "9.9"},
        documentKey: "CE:99",
      });
    });

    it("answers 409 with the guardian id when another guardian has it", async () => {
      await world.uow.guardians.save(
        buildGuardian({id: "guardian-2", documentKey: "CC:777"}),
      );
      const error = await failure(
        update.execute(input({document: {type: "CC", number: "777"}})),
      );
      expect(error.code).toBe("failed_precondition");
      expect(error.details).toEqual({guardianId: "guardian-2"});
    });
  });

  describe("permissions", () => {
    it.each(["owner-1", "acc-1", "coord-1"])("lets %s edit", async (uid) => {
      await expect(update.execute(input({actorUid: uid}))).resolves.toEqual({
        guardianId: "guardian-1",
      });
    });

    it("denies a coordinator whose venues have no player of the guardian", async () => {
      const error = await failure(update.execute(input({actorUid: "coord-2"})));
      expect(error.code).toBe("permission_denied");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it.each(["teacher-1", "nobody"])("denies %s", async (uid) => {
      const error = await failure(update.execute(input({actorUid: uid})));
      expect(error.code).toBe("permission_denied");
    });
  });

  describe("lookup and validation", () => {
    it("fails with not_found for a missing guardian", async () => {
      const error = await failure(
        update.execute(input({guardianId: "missing"})),
      );
      expect(error.code).toBe("not_found");
    });

    it("fails with not_found for a guardian of another organization", async () => {
      await world.uow.guardians.save(
        buildGuardian({id: "guardian-b", tenantId: "tenant-b"}),
      );
      const error = await failure(
        update.execute(input({guardianId: "guardian-b"})),
      );
      expect(error.code).toBe("not_found");
    });

    it.each([
      ["blank first names", {firstNames: " "}],
      ["blank last names", {lastNames: ""}],
      ["a blank phone", {phone: " "}],
      [
        "a blank document number",
        {document: {type: "CC" as const, number: " "}},
      ],
    ])("rejects %s", async (_label, overrides) => {
      const error = await failure(update.execute(input(overrides)));
      expect(error.code).toBe("invalid_argument");
    });
  });
});
