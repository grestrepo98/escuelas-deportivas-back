import {beforeEach, describe, expect, it} from "vitest";
import {RecordDocument} from "../../../../src/document/application/record-document.js";
import {
  clientUploads,
  createDocumentWorld,
  failure,
  TENANT,
  type DocumentWorld,
} from "../../../../src/document/application/testing/world.js";

let world: DocumentWorld;
let useCase: RecordDocument;

beforeEach(async () => {
  world = await createDocumentWorld();
  useCase = new RecordDocument(
    world.uow,
    world.players,
    world.storage,
    world.clock,
  );
});

const POLICY = {
  number: "P-1",
  insurer: "Seguros",
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
};

const input = (overrides = {}) => ({
  tenantId: TENANT,
  actorUid: "owner-1",
  playerId: "player-1",
  type: "identity" as const,
  uploadId: "up-1",
  ...overrides,
});

const pdf = {contentType: "application/pdf", size: 1000};
const uploadPath = (id: string) => `uploads/${TENANT}/${id}`;
const finalPath = (id: string, playerId = "player-1") =>
  `tenants/${TENANT}/players/${playerId}/documents/${id}`;

describe("RecordDocument — file documents", () => {
  it("moves the upload to its final path and records the document", async () => {
    clientUploads(world, "up-1", pdf);
    const {document} = await useCase.execute(input());
    expect(document).toMatchObject({
      id: "up-1",
      tenantId: TENANT,
      playerId: "player-1",
      type: "identity",
      status: "current",
      createdBy: "owner-1",
      createdAt: world.now,
      file: {path: finalPath("up-1"), ...pdf},
    });
    expect(await world.storage.stat(uploadPath("up-1"))).toBeNull();
    expect(await world.storage.stat(finalPath("up-1"))).not.toBeNull();
    expect(await world.uow.documents.get(TENANT, "up-1")).toEqual(document);
    expect(world.auditLog.entries.map((e) => e.action)).toEqual([
      "document.recorded",
    ]);
  });

  it("reads type and size from the stored object, not from the client", async () => {
    clientUploads(world, "up-1", {
      contentType: "application/pdf",
      size: 11 * 1024 * 1024,
    });
    const error = await failure(useCase.execute(input()));
    expect(error.code).toBe("invalid_argument");
    expect(await world.uow.documents.get(TENANT, "up-1")).toBeNull();
    expect(world.auditLog.entries).toHaveLength(0);
  });

  it("rejects an object whose type does not fit the declared document", async () => {
    clientUploads(world, "up-1", pdf);
    const error = await failure(useCase.execute(input({type: "photo"})));
    expect(error.code).toBe("invalid_argument");
    expect(await world.uow.documents.get(TENANT, "up-1")).toBeNull();
  });

  it("rejects an unknown upload", async () => {
    const error = await failure(useCase.execute(input({uploadId: "nope"})));
    expect(error.code).toBe("invalid_argument");
  });

  it("rejects an upload older than a day", async () => {
    clientUploads(world, "up-1", {
      ...pdf,
      createdAt: new Date(world.now.getTime() - 25 * 60 * 60 * 1000),
    });
    const error = await failure(useCase.execute(input()));
    expect(error.code).toBe("invalid_argument");
  });

  it("requires an uploadId for non-policy types", async () => {
    const error = await failure(useCase.execute(input({uploadId: undefined})));
    expect(error.code).toBe("invalid_argument");
  });

  it("rejects policy data on a non-policy document", async () => {
    clientUploads(world, "up-1", pdf);
    const error = await failure(useCase.execute(input({policy: POLICY})));
    expect(error.code).toBe("invalid_argument");
  });

  it("is idempotent: confirming the same upload twice returns the same document", async () => {
    clientUploads(world, "up-1", pdf);
    const first = await useCase.execute(input());
    const second = await useCase.execute(input());
    expect(second.document).toEqual(first.document);
    expect(world.auditLog.entries).toHaveLength(1);
  });

  it("does not let another player or type claim a confirmed upload", async () => {
    clientUploads(world, "up-1", pdf);
    await useCase.execute(input());
    const otherPlayer = await failure(
      useCase.execute(input({playerId: "player-3"})),
    );
    expect(otherPlayer.code).toBe("invalid_argument");
    const otherType = await failure(
      useCase.execute(input({type: "policy", policy: POLICY})),
    );
    expect(otherType.code).toBe("invalid_argument");
  });

  it("finishes a confirm whose move happened but whose record was lost", async () => {
    world.storage.put(finalPath("up-1"), {...pdf, createdAt: world.now});
    const {document} = await useCase.execute(input());
    expect(document.file?.path).toBe(finalPath("up-1"));
  });
});

