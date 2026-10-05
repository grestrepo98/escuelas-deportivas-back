import {beforeEach, describe, expect, it} from "vitest";
import {
  ChangePlayerPlacement,
  type ChangePlayerPlacementInput,
} from "../../../../src/player/application/change-player-placement.js";
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
let change: ChangePlayerPlacement;

const input = (
  overrides: Partial<ChangePlayerPlacementInput> = {},
): ChangePlayerPlacementInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  playerId: "player-1",
  groupId: "group-3",
  ...overrides,
});

beforeEach(async () => {
  world = await createWorld();
  change = new ChangePlayerPlacement(world.uow, world.clock);
  // Same venue as group-1, other category.
  await world.uow.groups.save(
    buildGroup({id: "group-3", venueId: "venue-1", categoryId: "category-2"}),
  );
  await world.uow.players.save(buildPlayer({status: "activo"}));
});

describe("ChangePlayerPlacement", () => {
  it("moves the player and copies the venue and category of the new group", async () => {
    const result = await change.execute(input());
    expect(result).toEqual({
      playerId: "player-1",
      groupId: "group-3",
      venueId: "venue-1",
      categoryId: "category-2",
    });
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved).toMatchObject({
      groupId: "group-3",
      venueId: "venue-1",
      categoryId: "category-2",
      status: "activo",
      updatedAt: NOW,
    });
  });

  it("can move the player to a group of another venue", async () => {
    const result = await change.execute(input({groupId: "group-2"}));
    expect(result).toMatchObject({
      venueId: "venue-2",
      categoryId: "category-2",
    });
  });

  it("appends a placement entry to the history", async () => {
    await change.execute(input({reason: "  subió de categoría "}));
    const entries = world.uow.playerHistory.entriesOf("tenant-a", "player-1");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "placement",
      before: {
        groupId: "group-1",
        venueId: "venue-1",
        categoryId: "category-1",
      },
      after: {groupId: "group-3", venueId: "venue-1", categoryId: "category-2"},
      reason: "subió de categoría",
      actorUid: "owner-1",
      at: NOW,
    });
  });

  it("stores a missing reason as null", async () => {
    await change.execute(input());
    const [entry] = world.uow.playerHistory.entriesOf("tenant-a", "player-1");
    expect(entry.reason).toBeNull();
  });

  it("records player.placement_changed in the audit log", async () => {
    await change.execute({...input(), device: {userAgent: "test"}});
    expect(world.auditLog.entries).toHaveLength(1);
    expect(world.auditLog.entries[0]).toMatchObject({
      actorUid: "owner-1",
      actorRole: "owner",
      action: "player.placement_changed",
      target: {type: "player", id: "player-1"},
      before: {
        groupId: "group-1",
        venueId: "venue-1",
        categoryId: "category-1",
      },
      after: {groupId: "group-3", venueId: "venue-1", categoryId: "category-2"},
      device: {userAgent: "test"},
    });
  });

  it("rolls the move and the history back when the audit write fails", async () => {
    world.auditLog.failWith = new Error("audit down");
    await expect(change.execute(input())).rejects.toThrow("audit down");
    const saved = await world.uow.players.get("tenant-a", "player-1");
    expect(saved!.groupId).toBe("group-1");
    expect(world.uow.playerHistory.entriesOf("tenant-a", "player-1")).toEqual(
      [],
    );
  });

  describe("destination group", () => {
    it("answers 409 when the player is already in that group", async () => {
      const error = await failure(change.execute(input({groupId: "group-1"})));
      expect(error.code).toBe("failed_precondition");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it("answers 409 when the group is closed", async () => {
      await world.uow.groups.save(
        buildGroup({id: "group-3", status: "closed"}),
      );
      const error = await failure(change.execute(input()));
      expect(error.code).toBe("failed_precondition");
    });

    it("fails with not_found for a missing group", async () => {
      const error = await failure(change.execute(input({groupId: "missing"})));
      expect(error.code).toBe("not_found");
    });

    it("fails with not_found for a group of another organization", async () => {
      await world.uow.groups.save(
        buildGroup({id: "group-b", tenantId: "tenant-b"}),
      );
      const error = await failure(change.execute(input({groupId: "group-b"})));
      expect(error.code).toBe("not_found");
    });
  });

  describe("permissions", () => {
    it("lets an accountant move a player", async () => {
      await expect(
        change.execute(input({actorUid: "acc-1"})),
      ).resolves.toMatchObject({groupId: "group-3"});
    });

    it("lets a coordinator move a player between groups of their venues", async () => {
      await expect(
        change.execute(input({actorUid: "coord-1"})),
      ).resolves.toMatchObject({groupId: "group-3"});
    });

    it("denies a coordinator a destination in another venue", async () => {
      const error = await failure(
        change.execute(input({actorUid: "coord-1", groupId: "group-2"})),
      );
      expect(error.code).toBe("permission_denied");
      const saved = await world.uow.players.get("tenant-a", "player-1");
      expect(saved!.groupId).toBe("group-1");
      expect(world.auditLog.entries).toHaveLength(0);
    });

    it("denies a coordinator a player of another venue", async () => {
      const error = await failure(
        change.execute(input({actorUid: "coord-2", groupId: "group-2"})),
      );
      expect(error.code).toBe("permission_denied");
    });

    it.each(["teacher-1", "nobody"])("denies %s", async (uid) => {
      const error = await failure(change.execute(input({actorUid: uid})));
      expect(error.code).toBe("permission_denied");
    });

    it("fails with not_found for a missing player", async () => {
      const error = await failure(change.execute(input({playerId: "missing"})));
      expect(error.code).toBe("not_found");
    });
  });
});
