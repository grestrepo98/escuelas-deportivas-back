import {Timestamp} from "firebase-admin/firestore";
import {beforeEach, describe, expect, it} from "vitest";
import {
  buildGroup,
  buildMember,
  buildPlayer,
} from "../../application/testing/fixtures.js";
import type {Player} from "../../domain/player.js";
import {FirestoreStructureRepository} from "../../../structure/infrastructure/firestore/firestore-structure-repository.js";
import {groupMapper} from "../../../structure/infrastructure/firestore/structure-mapper.js";
import {
  clearFirestore,
  testDb,
} from "../../../shared/infrastructure/testing/helpers.js";
import {DomainError} from "../../../shared/domain/errors.js";
import {FirestorePlayerRepository} from "./firestore-player-repository.js";
import {listPlayers, type ListPlayersParams} from "./player-list-query.js";
import {readPlayerHistory} from "./player-history-query.js";
import {readPlayerSearchIndex} from "./player-search-index-query.js";

const db = testDb();
const repo = new FirestorePlayerRepository(db);
const TENANT = "tenant-a";

const owner = buildMember("owner-1", "owner");
const coordinator = (...venueIds: string[]) =>
  buildMember("coord-1", "coordinator", {venueIds});
const teacher = (...groupIds: string[]) =>
  buildMember("teacher-1", "teacher", {groupIds});

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }
  throw new Error("expected the query to fail");
}

// A player with a sortable name: "apellido-<n> nombre".
async function seed(
  id: string,
  overrides: Partial<Player> = {},
): Promise<Player> {
  const player = buildPlayer({
    id,
    firstNames: "Nombre",
    lastNames: `Apellido ${id}`,
    nameKey: `apellido ${id} nombre`,
    ...overrides,
  });
  await repo.save(player);
  return player;
}

const ids = (result: {players: {id: string}[]}) =>
  result.players.map((p) => p.id);

const list = (
  membership = owner,
  params: Partial<ListPlayersParams> = {},
  tenantId = TENANT,
) => listPlayers(db, tenantId, membership, params);

// Walks every page and returns the ids in order.
async function walk(
  membership: Parameters<typeof list>[0],
  params: Partial<ListPlayersParams>,
): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const result = await list(membership, {...params, cursor});
    seen.push(...ids(result));
    if (result.nextCursor === null) return seen;
    cursor = result.nextCursor;
  }
  throw new Error("pagination did not end");
}

beforeEach(clearFirestore);

