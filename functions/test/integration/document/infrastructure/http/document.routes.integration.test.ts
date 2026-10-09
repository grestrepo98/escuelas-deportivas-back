import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {bogotaDay} from "../../../../../src/document/domain/policy-status.js";
import {buildPlayer} from "../../../../../src/player/application/testing/fixtures.js";
import {
  api,
  db,
  players,
  resetWorld,
  type Caller,
  type World,
} from "../../../../../src/player/infrastructure/http/testing/seed.js";
import {callApi} from "../../../../../src/shared/infrastructure/testing/emulator-helpers.js";
import {FirestoreStructureRepository} from "../../../../../src/structure/infrastructure/firestore/firestore-structure-repository.js";
import {categoryMapper} from "../../../../../src/structure/infrastructure/firestore/structure-mapper.js";

// Spec 07 acceptance criteria over real HTTP: the Functions, Firestore, Auth
// and Storage emulators run together. Signed URLs are not available locally,
// so the emulator adapter points the client at the Storage emulator.

let world: World;
const T = "/tenants/tenant-a";
const docsPath = (playerId = "player-1") =>
  `${T}/players/${playerId}/documents`;
const PDF = "application/pdf";
const MB = 1024 * 1024;
const BYTES = Buffer.from("%PDF-1.4 a small fake pdf");

const call = (
  method: "GET" | "POST",
  path: string,
  caller: World[Caller] | undefined,
  body?: unknown,
) => callApi("documentApi", method, path, body, caller?.idToken);

const POLICY = {
  number: "P-1",
  insurer: "Seguros Bolivar",
  validFrom: "2026-01-01",
  validUntil: "2099-12-31",
};

const dayFromToday = (days: number): string =>
  bogotaDay(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

// Steps 1 and 2 of D-08: ask for the URL and upload straight to Storage.
async function upload(
  caller: World[Caller],
  playerId: string,
  type: string,
  options: {
    body?: Buffer;
    contentType?: string;
    declared?: {contentType: string; size: number};
  } = {},
): Promise<string> {
  const body = options.body ?? BYTES;
  const contentType = options.contentType ?? PDF;
  const declared = options.declared ?? {contentType, size: body.length};
  const ticket = await call("POST", `${docsPath(playerId)}/uploads`, caller, {
    type,
    ...declared,
  });
  expect(ticket.status).toBe(201);
  const response = await fetch(ticket.body.uploadUrl, {
    method: ticket.body.uploadMethod,
    headers: {...ticket.body.uploadHeaders, "Content-Type": contentType},
    body: new Uint8Array(body),
  });
  expect(response.ok).toBe(true);
  return ticket.body.uploadId;
}

const confirm = (
  caller: World[Caller],
  playerId: string,
  body: Record<string, unknown>,
) => call("POST", docsPath(playerId), caller, body);

const audit = async () =>
  (await db.collection("tenants/tenant-a/auditLog").get()).docs.map((d) =>
    d.data(),
  );

const documents = async () =>
  (await db.collection("tenants/tenant-a/documents").get()).docs.map((d) =>
    d.data(),
  );

beforeEach(async () => {
  world = await resetWorld();
  await new FirestoreStructureRepository(db, "categories", categoryMapper).save(
    {
      id: "category-1",
      tenantId: "tenant-a",
      name: "Sub 10",
      birthYears: [2016],
      status: "active",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
  );
});

describe("the three-step flow", () => {
  it("uploads, confirms, lists and downloads a document", async () => {
    const uploadId = await upload(world.owner, "player-1", "identity");
    const confirmed = await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId,
    });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.document).toMatchObject({
      id: uploadId,
      playerId: "player-1",
      type: "identity",
      status: "current",
      file: {contentType: PDF, size: BYTES.length},
    });
    expect(confirmed.body.document.file).not.toHaveProperty("path");
    expect(confirmed.body).not.toHaveProperty("policyStatus");

    const listed = await call("GET", docsPath(), world.owner);
    expect(listed.status).toBe(200);
    expect(listed.body.documents.map((d: {id: string}) => d.id)).toEqual([
      uploadId,
    ]);
    expect(listed.body.policyStatus).toBe("missing");

    const link = await call(
      "GET",
      `${docsPath()}/${uploadId}/download-url`,
      world.owner,
    );
    expect(link.status).toBe(200);
    expect(new Date(link.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const downloaded = await fetch(link.body.url);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(BYTES);

    expect((await audit()).map((e) => e.action).sort()).toEqual([
      "document.recorded",
      "document.uploaded",
    ]);
  });

  it("confirming the same upload twice returns the same document", async () => {
    const uploadId = await upload(world.owner, "player-1", "identity");
    const first = await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId,
    });
    const second = await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId,
    });
    expect(second.status).toBe(201);
    expect(second.body.document).toEqual(first.body.document);
    expect(await documents()).toHaveLength(1);
  });

  it("a second document of the same type supersedes the first", async () => {
    const first = await upload(world.owner, "player-1", "identity");
    await confirm(world.owner, "player-1", {type: "identity", uploadId: first});
    const second = await upload(world.owner, "player-1", "identity");
    await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId: second,
    });

    const current = await call("GET", docsPath(), world.owner);
    expect(current.body.documents.map((d: {id: string}) => d.id)).toEqual([
      second,
    ]);
    const history = await call(
      "GET",
      `${docsPath()}?history=true`,
      world.owner,
    );
    expect(history.body.documents).toHaveLength(2);
    const old = history.body.documents.find(
      (d: {id: string}) => d.id === first,
    );
    expect(old).toMatchObject({status: "superseded", supersededBy: second});
    expect(
      (await audit()).filter((e) => e.action === "document.superseded"),
    ).toHaveLength(1);
  });
});

