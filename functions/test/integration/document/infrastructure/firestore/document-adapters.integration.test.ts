import {beforeEach, describe, expect, it} from "vitest";
import type {PlayerDocument} from "../../../../../src/document/domain/document.js";
import {FirestoreDocumentRepository} from "../../../../../src/document/infrastructure/firestore/firestore-document-repository.js";
import {FirestorePlayerReader} from "../../../../../src/document/infrastructure/firestore/firestore-player-reader.js";
import {FirestorePlayerRepository} from "../../../../../src/player/infrastructure/firestore/firestore-player-repository.js";
import {buildPlayer} from "../../../../../src/player/application/testing/fixtures.js";
import {FirestoreUnitOfWork} from "../../../../../src/shared/infrastructure/firestore-unit-of-work.js";
import {
  clearFirestore,
  testDb,
} from "../../../../../src/shared/infrastructure/testing/helpers.js";

const db = testDb();
const documents = new FirestoreDocumentRepository(db);
const T0 = new Date("2026-10-01T00:00:00Z");
const POLICY = {
  number: "P-1",
  insurer: "Seguros",
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
};

const doc = (overrides: Partial<PlayerDocument> = {}): PlayerDocument => ({
  id: "d1",
  tenantId: "tenant-a",
  playerId: "player-1",
  type: "identity",
  status: "current",
  createdAt: T0,
  createdBy: "u1",
  ...overrides,
});

beforeEach(clearFirestore);

describe("FirestoreDocumentRepository", () => {
  it("returns null for a missing document", async () => {
    expect(await documents.get("tenant-a", "nope")).toBeNull();
  });

  it("round-trips a document stored at tenants/{tenantId}/documents/{id}", async () => {
    const full = doc({
      id: "full",
      type: "policy",
      status: "superseded",
      supersededBy: "next",
      file: {
        path: "tenants/tenant-a/players/player-1/documents/full",
        contentType: "application/pdf",
        size: 1234,
      },
      policy: POLICY,
    });
    await documents.save(full);
    expect(await documents.get("tenant-a", "full")).toEqual(full);
    const raw = (await db.doc("tenants/tenant-a/documents/full").get()).data();
    expect(raw).not.toHaveProperty("id");
    expect(raw).not.toHaveProperty("tenantId");
  });

  it("does not store absent optional fields", async () => {
    await documents.save(doc());
    const raw = (await db.doc("tenants/tenant-a/documents/d1").get()).data()!;
    expect(raw).not.toHaveProperty("file");
    expect(raw).not.toHaveProperty("policy");
    expect(raw).not.toHaveProperty("supersededBy");
    expect(await documents.get("tenant-a", "d1")).toEqual(doc());
  });

  it("isolates tenants", async () => {
    await documents.save(doc());
    expect(await documents.get("tenant-b", "d1")).toBeNull();
    expect(
      await documents.listByPlayer("tenant-b", "player-1", {
        includeSuperseded: true,
      }),
    ).toEqual([]);
  });

  it("generates distinct ids without touching Firestore", () => {
    expect(documents.newId()).not.toBe(documents.newId());
  });

  it("finds the current document of a player and type", async () => {
    await documents.save(doc({id: "old", status: "superseded"}));
    await documents.save(doc({id: "new"}));
    await documents.save(doc({id: "photo", type: "photo"}));
    await documents.save(doc({id: "other", playerId: "player-2"}));
    expect(
      (await documents.findCurrent("tenant-a", "player-1", "identity"))!.id,
    ).toBe("new");
    expect(
      await documents.findCurrent("tenant-a", "player-1", "policy"),
    ).toBeNull();
  });

  it("lists a player's documents newest first, with or without superseded", async () => {
    await documents.save(doc({id: "a", status: "superseded"}));
    await documents.save(
      doc({
        id: "b",
        type: "photo",
        createdAt: new Date("2026-10-02T00:00:00Z"),
      }),
    );
    await documents.save(doc({id: "c", playerId: "player-2"}));
    const current = await documents.listByPlayer("tenant-a", "player-1", {
      includeSuperseded: false,
    });
    expect(current.map((d) => d.id)).toEqual(["b"]);
    const all = await documents.listByPlayer("tenant-a", "player-1", {
      includeSuperseded: true,
    });
    expect(all.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("lists current policies for more than 30 players", async () => {
    const ids = Array.from({length: 65}, (_, i) => `player-${i}`);
    for (const playerId of ids) {
      await documents.save(
        doc({id: `pol-${playerId}`, playerId, type: "policy", policy: POLICY}),
      );
    }
    await documents.save(
      doc({
        id: "old",
        playerId: "player-0",
        type: "policy",
        status: "superseded",
      }),
    );
    await documents.save(doc({id: "not-policy", playerId: "player-0"}));
    await documents.save(
      doc({
        id: "stranger",
        playerId: "outsider",
        type: "policy",
        policy: POLICY,
      }),
    );
    const found = await documents.listCurrentPolicies("tenant-a", ids);
    expect(found).toHaveLength(65);
    expect(new Set(found.map((d) => d.playerId))).toEqual(new Set(ids));
    expect(await documents.listCurrentPolicies("tenant-a", [])).toEqual([]);
  });

  it("joins the transaction of the unit of work and rolls back with it", async () => {
    const uow = new FirestoreUnitOfWork(db);
    await expect(
      uow.run(async ({documents: txDocuments}) => {
        await txDocuments.save(doc({id: "rolled-back"}));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await documents.get("tenant-a", "rolled-back")).toBeNull();

    await uow.run(async ({documents: txDocuments}) => {
      await txDocuments.save(doc({id: "kept"}));
    });
    expect(await documents.get("tenant-a", "kept")).not.toBeNull();
  });
});

describe("FirestorePlayerReader", () => {
  const players = new FirestorePlayerRepository(db);
  const reader = new FirestorePlayerReader(db);

  beforeEach(async () => {
    await players.save(buildPlayer());
    await players.save(
      buildPlayer({
        id: "player-2",
        firstNames: "Ana",
        lastNames: "Gomez",
        groupId: "group-2",
        venueId: "venue-2",
        categoryId: "category-2",
      }),
    );
    await players.save(buildPlayer({id: "player-3", firstNames: "Luis"}));
    await players.save(buildPlayer({id: "player-x", tenantId: "tenant-b"}));
  });

  it("returns where the player is and a display name", async () => {
    expect(await reader.get("tenant-a", "player-1")).toEqual({
      id: "player-1",
      fullName: "Perez Juan",
      venueId: "venue-1",
      groupId: "group-1",
      categoryId: "category-1",
    });
  });

  it("returns null for an unknown player or one of another tenant", async () => {
    expect(await reader.get("tenant-a", "nobody")).toBeNull();
    expect(await reader.get("tenant-a", "player-x")).toBeNull();
  });

  it("lists the players of a category inside the tenant", async () => {
    const found = await reader.listByCategory("tenant-a", "category-1");
    expect(found.map((p) => p.id).sort()).toEqual(["player-1", "player-3"]);
    expect(await reader.listByCategory("tenant-b", "category-1")).toHaveLength(
      1,
    );
  });
});