describe("listPlayers — order and pagination", () => {
  beforeEach(async () => {
    for (const n of [5, 3, 1, 4, 2, 7, 6]) await seed(`p${n}`);
  });

  it("returns an empty page when there are no players", async () => {
    await clearFirestore();
    expect(await list()).toEqual({players: [], nextCursor: null});
  });

  it("orders by name key", async () => {
    const result = await list(owner, {limit: 100});
    expect(ids(result)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(result.nextCursor).toBeNull();
  });

  it("pages by cursor without repeating or skipping anyone", async () => {
    const first = await list(owner, {limit: 3});
    expect(ids(first)).toEqual(["p1", "p2", "p3"]);
    expect(first.nextCursor).not.toBeNull();
    const second = await list(owner, {limit: 3, cursor: first.nextCursor!});
    expect(ids(second)).toEqual(["p4", "p5", "p6"]);
    const third = await list(owner, {limit: 3, cursor: second.nextCursor!});
    expect(ids(third)).toEqual(["p7"]);
    expect(third.nextCursor).toBeNull();
  });

  it("ends without an extra empty page when the total fits the limit exactly", async () => {
    await repo.save(buildPlayer({id: "x", tenantId: "other"}));
    const first = await list(owner, {limit: 7});
    expect(ids(first)).toHaveLength(7);
    expect(first.nextCursor).toBeNull();
  });

  it("breaks ties between equal names by id", async () => {
    await clearFirestore();
    for (const id of ["c", "a", "d", "b", "e"]) {
      await seed(id, {nameKey: "garcia ana"});
    }
    expect(await walk(owner, {limit: 2})).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("uses 50 as the default limit", async () => {
    await clearFirestore();
    for (let n = 0; n < 55; n++) {
      await seed(`q${String(n).padStart(2, "0")}`);
    }
    const first = await list();
    expect(first.players).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    expect(await walk(owner, {})).toHaveLength(55);
  });

  it("rejects a limit outside 1..100", async () => {
    for (const limit of [0, -1, 101, 1.5]) {
      expect((await failure(list(owner, {limit}))).code).toBe(
        "invalid_argument",
      );
    }
  });

  it("rejects an invalid cursor", async () => {
    for (const cursor of [
      "not base64 at all!",
      Buffer.from("plain text").toString("base64url"),
      Buffer.from(JSON.stringify(["only-one"])).toString("base64url"),
      Buffer.from(JSON.stringify([1, 2])).toString("base64url"),
      "",
    ]) {
      expect((await failure(list(owner, {cursor}))).code).toBe(
        "invalid_argument",
      );
    }
  });

  it("returns the summary fields and nothing sensitive", async () => {
    await clearFirestore();
    await seed("p1", {
      document: {type: "TI", number: "123"},
      documentKey: "TI:123",
      medical: {allergies: "penicilina"},
      guardianIds: ["g1"],
    });
    const [summary] = (await list()).players;
    expect(summary).toEqual({
      id: "p1",
      firstNames: "Nombre",
      lastNames: "Apellido p1",
      birthDate: "2014-05-01",
      status: "preinscrito",
      groupId: "group-1",
      venueId: "venue-1",
      categoryId: "category-1",
    });
  });

  it("does not return players of another organization", async () => {
    await repo.save(buildPlayer({id: "z", tenantId: "tenant-b"}));
    expect(await walk(owner, {limit: 100})).not.toContain("z");
  });
});

describe("listPlayers — filters", () => {
  beforeEach(async () => {
    await seed("a1", {
      venueId: "v1",
      categoryId: "c1",
      groupId: "g1",
      status: "activo",
    });
    await seed("a2", {
      venueId: "v1",
      categoryId: "c2",
      groupId: "g2",
      status: "pausado",
    });
    await seed("a3", {
      venueId: "v2",
      categoryId: "c1",
      groupId: "g3",
      status: "activo",
    });
    await seed("a4", {
      venueId: "v2",
      categoryId: "c2",
      groupId: "g4",
      status: "retirado",
    });
  });

  it.each([
    [{venueId: "v1"}, ["a1", "a2"]],
    [{venueId: "v2"}, ["a3", "a4"]],
    [{categoryId: "c1"}, ["a1", "a3"]],
    [{groupId: "g2"}, ["a2"]],
    [{status: "activo" as const}, ["a1", "a3"]],
    [{venueId: "v1", status: "activo" as const}, ["a1"]],
    [{categoryId: "c2", status: "retirado" as const}, ["a4"]],
    [{groupId: "g3", status: "pausado" as const}, []],
  ])("filters by %o", async (params, expected) => {
    expect(await walk(owner, params)).toEqual(expected);
  });

  it("answers 400 when two location filters are sent", async () => {
    for (const params of [
      {venueId: "v1", categoryId: "c1"},
      {venueId: "v1", groupId: "g1"},
      {categoryId: "c1", groupId: "g1"},
    ]) {
      expect((await failure(list(owner, params))).code).toBe(
        "invalid_argument",
      );
    }
  });

  it("answers 400 for an unknown status", async () => {
    const error = await failure(
      list(owner, {status: "en mora" as unknown as "activo"}),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("pages a filtered list too", async () => {
    expect(await walk(owner, {venueId: "v1", limit: 1})).toEqual(["a1", "a2"]);
  });
});

describe("listPlayers — coordinator scope", () => {
  beforeEach(async () => {
    // Alternate venues so that out-of-scope players sit between the visible.
    for (let n = 1; n <= 8; n++) {
      await seed(`p${n}`, {
        venueId: n % 2 === 1 ? "v1" : "v2",
        groupId: n % 2 === 1 ? "g1" : "g2",
        categoryId: "c1",
      });
    }
    await new FirestoreStructureRepository(db, "groups", groupMapper).save(
      buildGroup({id: "g1", venueId: "v1"}),
    );
    await new FirestoreStructureRepository(db, "groups", groupMapper).save(
      buildGroup({id: "g2", venueId: "v2"}),
    );
  });

  it("lists only the players of their venues", async () => {
    expect(await walk(coordinator("v1"), {})).toEqual(["p1", "p3", "p5", "p7"]);
  });

  it("lists the players of all their venues", async () => {
    expect(await walk(coordinator("v1", "v2"), {limit: 3})).toHaveLength(8);
  });

  it("pages without gaps in a scope", async () => {
    expect(await walk(coordinator("v1"), {limit: 1})).toEqual([
      "p1",
      "p3",
      "p5",
      "p7",
    ]);
  });

  it("returns nothing for an empty scope", async () => {
    expect(await list(coordinator())).toEqual({players: [], nextCursor: null});
  });

  it("accepts a venue filter inside the scope", async () => {
    expect(await walk(coordinator("v1", "v2"), {venueId: "v2"})).toEqual([
      "p2",
      "p4",
      "p6",
      "p8",
    ]);
  });

  it("answers 403 for a venue filter outside the scope", async () => {
    const error = await failure(list(coordinator("v1"), {venueId: "v2"}));
    expect(error.code).toBe("permission_denied");
  });

  it("accepts a group filter of their venue and denies one of another", async () => {
    expect(await walk(coordinator("v1"), {groupId: "g1"})).toHaveLength(4);
    const error = await failure(list(coordinator("v1"), {groupId: "g2"}));
    expect(error.code).toBe("permission_denied");
  });

  it("answers 404 for a group filter that does not exist", async () => {
    const error = await failure(list(coordinator("v1"), {groupId: "nope"}));
    expect(error.code).toBe("not_found");
  });

  it("keeps a category filter inside their venues, page by page", async () => {
    expect(await walk(coordinator("v1"), {categoryId: "c1", limit: 2})).toEqual(
      ["p1", "p3", "p5", "p7"],
    );
  });

  it("combines the scope with a status filter", async () => {
    await seed("p9", {venueId: "v1", status: "activo"});
    expect(await walk(coordinator("v1"), {status: "activo"})).toEqual(["p9"]);
  });

  it("still scopes a coordinator with more venues than Firestore's `in` allows", async () => {
    const venues = Array.from({length: 31}, (_, n) => `extra-${n}`);
    expect(await walk(coordinator("v1", ...venues), {})).toEqual([
      "p1",
      "p3",
      "p5",
      "p7",
    ]);
  });
});

describe("listPlayers — teacher scope", () => {
  beforeEach(async () => {
    await seed("p1", {groupId: "g1", venueId: "v1", categoryId: "c1"});
    await seed("p2", {groupId: "g2", venueId: "v1", categoryId: "c1"});
    await seed("p3", {groupId: "g1", venueId: "v1", categoryId: "c2"});
    await seed("p4", {groupId: "g3", venueId: "v2", categoryId: "c1"});
  });

  it("lists only the players of their groups", async () => {
    expect(await walk(teacher("g1"), {})).toEqual(["p1", "p3"]);
    expect(await walk(teacher("g1", "g3"), {limit: 1})).toEqual([
      "p1",
      "p3",
      "p4",
    ]);
  });

  it("returns nothing for an empty scope", async () => {
    expect(await list(teacher())).toEqual({players: [], nextCursor: null});
  });

  it("accepts a group filter inside the scope and denies one outside", async () => {
    expect(await walk(teacher("g1", "g2"), {groupId: "g2"})).toEqual(["p2"]);
    const error = await failure(list(teacher("g1"), {groupId: "g2"}));
    expect(error.code).toBe("permission_denied");
  });

  it("keeps venue and category filters inside their groups", async () => {
    expect(await walk(teacher("g1"), {venueId: "v1"})).toEqual(["p1", "p3"]);
    expect(await walk(teacher("g1", "g2"), {categoryId: "c1"})).toEqual([
      "p1",
      "p2",
    ]);
    expect(await walk(teacher("g1"), {venueId: "v2"})).toEqual([]);
  });

  it("combines the scope with a status filter", async () => {
    await seed("p5", {groupId: "g1", status: "activo"});
    expect(await walk(teacher("g1"), {status: "activo"})).toEqual(["p5"]);
  });

  it("does not expose the document or the guardians", async () => {
    await seed("p6", {
      groupId: "g1",
      document: {type: "TI", number: "1"},
      documentKey: "TI:1",
      guardianIds: ["g"],
    });
    const result = await list(teacher("g1"));
    for (const summary of result.players) {
      expect(Object.keys(summary).sort()).toEqual([
        "birthDate",
        "categoryId",
        "firstNames",
        "groupId",
        "id",
        "lastNames",
        "status",
        "venueId",
      ]);
    }
  });
});

describe("listPlayers — access", () => {
  beforeEach(async () => {
    await seed("p1");
  });

  it("lets an accountant list everything", async () => {
    expect(ids(await list(buildMember("acc-1", "accountant")))).toEqual(["p1"]);
  });

  it.each(["guardian", "adultPlayer"] as const)("denies %s", async (role) => {
    const error = await failure(list(buildMember("u", role)));
    expect(error.code).toBe("permission_denied");
  });

  it("denies an inactive member", async () => {
    const inactive = buildMember("o", "owner", {}, {status: "inactive"});
    expect((await failure(list(inactive))).code).toBe("permission_denied");
  });

  it("denies a membership of another organization", async () => {
    const foreign = buildMember("o", "owner", {}, {tenantId: "tenant-b"});
    expect((await failure(list(foreign))).code).toBe("permission_denied");
  });
});

describe("readPlayerSearchIndex", () => {
  beforeEach(async () => {
    await seed("p1", {
      venueId: "v1",
      groupId: "g1",
      status: "activo",
      document: {type: "TI", number: "123"},
      documentKey: "TI:123",
      guardians: [
        {
          guardianId: "a",
          fullName: "Ana Perez",
          relationship: "madre",
          isPaymentResponsible: true,
        },
        {
          guardianId: "b",
          fullName: "Luis Perez",
          relationship: "padre",
          isPaymentResponsible: false,
        },
      ],
      guardianIds: ["a", "b"],
    });
    await seed("p2", {venueId: "v2", groupId: "g2"});
    await seed("p3", {venueId: "v1", groupId: "g3", firstNames: "Zoe"});
  });

  it("returns the light entry of every visible player, by name", async () => {
    const {entries} = await readPlayerSearchIndex(db, TENANT, owner);
    expect(entries.map((e) => e.id)).toEqual(["p1", "p2", "p3"]);
    expect(entries[0]).toEqual({
      id: "p1",
      fullName: "Nombre Apellido p1",
      documentNumber: "123",
      guardianNames: ["Ana Perez", "Luis Perez"],
      status: "activo",
      groupId: "g1",
    });
  });

  it("omits the optional fields a player does not have", async () => {
    const {entries} = await readPlayerSearchIndex(db, TENANT, owner);
    expect(entries[1]).toEqual({
      id: "p2",
      fullName: "Nombre Apellido p2",
      status: "preinscrito",
      groupId: "g2",
    });
  });

  it("limits a coordinator to their venues", async () => {
    const {entries} = await readPlayerSearchIndex(
      db,
      TENANT,
      coordinator("v1"),
    );
    expect(entries.map((e) => e.id)).toEqual(["p1", "p3"]);
    expect(entries[0].documentNumber).toBe("123");
  });

  it("gives a teacher their groups without document or guardian names", async () => {
    const {entries} = await readPlayerSearchIndex(
      db,
      TENANT,
      teacher("g1", "g3"),
    );
    expect(entries.map((e) => e.id)).toEqual(["p1", "p3"]);
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("documentNumber");
      expect(entry).not.toHaveProperty("guardianNames");
    }
  });

  it("returns nothing for an empty scope", async () => {
    expect(await readPlayerSearchIndex(db, TENANT, coordinator())).toEqual({
      entries: [],
    });
    expect(await readPlayerSearchIndex(db, TENANT, teacher())).toEqual({
      entries: [],
    });
  });

  it("does not return players of another organization", async () => {
    await repo.save(buildPlayer({id: "z", tenantId: "tenant-b"}));
    const {entries} = await readPlayerSearchIndex(db, TENANT, owner);
    expect(entries.map((e) => e.id)).not.toContain("z");
  });

  it("denies the families and members of another organization", async () => {
    for (const membership of [
      buildMember("u", "guardian"),
      buildMember("o", "owner", {}, {tenantId: "tenant-b"}),
      buildMember("o", "owner", {}, {status: "inactive"}),
    ]) {
      const error = await failure(
        readPlayerSearchIndex(db, TENANT, membership),
      );
      expect(error.code).toBe("permission_denied");
    }
  });
});

describe("readPlayerHistory", () => {
  const history = (playerId: string) =>
    db.collection(`tenants/${TENANT}/players/${playerId}/history`);

  beforeEach(async () => {
    await seed("p1", {venueId: "v1", groupId: "g1"});
    await history("p1").add({
      type: "status",
      before: {status: "preinscrito"},
      after: {status: "activo"},
      reason: null,
      actorUid: "staff-1",
      at: Timestamp.fromDate(new Date("2026-10-01T10:00:00Z")),
    });
    await history("p1").add({
      type: "placement",
      before: {groupId: "g1", venueId: "v1", categoryId: "c1"},
      after: {groupId: "g2", venueId: "v1", categoryId: "c1"},
      reason: "sube",
      actorUid: "staff-2",
      at: Timestamp.fromDate(new Date("2026-10-03T10:00:00Z")),
    });
    await history("p1").add({
      type: "status",
      before: {status: "activo"},
      after: {status: "pausado"},
      reason: "lesión",
      actorUid: "staff-1",
      at: Timestamp.fromDate(new Date("2026-10-02T10:00:00Z")),
    });
  });

  it("returns the entries newest first", async () => {
    const {entries} = await readPlayerHistory(db, TENANT, owner, "p1");
    expect(entries.map((e) => e.at.toISOString())).toEqual([
      "2026-10-03T10:00:00.000Z",
      "2026-10-02T10:00:00.000Z",
      "2026-10-01T10:00:00.000Z",
    ]);
    expect(entries[0]).toMatchObject({
      type: "placement",
      before: {groupId: "g1", venueId: "v1", categoryId: "c1"},
      after: {groupId: "g2"},
      reason: "sube",
      actorUid: "staff-2",
    });
    expect(typeof entries[0].id).toBe("string");
  });

  it("returns an empty list for a player without history", async () => {
    await seed("p2", {venueId: "v1", groupId: "g1"});
    expect(await readPlayerHistory(db, TENANT, owner, "p2")).toEqual({
      entries: [],
    });
  });

  it("lets a coordinator of the venue and a teacher of the group read it", async () => {
    expect(
      (await readPlayerHistory(db, TENANT, coordinator("v1"), "p1")).entries,
    ).toHaveLength(3);
    expect(
      (await readPlayerHistory(db, TENANT, teacher("g1"), "p1")).entries,
    ).toHaveLength(3);
  });

  it("denies a coordinator of another venue and a teacher of another group", async () => {
    for (const membership of [coordinator("v2"), teacher("g2")]) {
      const error = await failure(
        readPlayerHistory(db, TENANT, membership, "p1"),
      );
      expect(error.code).toBe("permission_denied");
    }
  });

  it("denies the families and members of another organization", async () => {
    for (const membership of [
      buildMember("u", "guardian"),
      buildMember("o", "owner", {}, {tenantId: "tenant-b"}),
    ]) {
      const error = await failure(
        readPlayerHistory(db, TENANT, membership, "p1"),
      );
      expect(error.code).toBe("permission_denied");
    }
  });

  it("fails with not_found for a missing player", async () => {
    const error = await failure(
      readPlayerHistory(db, TENANT, owner, "missing"),
    );
    expect(error.code).toBe("not_found");
  });
});