describe("limits", () => {
  it("accepts a 10 MB PDF policy and rejects 11 MB or a 3 MB photo", async () => {
    const ok = await call("POST", `${docsPath()}/uploads`, world.owner, {
      type: "policy",
      contentType: PDF,
      size: 10 * MB,
    });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({
      uploadId: expect.any(String),
      uploadUrl: expect.any(String),
      uploadMethod: expect.stringMatching(/^(PUT|POST)$/),
      uploadHeaders: expect.any(Object),
      expiresAt: expect.any(String),
    });
    const tooBig = await call("POST", `${docsPath()}/uploads`, world.owner, {
      type: "policy",
      contentType: PDF,
      size: 11 * MB,
    });
    expect(tooBig.status).toBe(400);
    const photo = await call("POST", `${docsPath()}/uploads`, world.owner, {
      type: "photo",
      contentType: "image/jpeg",
      size: 3 * MB,
    });
    expect(photo.status).toBe(400);
  });

  it("rejects an object that does not match what was declared", async () => {
    const wrongType = await upload(world.owner, "player-1", "identity", {
      contentType: "image/gif",
      declared: {contentType: PDF, size: BYTES.length},
    });
    const byType = await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId: wrongType,
    });
    expect(byType.status).toBe(400);

    const tooBig = await upload(world.owner, "player-1", "photo", {
      body: Buffer.alloc(3 * MB),
      contentType: "image/png",
      declared: {contentType: "image/png", size: 1000},
    });
    const bySize = await confirm(world.owner, "player-1", {
      type: "photo",
      uploadId: tooBig,
    });
    expect(bySize.status).toBe(400);
    expect(await documents()).toHaveLength(0);
  });

  it("rejects an unknown upload id", async () => {
    const response = await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId: "never-uploaded",
    });
    expect(response.status).toBe(400);
  });
});

