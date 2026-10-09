import {beforeEach, describe, expect, it} from "vitest";
import {ListCategoryPolicies} from "../../../../src/document/application/list-category-policies.js";
import {
  createDocumentWorld,
  failure,
  player,
  TENANT,
  type DocumentWorld,
} from "../../../../src/document/application/testing/world.js";

let world: DocumentWorld;
let useCase: ListCategoryPolicies;

const POLICY = {
  number: "P",
  insurer: "S",
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
};

beforeEach(async () => {
  world = await createDocumentWorld();
  useCase = new ListCategoryPolicies(world.uow, world.players, world.clock);
  world.players.add(
    TENANT,
    player({
      id: "player-4",
      fullName: "Zapata Leo",
      groupId: "group-0",
      venueId: "venue-2",
    }),
  );
  await world.uow.documents.save({
    id: "pol-1",
    tenantId: TENANT,
    playerId: "player-1",
    type: "policy",
    status: "current",
    policy: POLICY,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    createdBy: "owner-1",
  });
});

const input = (overrides = {}) => ({
  tenantId: TENANT,
  actorUid: "owner-1",
  categoryId: "category-1",
  ...overrides,
});

describe("ListCategoryPolicies", () => {
  it("lists every player of the category, including those without a policy", async () => {
    const {items} = await useCase.execute(input());
    expect(items.map((i) => i.playerId).sort()).toEqual([
      "player-1",
      "player-3",
      "player-4",
    ]);
    expect(items.find((i) => i.playerId === "player-1")).toMatchObject({
      fullName: "Perez Juan",
      groupId: "group-1",
      policy: POLICY,
      policyStatus: "valid",
    });
    const missing = items.find((i) => i.playerId === "player-3")!;
    expect(missing.policyStatus).toBe("missing");
    expect(missing.policy).toBeUndefined();
  });

  it("orders by group and then name", async () => {
    const {items} = await useCase.execute(input());
    expect(items.map((i) => `${i.groupId}/${i.fullName}`)).toEqual([
      "group-0/Zapata Leo",
      "group-1/Abad Luis",
      "group-1/Perez Juan",
    ]);
  });

  it("shows a coordinator only the players of their venues", async () => {
    const {items} = await useCase.execute(input({actorUid: "coord-1"}));
    expect(items.map((i) => i.playerId).sort()).toEqual([
      "player-1",
      "player-3",
    ]);
  });

  it("denies teachers", async () => {
    const error = await failure(
      useCase.execute(input({actorUid: "teacher-1"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("answers not_found for an unknown category", async () => {
    const error = await failure(useCase.execute(input({categoryId: "nope"})));
    expect(error.code).toBe("not_found");
  });
});
