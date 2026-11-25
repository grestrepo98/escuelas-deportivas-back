import {beforeEach, describe, expect, it} from "vitest";
import {ListPlayerDocuments} from "../../../../src/document/application/list-player-documents.js";
import type {PlayerDocument} from "../../../../src/document/domain/document.js";
import {
  createDocumentWorld,
  failure,
  TENANT,
  type DocumentWorld,
} from "../../../../src/document/application/testing/world.js";

let world: DocumentWorld;
let useCase: ListPlayerDocuments;

const doc = (overrides: Partial<PlayerDocument>): PlayerDocument => ({
  id: "d",
  tenantId: TENANT,
  playerId: "player-1",
  type: "identity",
  status: "current",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  createdBy: "owner-1",
  ...overrides,
});

const POLICY = {
  number: "P",
  insurer: "S",
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
};

beforeEach(async () => {
  world = await createDocumentWorld();
  useCase = new ListPlayerDocuments(world.uow, world.players, world.clock);
  const {documents} = world.uow;
  await documents.save(doc({id: "id-old", status: "superseded"}));
  await documents.save(
    doc({id: "id-new", createdAt: new Date("2026-10-02T00:00:00Z")}),
  );
  await documents.save(doc({id: "photo", type: "photo"}));
  await documents.save(doc({id: "med", type: "medicalCertificate"}));
  await documents.save(doc({id: "pol", type: "policy", policy: POLICY}));
  await documents.save(doc({id: "other", playerId: "player-3"}));
});

const input = (overrides = {}) => ({
  tenantId: TENANT,
  actorUid: "owner-1",
  playerId: "player-1",
  ...overrides,
});

describe("ListPlayerDocuments", () => {
  it("hides superseded versions by default", async () => {
    const {documents} = await useCase.execute(input());
    expect(documents.map((d) => d.id).sort()).toEqual([
      "id-new",
      "med",
      "photo",
      "pol",
    ]);
  });

  it("includes superseded versions with history", async () => {
    const {documents} = await useCase.execute(input({history: true}));
    expect(documents.map((d) => d.id)).toContain("id-old");
  });

  it("returns the policy status", async () => {
    expect((await useCase.execute(input())).policyStatus).toBe("valid");
    expect(
      (await useCase.execute(input({playerId: "player-3"}))).policyStatus,
    ).toBe("missing");
  });

  it("lets a teacher of the group see only photo and policy", async () => {
    const result = await useCase.execute(input({actorUid: "teacher-1"}));
    expect(result.documents.map((d) => d.id).sort()).toEqual(["photo", "pol"]);
    expect(result.policyStatus).toBe("valid");
  });

  it("denies a teacher outside the group", async () => {
    const error = await failure(
      useCase.execute(input({actorUid: "teacher-1", playerId: "player-2"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("lets a coordinator read their venue and denies another", async () => {
    await expect(
      useCase.execute(input({actorUid: "coord-1"})),
    ).resolves.toBeDefined();
    const error = await failure(useCase.execute(input({actorUid: "coord-2"})));
    expect(error.code).toBe("permission_denied");
  });

  it("denies users without a reading role", async () => {
    await world.memberships.save({
      ...(await world.memberships.get("owner-1", TENANT))!,
      uid: "guardian-1",
      role: "guardian",
    });
    const error = await failure(
      useCase.execute(input({actorUid: "guardian-1"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("answers not_found for an unknown player", async () => {
    const error = await failure(useCase.execute(input({playerId: "nobody"})));
    expect(error.code).toBe("not_found");
  });
});
