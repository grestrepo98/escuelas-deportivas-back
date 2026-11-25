import {beforeEach, describe, expect, it} from "vitest";
import {GetDownloadUrl} from "../../../../src/document/application/get-download-url.js";
import type {PlayerDocument} from "../../../../src/document/domain/document.js";
import {
  createDocumentWorld,
  failure,
  TENANT,
  type DocumentWorld,
} from "../../../../src/document/application/testing/world.js";

let world: DocumentWorld;
let useCase: GetDownloadUrl;
const IDENTITY_PATH = `tenants/${TENANT}/players/player-1/documents/d-id`;
const PHOTO_PATH = `tenants/${TENANT}/players/player-1/documents/photo-id`;

const doc = (overrides: Partial<PlayerDocument>): PlayerDocument => ({
  id: "d-id",
  tenantId: TENANT,
  playerId: "player-1",
  type: "identity",
  status: "current",
  file: {path: IDENTITY_PATH, contentType: "application/pdf", size: 10},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  createdBy: "owner-1",
  ...overrides,
});

beforeEach(async () => {
  world = await createDocumentWorld();
  useCase = new GetDownloadUrl(
    world.uow,
    world.players,
    world.storage,
    world.clock,
  );
  world.storage.put(IDENTITY_PATH, {
    contentType: "application/pdf",
    size: 10,
    createdAt: world.now,
  });
  world.storage.put(PHOTO_PATH, {
    contentType: "image/png",
    size: 5,
    createdAt: world.now,
  });
  await world.uow.documents.save(doc({}));
  await world.uow.documents.save(
    doc({
      id: "photo-id",
      type: "photo",
      file: {path: PHOTO_PATH, contentType: "image/png", size: 5},
    }),
  );
  await world.uow.documents.save(
    doc({id: "nofile", type: "policy", file: undefined}),
  );
});

const input = (overrides = {}) => ({
  tenantId: TENANT,
  actorUid: "owner-1",
  playerId: "player-1",
  documentId: "d-id",
  ...overrides,
});

describe("GetDownloadUrl", () => {
  it("returns a link that expires in 5 minutes", async () => {
    const link = await useCase.execute(input());
    expect(link.url).toContain(IDENTITY_PATH);
    expect(link.expiresAt).toEqual(
      new Date(world.now.getTime() + 5 * 60 * 1000),
    );
  });

  it("lets a teacher download a photo but not an identity document", async () => {
    await expect(
      useCase.execute(input({actorUid: "teacher-1", documentId: "photo-id"})),
    ).resolves.toBeDefined();
    const error = await failure(
      useCase.execute(input({actorUid: "teacher-1"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("denies a coordinator of another venue", async () => {
    const error = await failure(useCase.execute(input({actorUid: "coord-2"})));
    expect(error.code).toBe("permission_denied");
  });

  it("answers not_found for an unknown document or one of another player", async () => {
    const unknown = await failure(useCase.execute(input({documentId: "x"})));
    expect(unknown.code).toBe("not_found");
    const other = await failure(useCase.execute(input({playerId: "player-3"})));
    expect(other.code).toBe("not_found");
  });

  it("answers not_found for an unknown player", async () => {
    const error = await failure(useCase.execute(input({playerId: "nobody"})));
    expect(error.code).toBe("not_found");
  });

  it("fails when the document has no file", async () => {
    const error = await failure(useCase.execute(input({documentId: "nofile"})));
    expect(error.code).toBe("failed_precondition");
  });
});
