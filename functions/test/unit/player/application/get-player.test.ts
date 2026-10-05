import {beforeEach, describe, expect, it} from "vitest";
import {GetPlayer} from "../../../../src/player/application/get-player.js";
import {
  buildMember,
  buildPlayer,
} from "../../../../src/player/application/testing/fixtures.js";
import {
  createWorld,
  failure,
  NOW,
  type World,
} from "../../../../src/player/application/testing/world.js";

let world: World;
let get: GetPlayer;

const full = buildPlayer({
  status: "activo",
  document: {type: "TI", number: "123"},
  documentKey: "TI:123",
  medical: {allergies: "penicilina"},
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
});

const input = (actorUid: string, playerId = "player-1") => ({
  tenantId: "tenant-a",
  actorUid,
  playerId,
});

beforeEach(async () => {
  world = await createWorld();
  get = new GetPlayer(world.uow);
  await world.uow.players.save(full);
});

describe("GetPlayer", () => {
  it.each(["owner-1", "acc-1", "coord-1"])(
    "returns the full record to %s",
    async (uid) => {
      const result = await get.execute(input(uid));
      expect(result.player).toEqual(full);
    },
  );

  it("strips document, guardians and consent for a teacher of the group", async () => {
    const {player} = await get.execute(input("teacher-1"));
    expect(player).not.toHaveProperty("document");
    expect(player).not.toHaveProperty("documentKey");
    expect(player).not.toHaveProperty("guardians");
    expect(player).not.toHaveProperty("guardianIds");
    expect(player).not.toHaveProperty("dataConsent");
    expect(player).toMatchObject({
      id: "player-1",
      firstNames: "Juan",
      groupId: "group-1",
      status: "activo",
      emergencyContact: full.emergencyContact,
      medical: {allergies: "penicilina"},
    });
  });

  it("denies a coordinator a player of another venue", async () => {
    const error = await failure(get.execute(input("coord-2")));
    expect(error.code).toBe("permission_denied");
  });

  it("denies a coordinator with an empty scope", async () => {
    await world.memberships.save(buildMember("coord-3", "coordinator"));
    const error = await failure(get.execute(input("coord-3")));
    expect(error.code).toBe("permission_denied");
  });

  it("denies a teacher a player outside their groups", async () => {
    await world.uow.players.save(
      buildPlayer({id: "player-2", groupId: "group-2", venueId: "venue-2"}),
    );
    const error = await failure(get.execute(input("teacher-1", "player-2")));
    expect(error.code).toBe("permission_denied");
  });

  it.each(["guardian", "adultPlayer"] as const)(
    "denies the %s role",
    async (role) => {
      await world.memberships.save(
        buildMember("u-1", role, {playerIds: ["player-1"]}),
      );
      const error = await failure(get.execute(input("u-1")));
      expect(error.code).toBe("permission_denied");
    },
  );

  it("denies an inactive member", async () => {
    await world.memberships.save(
      buildMember("owner-2", "owner", {}, {status: "inactive"}),
    );
    const error = await failure(get.execute(input("owner-2")));
    expect(error.code).toBe("permission_denied");
  });

  it("denies a user with no membership in the tenant", async () => {
    const error = await failure(get.execute(input("nobody")));
    expect(error.code).toBe("permission_denied");
  });

  it("denies the owner of another organization", async () => {
    await world.memberships.save(
      buildMember("owner-b", "owner", {}, {tenantId: "tenant-b"}),
    );
    const error = await failure(get.execute(input("owner-b")));
    expect(error.code).toBe("permission_denied");
  });

  it("fails with not_found for a missing player", async () => {
    const error = await failure(get.execute(input("owner-1", "missing")));
    expect(error.code).toBe("not_found");
  });

  it("fails with not_found for a player of another organization", async () => {
    await world.uow.players.save(
      buildPlayer({id: "player-b", tenantId: "tenant-b"}),
    );
    const error = await failure(get.execute(input("owner-1", "player-b")));
    expect(error.code).toBe("not_found");
  });

  it("writes nothing", async () => {
    await get.execute(input("owner-1"));
    expect(world.auditLog.entries).toHaveLength(0);
  });
});