describe("RecordDocument — versions", () => {
  it("supersedes the current document of the same type and audits both", async () => {
    clientUploads(world, "up-1", pdf);
    await useCase.execute(input());
    clientUploads(world, "up-2", pdf);
    const {document} = await useCase.execute(input({uploadId: "up-2"}));

    const old = (await world.uow.documents.get(TENANT, "up-1"))!;
    expect(old).toMatchObject({status: "superseded", supersededBy: "up-2"});
    expect(document.status).toBe("current");
    const current = await world.uow.documents.listByPlayer(TENANT, "player-1", {
      includeSuperseded: false,
    });
    expect(current.map((d) => d.id)).toEqual(["up-2"]);
    expect(world.auditLog.entries.map((e) => e.action)).toEqual([
      "document.recorded",
      "document.recorded",
      "document.superseded",
    ]);
    expect(world.auditLog.entries[2]).toMatchObject({
      target: {type: "document", id: "up-1"},
      after: {supersededBy: "up-2"},
    });
  });

  it("keeps other types and other players untouched", async () => {
    clientUploads(world, "up-1", pdf);
    await useCase.execute(input());
    clientUploads(world, "up-2", pdf);
    await useCase.execute(
      input({uploadId: "up-2", type: "medicalCertificate"}),
    );
    clientUploads(world, "up-3", pdf);
    await useCase.execute(input({uploadId: "up-3", playerId: "player-3"}));
    expect((await world.uow.documents.get(TENANT, "up-1"))!.status).toBe(
      "current",
    );
  });
});

describe("RecordDocument — policies", () => {
  it("records a policy without a file", async () => {
    const result = await useCase.execute(
      input({type: "policy", uploadId: undefined, policy: POLICY}),
    );
    expect(result.document.file).toBeUndefined();
    expect(result.document.policy).toEqual(POLICY);
    expect(result.document.id).toBe("generated-document-1");
    expect(result.policyStatus).toBe("valid");
  });

  it("records a policy with its file", async () => {
    clientUploads(world, "up-1", pdf);
    const result = await useCase.execute(
      input({type: "policy", policy: POLICY}),
    );
    expect(result.document.file?.path).toBe(finalPath("up-1"));
    expect(result.document.policy).toEqual(POLICY);
  });

  it("attaches the file later as a new version", async () => {
    await useCase.execute(
      input({type: "policy", uploadId: undefined, policy: POLICY}),
    );
    clientUploads(world, "up-1", pdf);
    await useCase.execute(input({type: "policy", policy: POLICY}));
    const all = await world.uow.documents.listByPlayer(TENANT, "player-1", {
      includeSuperseded: true,
    });
    expect(all.map((d) => d.status).sort()).toEqual(["current", "superseded"]);
  });

  it("requires the policy data", async () => {
    const error = await failure(
      useCase.execute(input({type: "policy", uploadId: undefined})),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("validates the policy data", async () => {
    const error = await failure(
      useCase.execute(
        input({
          type: "policy",
          uploadId: undefined,
          policy: {...POLICY, validUntil: "2025-12-31"},
        }),
      ),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("reports expiring and expired using the tenant warning window", async () => {
    const expiring = await useCase.execute(
      input({
        type: "policy",
        uploadId: undefined,
        policy: {...POLICY, validUntil: "2026-10-15"},
      }),
    );
    expect(expiring.policyStatus).toBe("expiring");
    const expired = await useCase.execute(
      input({
        type: "policy",
        uploadId: undefined,
        policy: {...POLICY, validUntil: "2026-10-04"},
      }),
    );
    expect(expired.policyStatus).toBe("expired");
  });
});

describe("RecordDocument — permissions", () => {
  it.each(["coord-2", "teacher-1", "ghost"])("denies %s", async (actorUid) => {
    clientUploads(world, "up-1", pdf);
    const error = await failure(useCase.execute(input({actorUid})));
    expect(error.code).toBe("permission_denied");
    expect(await world.uow.documents.get(TENANT, "up-1")).toBeNull();
    expect(await world.storage.stat(uploadPath("up-1"))).not.toBeNull();
  });

  it("answers not_found for an unknown player", async () => {
    clientUploads(world, "up-1", pdf);
    const error = await failure(useCase.execute(input({playerId: "nobody"})));
    expect(error.code).toBe("not_found");
  });
});
