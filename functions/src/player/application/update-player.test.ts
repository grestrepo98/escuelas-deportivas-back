import {beforeEach, describe, expect, it} from "vitest";
import {UpdatePlayer, type UpdatePlayerInput} from "./update-player.js";
import {buildPlayer} from "./testing/fixtures.js";
import {createWorld, failure, NOW, type World} from "./testing/world.js";

let world: World;
let update: UpdatePlayer;

const input = (
  overrides: Partial<UpdatePlayerInput> = {},
): UpdatePlayerInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  playerId: "player-1",
  firstNames: "Juan Camilo",
  lastNames: "Perez Gomez",
  birthDate: "2014-05-02",
  emergencyContact: {name: "Luis", phone: "3009998877", relationship: "padre"},
  ...overrides,
});

beforeEach(async () => {
  world = await createWorld();
  update = new UpdatePlayer(world.uow, world.clock);
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

describe("UpdatePlayer", () => {
  it("replaces the personal, emergency and medical data", async () => {
    const result = await update.execute(
      input({medical: {bloodType: "A+", notes: "asma"}}),
    );
    expect(result).toEqual({playerId: "player-1"});
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved).toMatchObject({
      firstNames: "Juan Camilo",
      lastNames: "Perez Gomez",
      nameKey: "perez gomez juan camilo",
      birthDate: "2014-05-02",
      emergencyContact: {
        name: "Luis",
        phone: "3009998877",
        relationship: "padre",
      },
      medical: {bloodType: "A+", notes: "asma"},
      updatedAt: NOW,
    });
  });

  it("does not touch the group, status or guardians", async () => {
    await update.execute(input());
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved).toMatchObject({
      groupId: "group-1",
      venueId: "venue-1",
      status: "activo",
      guardianIds: ["guardian-1"],
    });
    expect(saved!.guardians).toHaveLength(1);
  });

  it("records player.updated without sensitive data", async () => {
    await update.execute(
      input({
        medical: {allergies: "penicilina"},
        document: {type: "TI", number: "999"},
        device: {userAgent: "test"},
      }),
    );
    expect(world.auditLog.entries).toHaveLength(1);
    const [entry] = world.auditLog.entries;
    expect(entry).toMatchObject({
      actorUid: "owner-1",
      actorRole: "owner",
      action: "player.updated",
      target: {type: "player", id: "player-1"},
      before: {firstNames: "Juan", lastNames: "Perez", birthDate: "2014-05-01"},
      after: {
        firstNames: "Juan Camilo",
        lastNames: "Perez Gomez",
        birthDate: "2014-05-02",
      },
      device: {userAgent: "test"},
    });
    expect(JSON.stringify(entry)).not.toContain("penicilina");
    expect(JSON.stringify(entry)).not.toContain("999");
  });

  describe("document", () => {
    it("sets a document and its key", async () => {
      await update.execute(input({document: {type: "TI", number: "0012.345"}}));
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved).toMatchObject({
        document: {type: "TI", number: "0012.345"},
        documentKey: "TI:12345",
      });
    });

    it("removes the document when none is sent", async () => {
      await world.uow.players.save(
        buildPlayer({
          document: {type: "TI", number: "1"},
          documentKey: "TI:1",
        }),
      );
      await update.execute(input());
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved).toMatchObject({document: null, documentKey: null});
    });

    it("accepts the player's own document again", async () => {
      await world.uow.players.save(
        buildPlayer({
          document: {type: "TI", number: "1"},
          documentKey: "TI:1",
        }),
      );
      await expect(
        update.execute(input({document: {type: "TI", number: "01"}})),
      ).resolves.toEqual({playerId: "player-1"});
    });

    it("answers 409 with the player id when another player has the document", async () => {
      await world.uow.players.save(
        buildPlayer({
          id: "player-2",
          document: {type: "TI", number: "777"},
          documentKey: "TI:777",
        }),
      );
      const error = await failure(
        update.execute(input({document: {type: "TI", number: "777"}})),
      );
      expect(error.code).toBe("failed_precondition");
      expect(error.details).toEqual({playerId: "player-2"});
      expect(world.auditLog.entries).toHaveLength(0);
    });
  });

  describe("permissions", () => {
    it.each(["acc-1", "coord-1"])(
      "lets %s edit a player of venue-1",
      async (uid) => {
        await expect(update.execute(input({actorUid: uid}))).resolves.toEqual({
          playerId: "player-1",
        });
      },
    );

    it("denies a coordinator a player of another venue", async () => {
      const error = await failure(update.execute(input({actorUid: "coord-2"})));
      expect(error.code).toBe("permission_denied");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it("denies a teacher", async () => {
      const error = await failure(
        update.execute(input({actorUid: "teacher-1"})),
      );
      expect(error.code).toBe("permission_denied");
    });

    it("denies a user without membership", async () => {
      const error = await failure(update.execute(input({actorUid: "nobody"})));
      expect(error.code).toBe("permission_denied");
    });
  });

  describe("lookup and validation", () => {
    it("fails with not_found for a missing player", async () => {
      const error = await failure(update.execute(input({playerId: "missing"})));
      expect(error.code).toBe("not_found");
    });

    it("fails with not_found for a player of another organization", async () => {
      await world.uow.players.save(
        buildPlayer({id: "player-b", tenantId: "tenant-b"}),
      );
      const error = await failure(
        update.execute(input({playerId: "player-b"})),
      );
      expect(error.code).toBe("not_found");
    });

    it.each([
      ["blank first names", {firstNames: " "}],
      ["blank last names", {lastNames: ""}],
      ["an invalid birth date", {birthDate: "2014-02-30"}],
      [
        "a blank emergency phone",
        {emergencyContact: {name: "A", phone: " ", relationship: "x"}},
      ],
    ])("rejects %s", async (_label, overrides) => {
      const error = await failure(update.execute(input(overrides)));
      expect(error.code).toBe("invalid_argument");
    });
  });
});
