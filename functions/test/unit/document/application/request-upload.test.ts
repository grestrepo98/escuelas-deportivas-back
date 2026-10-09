import {beforeEach, describe, expect, it} from "vitest";
import {RequestUpload} from "../../../../src/document/application/request-upload.js";
import {
  createDocumentWorld,
  failure,
  TENANT,
  type DocumentWorld,
} from "../../../../src/document/application/testing/world.js";

const MB = 1024 * 1024;
let world: DocumentWorld;
let useCase: RequestUpload;

beforeEach(async () => {
  world = await createDocumentWorld();
  useCase = new RequestUpload(
    world.uow,
    world.players,
    world.storage,
    world.clock,
  );
});

const input = (overrides = {}) => ({
  tenantId: TENANT,
  actorUid: "owner-1",
  playerId: "player-1",
  type: "policy" as const,
  contentType: "application/pdf",
  size: 1 * MB,
  ...overrides,
});

describe("RequestUpload", () => {
  it("returns a ticket that expires in 15 minutes and audits it", async () => {
    const ticket = await useCase.execute(input());
    expect(ticket.uploadId).toBeTruthy();
    expect(ticket.uploadUrl).toContain(ticket.uploadId);
    expect(ticket.expiresAt).toEqual(
      new Date(world.now.getTime() + 15 * 60 * 1000),
    );
    expect(world.auditLog.entries).toHaveLength(1);
    expect(world.auditLog.entries[0]).toMatchObject({
      action: "document.uploaded",
      actorUid: "owner-1",
      actorRole: "owner",
      target: {type: "document", id: ticket.uploadId},
      after: {
        playerId: "player-1",
        type: "policy",
        contentType: "application/pdf",
        size: 1 * MB,
      },
    });
  });

  it("accepts a 10 MB policy and rejects an 11 MB one", async () => {
    await useCase.execute(input({size: 10 * MB}));
    const error = await failure(useCase.execute(input({size: 11 * MB})));
    expect(error.code).toBe("invalid_argument");
  });

  it("rejects a 3 MB photo", async () => {
    const error = await failure(
      useCase.execute(
        input({type: "photo", contentType: "image/jpeg", size: 3 * MB}),
      ),
    );
    expect(error.code).toBe("invalid_argument");
    expect(world.auditLog.entries).toHaveLength(0);
  });

  it.each(["acc-1", "coord-1"])("lets %s upload", async (actorUid) => {
    await expect(useCase.execute(input({actorUid}))).resolves.toBeDefined();
  });

  it("denies a coordinator of another venue", async () => {
    const error = await failure(useCase.execute(input({actorUid: "coord-2"})));
    expect(error.code).toBe("permission_denied");
    expect(world.auditLog.entries).toHaveLength(0);
  });

  it("denies a teacher", async () => {
    const error = await failure(
      useCase.execute(input({actorUid: "teacher-1"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("denies a user without membership in the tenant", async () => {
    const error = await failure(useCase.execute(input({actorUid: "ghost"})));
    expect(error.code).toBe("permission_denied");
  });

  it("answers not_found for an unknown player", async () => {
    const error = await failure(useCase.execute(input({playerId: "nobody"})));
    expect(error.code).toBe("not_found");
  });
});
