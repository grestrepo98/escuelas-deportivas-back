import {beforeEach, describe, expect, it} from "vitest";
import type {PlayerDocument} from "../../../../../src/document/domain/document.js";
import {InMemoryDocumentRepository} from "../../../../../src/document/application/testing/in-memory-document-repository.js";
import {InMemoryFileStorage} from "../../../../../src/document/application/testing/in-memory-file-storage.js";
import {InMemoryPlayerReader} from "../../../../../src/document/application/testing/in-memory-player-reader.js";

const T0 = new Date("2026-10-01T00:00:00Z");

const doc = (overrides: Partial<PlayerDocument> = {}): PlayerDocument => ({
  id: "d1",
  tenantId: "t1",
  playerId: "p1",
  type: "identity",
  status: "current",
  createdAt: T0,
  createdBy: "u1",
  ...overrides,
});

describe("InMemoryDocumentRepository", () => {
  let repo: InMemoryDocumentRepository;
  beforeEach(() => {
    repo = new InMemoryDocumentRepository();
  });

  it("generates distinct ids", () => {
    expect(repo.newId()).not.toBe(repo.newId());
  });

  it("saves, gets and isolates by tenant", async () => {
    await repo.save(doc());
    expect(await repo.get("t1", "d1")).toEqual(doc());
    expect(await repo.get("t2", "d1")).toBeNull();
  });

  it("returns copies, not references", async () => {
    await repo.save(doc());
    const found = (await repo.get("t1", "d1"))!;
    found.status = "superseded";
    expect((await repo.get("t1", "d1"))!.status).toBe("current");
  });

  it("finds the current document of a player and type", async () => {
    await repo.save(doc({id: "old", status: "superseded"}));
    await repo.save(doc({id: "new"}));
    await repo.save(doc({id: "other-type", type: "photo"}));
    await repo.save(doc({id: "other-player", playerId: "p2"}));
    expect((await repo.findCurrent("t1", "p1", "identity"))!.id).toBe("new");
    expect(await repo.findCurrent("t1", "p1", "policy")).toBeNull();
  });

  it("lists a player's documents newest first, hiding superseded ones", async () => {
    await repo.save(doc({id: "a", status: "superseded"}));
    await repo.save(
      doc({
        id: "b",
        type: "photo",
        createdAt: new Date("2026-10-02T00:00:00Z"),
      }),
    );
    await repo.save(doc({id: "c", playerId: "p2"}));
    const current = await repo.listByPlayer("t1", "p1", {
      includeSuperseded: false,
    });
    expect(current.map((d) => d.id)).toEqual(["b"]);
    const all = await repo.listByPlayer("t1", "p1", {includeSuperseded: true});
    expect(all.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("lists the current policies of a set of players", async () => {
    await repo.save(doc({id: "p1-pol", type: "policy"}));
    await repo.save(doc({id: "p1-old", type: "policy", status: "superseded"}));
    await repo.save(doc({id: "p2-pol", playerId: "p2", type: "policy"}));
    await repo.save(doc({id: "p3-pol", playerId: "p3", type: "policy"}));
    await repo.save(doc({id: "p1-id"}));
    const found = await repo.listCurrentPolicies("t1", ["p1", "p2"]);
    expect(found.map((d) => d.id).sort()).toEqual(["p1-pol", "p2-pol"]);
  });

  it("restores a snapshot", async () => {
    await repo.save(doc());
    const snapshot = repo.snapshot();
    await repo.save(doc({id: "d2"}));
    repo.restore(snapshot);
    expect(await repo.get("t1", "d2")).toBeNull();
    expect(await repo.get("t1", "d1")).not.toBeNull();
  });
});

describe("InMemoryFileStorage", () => {
  let storage: InMemoryFileStorage;
  const expiresAt = new Date("2026-10-01T00:15:00Z");
  beforeEach(() => {
    storage = new InMemoryFileStorage();
  });

  it("creates an upload ticket under the tenant's uploads folder", async () => {
    const ticket = await storage.createUpload({
      tenantId: "t1",
      contentType: "application/pdf",
      size: 1000,
      expiresAt,
    });
    expect(ticket.expiresAt).toEqual(expiresAt);
    expect(ticket.uploadMethod).toBe("PUT");
    expect(ticket.uploadHeaders).toEqual({"Content-Type": "application/pdf"});
    expect(ticket.uploadUrl).toContain(`uploads/t1/${ticket.uploadId}`);
  });

  it("stats a simulated client upload and returns null for a missing file", async () => {
    const {uploadId} = await storage.createUpload({
      tenantId: "t1",
      contentType: "application/pdf",
      size: 1000,
      expiresAt,
    });
    const path = `uploads/t1/${uploadId}`;
    expect(await storage.stat(path)).toBeNull();
    storage.put(path, {
      contentType: "application/pdf",
      size: 1000,
      createdAt: T0,
    });
    expect(await storage.stat(path)).toEqual({
      contentType: "application/pdf",
      size: 1000,
      createdAt: T0,
    });
  });

  it("moves a file and removes the source", async () => {
    storage.put("a", {contentType: "image/png", size: 5, createdAt: T0});
    await storage.move("a", "b");
    expect(await storage.stat("a")).toBeNull();
    expect((await storage.stat("b"))!.size).toBe(5);
  });

  it("fails to move a missing file", async () => {
    await expect(storage.move("nope", "b")).rejects.toThrow();
  });

  it("creates a download url only for an existing file", async () => {
    storage.put("a", {contentType: "image/png", size: 5, createdAt: T0});
    const link = await storage.createDownloadUrl({path: "a", expiresAt});
    expect(link.url).toContain("a");
    expect(link.expiresAt).toEqual(expiresAt);
    await expect(
      storage.createDownloadUrl({path: "missing", expiresAt}),
    ).rejects.toThrow();
  });
});

describe("InMemoryPlayerReader", () => {
  const ref = (id: string, categoryId: string) => ({
    id,
    fullName: `Player ${id}`,
    venueId: "v1",
    groupId: "g1",
    categoryId,
  });

  it("gets by tenant and id and lists by category", async () => {
    const reader = new InMemoryPlayerReader();
    reader.add("t1", ref("p1", "c1"));
    reader.add("t1", ref("p2", "c2"));
    reader.add("t2", ref("p3", "c1"));
    expect((await reader.get("t1", "p1"))!.id).toBe("p1");
    expect(await reader.get("t2", "p1")).toBeNull();
    expect((await reader.listByCategory("t1", "c1")).map((p) => p.id)).toEqual([
      "p1",
    ]);
  });
});