describe("policies", () => {
  const record = (policy: object, caller = world.owner) =>
    confirm(caller, "player-1", {type: "policy", policy});

  it("records a policy without a file and reports its status", async () => {
    const response = await record({
      ...POLICY,
      validUntil: dayFromToday(60),
    });
    expect(response.status).toBe(201);
    expect(response.body.document).not.toHaveProperty("file");
    expect(response.body.policyStatus).toBe("valid");
  });

  it("reports expiring, expired and the last day as not expired", async () => {
    expect(
      (await record({...POLICY, validUntil: dayFromToday(10)})).body
        .policyStatus,
    ).toBe("expiring");
    expect(
      (await record({...POLICY, validUntil: dayFromToday(-1)})).body
        .policyStatus,
    ).toBe("expired");
    expect(
      (await record({...POLICY, validUntil: dayFromToday(0)})).body
        .policyStatus,
    ).toBe("expiring");
    const listed = await call("GET", docsPath(), world.owner);
    expect(listed.body.policyStatus).toBe("expiring");
  });

  it("uses the warning window configured for the organization", async () => {
    await db.doc("tenants/tenant-a").set({
      name: "Argentinos",
      status: "active",
      contact: {},
      policyWarningDays: 5,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    const response = await record({...POLICY, validUntil: dayFromToday(10)});
    expect(response.body.policyStatus).toBe("valid");
  });

  it("attaches the file later as a new version", async () => {
    await record({...POLICY, validUntil: dayFromToday(60)});
    const uploadId = await upload(world.owner, "player-1", "policy");
    const response = await confirm(world.owner, "player-1", {
      type: "policy",
      uploadId,
      policy: {...POLICY, validUntil: dayFromToday(60)},
    });
    expect(response.status).toBe(201);
    expect(response.body.document.file).toBeDefined();
    const history = await call(
      "GET",
      `${docsPath()}?history=true`,
      world.owner,
    );
    expect(history.body.documents).toHaveLength(2);
  });

  it.each([
    ["no policy data", {type: "policy"}],
    [
      "an impossible date",
      {type: "policy", policy: {...POLICY, validUntil: "2026-02-30"}},
    ],
    [
      "a policy ending before it starts",
      {type: "policy", policy: {...POLICY, validUntil: "2025-01-01"}},
    ],
    ["policy data on another type", {type: "identity", policy: POLICY}],
    ["an identity without upload", {type: "identity"}],
  ])("rejects %s", async (_name, body) => {
    const response = await confirm(world.owner, "player-1", body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_argument");
  });
});

describe("who can do what", () => {
  it.each<Caller>(["accountant", "coordinator"])(
    "lets %s upload and read",
    async (caller) => {
      const uploadId = await upload(world[caller], "player-1", "identity");
      const response = await confirm(world[caller], "player-1", {
        type: "identity",
        uploadId,
      });
      expect(response.status).toBe(201);
      expect((await call("GET", docsPath(), world[caller])).status).toBe(200);
    },
  );

  it("lets a teacher of the group read only photo and policy", async () => {
    const identity = await upload(world.owner, "player-1", "identity");
    await confirm(world.owner, "player-1", {
      type: "identity",
      uploadId: identity,
    });
    const photo = await upload(world.owner, "player-1", "photo", {
      contentType: "image/png",
    });
    await confirm(world.owner, "player-1", {type: "photo", uploadId: photo});
    await confirm(world.owner, "player-1", {
      type: "policy",
      policy: {...POLICY, validUntil: dayFromToday(60)},
    });

    const listed = await call("GET", docsPath(), world.teacher);
    expect(listed.status).toBe(200);
    expect(
      listed.body.documents.map((d: {type: string}) => d.type).sort(),
    ).toEqual(["photo", "policy"]);
    expect(listed.body.policyStatus).toBe("valid");

    expect(
      (await call("GET", `${docsPath()}/${photo}/download-url`, world.teacher))
        .status,
    ).toBe(200);
    expect(
      (
        await call(
          "GET",
          `${docsPath()}/${identity}/download-url`,
          world.teacher,
        )
      ).status,
    ).toBe(403);
  });

  it("denies a teacher of another group", async () => {
    expect((await call("GET", docsPath(), world.teacherOther)).status).toBe(
      403,
    );
  });

  it.each<Caller>(["teacher", "teacherOther", "guardian", "adultPlayer"])(
    "denies %s uploading or confirming",
    async (caller) => {
      const ticket = await call(
        "POST",
        `${docsPath()}/uploads`,
        world[caller],
        {
          type: "photo",
          contentType: "image/png",
          size: 10,
        },
      );
      expect(ticket.status).toBe(403);
      const response = await confirm(world[caller], "player-1", {
        type: "policy",
        policy: POLICY,
      });
      expect(response.status).toBe(403);
    },
  );

  it.each<Caller>(["guardian", "adultPlayer"])(
    "denies %s reading",
    async (caller) => {
      expect((await call("GET", docsPath(), world[caller])).status).toBe(403);
      expect(
        (await call("GET", `${docsPath()}/any/download-url`, world[caller]))
          .status,
      ).toBe(403);
    },
  );

  it("denies a coordinator of another venue everywhere", async () => {
    const caller = world.coordinatorOther;
    expect((await call("GET", docsPath(), caller)).status).toBe(403);
    expect(
      (
        await call("POST", `${docsPath()}/uploads`, caller, {
          type: "photo",
          contentType: "image/png",
          size: 10,
        })
      ).status,
    ).toBe(403);
    expect(
      (await confirm(caller, "player-1", {type: "policy", policy: POLICY}))
        .status,
    ).toBe(403);
    expect(await documents()).toHaveLength(0);
  });
});

describe("authentication and tenant isolation", () => {
  const routes: ["GET" | "POST", string, unknown?][] = [
    [
      "POST",
      `${docsPath()}/uploads`,
      {type: "photo", contentType: "image/png", size: 1},
    ],
    ["POST", docsPath(), {type: "policy", policy: POLICY}],
    ["GET", docsPath()],
    ["GET", `${docsPath()}/any/download-url`],
    ["GET", `${T}/categories/category-1/policies`],
  ];

  it.each(routes)("%s %s answers 401 without a token", async (m, p, body) => {
    const response = await call(m, p, undefined, body);
    expect(response.status).toBe(401);
  });

  it.each(routes)("%s %s answers 403 to another tenant", async (m, p, body) => {
    const response = await call(m, p, world.ownerB, body);
    expect(response.status).toBe(403);
  });

  it("answers 404 for a player or document of another tenant", async () => {
    const own = "/tenants/tenant-b";
    expect(
      (await call("GET", `${own}/players/player-1/documents`, world.ownerB))
        .status,
    ).toBe(404);
    expect(
      (
        await call(
          "POST",
          `${own}/players/player-1/documents/uploads`,
          world.ownerB,
          {
            type: "photo",
            contentType: "image/png",
            size: 1,
          },
        )
      ).status,
    ).toBe(404);

    const uploadId = await upload(world.owner, "player-1", "identity");
    await confirm(world.owner, "player-1", {type: "identity", uploadId});
    await players.save(buildPlayer({id: "player-b", tenantId: "tenant-b"}));
    const stolen = await call(
      "GET",
      `${own}/players/player-b/documents/${uploadId}/download-url`,
      world.ownerB,
    );
    expect(stolen.status).toBe(404);
    const unknown = await call(
      "GET",
      `${docsPath()}/nope/download-url`,
      world.owner,
    );
    expect(unknown.status).toBe(404);
  });
});

describe("GET /categories/:categoryId/policies", () => {
  beforeEach(async () => {
    await players.save(buildPlayer({id: "player-3", lastNames: "Abad"}));
    await players.save(
      buildPlayer({
        id: "player-4",
        lastNames: "Zapata",
        groupId: "group-9",
        venueId: "venue-2",
      }),
    );
    await confirm(world.owner, "player-1", {
      type: "policy",
      policy: {...POLICY, validUntil: dayFromToday(60)},
    });
  });

  const list = (caller: World[Caller], category = "category-1") =>
    call("GET", `${T}/categories/${category}/policies`, caller);

  it("includes players without a policy, ordered by group and name", async () => {
    const response = await list(world.owner);
    expect(response.status).toBe(200);
    expect(
      response.body.items.map(
        (i: {playerId: string; policyStatus: string}) =>
          `${i.playerId}:${i.policyStatus}`,
      ),
    ).toEqual(["player-3:missing", "player-1:valid", "player-4:missing"]);
    expect(response.body.items[1].policy).toMatchObject({number: "P-1"});
    expect(response.body.items[0]).not.toHaveProperty("policy");
  });

  it("shows a coordinator only their venue", async () => {
    const response = await list(world.coordinator);
    expect(
      response.body.items.map((i: {playerId: string}) => i.playerId).sort(),
    ).toEqual(["player-1", "player-3"]);
    const other = await list(world.coordinatorOther);
    expect(other.body.items.map((i: {playerId: string}) => i.playerId)).toEqual(
      ["player-4"],
    );
  });

  it("denies teachers and families, and answers 404 for an unknown category", async () => {
    expect((await list(world.teacher)).status).toBe(403);
    expect((await list(world.guardian)).status).toBe(403);
    expect((await list(world.owner, "nope")).status).toBe(404);
  });
});

describe("input validation", () => {
  it.each([
    ["an unknown type", {type: "invoice", contentType: PDF, size: 1}],
    ["a missing size", {type: "identity", contentType: PDF}],
    ["a non-numeric size", {type: "identity", contentType: PDF, size: "10"}],
    ["a fractional size", {type: "identity", contentType: PDF, size: 1.5}],
    [
      "a content type that is not allowed",
      {type: "identity", contentType: "image/gif", size: 1},
    ],
    [
      "an unexpected field",
      {type: "identity", contentType: PDF, size: 1, playerId: "x"},
    ],
  ])("rejects %s when requesting an upload", async (_name, body) => {
    const response = await call(
      "POST",
      `${docsPath()}/uploads`,
      world.owner,
      body,
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_argument");
  });

  it.each([
    [
      "an unexpected field",
      {type: "identity", uploadId: "u", status: "current"},
    ],
    ["an upload id that is a path", {type: "identity", uploadId: "../x"}],
    ["an unknown type", {type: "invoice", uploadId: "u"}],
    ["no body", undefined],
  ])("rejects %s when confirming", async (_name, body) => {
    const response = await call("POST", docsPath(), world.owner, body);
    expect(response.status).toBe(400);
  });

  it("rejects unexpected query parameters", async () => {
    expect(
      (await call("GET", `${docsPath()}?history=maybe`, world.owner)).status,
    ).toBe(400);
    expect((await call("GET", `${docsPath()}?foo=1`, world.owner)).status).toBe(
      400,
    );
    expect(
      (await call("GET", `${docsPath()}/x/download-url?foo=1`, world.owner))
        .status,
    ).toBe(400);
  });

  it("answers 404 on an unknown route", async () => {
    const response = await call("GET", `${T}/nothing`, world.owner);
    expect(response.status).toBe(404);
  });
});

describe("module boundary", () => {
  it("does not serve document routes from playerApi", async () => {
    const response = await api("GET", docsPath(), world.owner);
    expect(response.status).toBe(404);
  });
});
