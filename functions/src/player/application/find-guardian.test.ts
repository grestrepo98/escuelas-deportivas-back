import {beforeEach, describe, expect, it} from "vitest";
import {FindGuardian, type FindGuardianInput} from "./find-guardian.js";
import {buildGuardian, buildPlayer} from "./testing/fixtures.js";
import {createWorld, failure, type World} from "./testing/world.js";

let world: World;
let find: FindGuardian;

const input = (
  overrides: Partial<FindGuardianInput> = {},
): FindGuardianInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  documentType: "CC",
  documentNumber: "1.020.304",
  ...overrides,
});

beforeEach(async () => {
  world = await createWorld();
  find = new FindGuardian(world.uow);
  await world.uow.guardians.save(buildGuardian());
  await world.uow.players.save(
    buildPlayer({guardianIds: ["guardian-1"], venueId: "venue-1"}),
  );
});

describe("FindGuardian", () => {
  it("finds a guardian by document, however the number is written", async () => {
    const result = await find.execute(input());
    expect(result.guardian).toEqual(buildGuardian());
  });

  it("returns null when no guardian has that document", async () => {
    expect(await find.execute(input({documentNumber: "999"}))).toEqual({
      guardian: null,
    });
  });

  it("does not match another document type", async () => {
    expect(await find.execute(input({documentType: "TI"}))).toEqual({
      guardian: null,
    });
  });

  it("does not find a guardian of another organization", async () => {
    await world.uow.guardians.save(
      buildGuardian({
        id: "guardian-b",
        tenantId: "tenant-b",
        documentKey: "CC:5",
      }),
    );
    expect(await find.execute(input({documentNumber: "5"}))).toEqual({
      guardian: null,
    });
  });

  it("lets an accountant find any guardian", async () => {
    const result = await find.execute(input({actorUid: "acc-1"}));
    expect(result.guardian?.id).toBe("guardian-1");
  });

  it("lets a coordinator find a guardian linked to a player of their venue", async () => {
    const result = await find.execute(input({actorUid: "coord-1"}));
    expect(result.guardian?.id).toBe("guardian-1");
  });

  it("returns null to a coordinator when the guardian has no player in their venues", async () => {
    expect(await find.execute(input({actorUid: "coord-2"}))).toEqual({
      guardian: null,
    });
  });

  it.each(["teacher-1", "nobody"])("denies %s", async (uid) => {
    const error = await failure(find.execute(input({actorUid: uid})));
    expect(error.code).toBe("permission_denied");
  });

  it("rejects a blank document number", async () => {
    const error = await failure(find.execute(input({documentNumber: " . "})));
    expect(error.code).toBe("invalid_argument");
  });
});
