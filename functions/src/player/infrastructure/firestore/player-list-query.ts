import {FieldPath, type Firestore} from "firebase-admin/firestore";
import {DomainError} from "../../../shared/domain/errors.js";
import type {Membership} from "../../../membership/domain/membership.js";
import type {Player, PlayerStatus} from "../../domain/player.js";
import {fromPlayerDoc} from "./player-mapper.js";
import {
  assertMayListPlayers,
  assertValidStatus,
  checkLocationFilter,
  scopedPlayerQuery,
  type LocationFilter,
} from "./player-scope.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ListPlayersParams = LocationFilter & {
  status?: PlayerStatus;
  cursor?: string;
  limit?: number;
};

// What a list row carries: enough to show the player and open the record,
// and nothing the teacher may not see.
export type PlayerSummary = {
  id: string;
  firstNames: string;
  lastNames: string;
  birthDate: string;
  status: PlayerStatus;
  groupId: string;
  venueId: string;
  categoryId: string;
};

export type ListPlayersResult = {
  players: PlayerSummary[];
  nextCursor: string | null;
};

const toSummary = (player: Player): PlayerSummary => ({
  id: player.id,
  firstNames: player.firstNames,
  lastNames: player.lastNames,
  birthDate: player.birthDate,
  status: player.status,
  groupId: player.groupId,
  venueId: player.venueId,
  categoryId: player.categoryId,
});

// The cursor is opaque to the client: the sort key of the last row returned.
export function encodeCursor(player: Pick<Player, "nameKey" | "id">): string {
  return Buffer.from(JSON.stringify([player.nameKey, player.id])).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): [string, string] {
  const invalid = () => new DomainError("invalid_argument", "Invalid cursor");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string"
  ) {
    throw invalid();
  }
  return [parsed[0], parsed[1]];
}

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new DomainError(
      "invalid_argument",
      `limit must be an integer between 1 and ${MAX_LIMIT}`,
    );
  }
  return limit;
}

// A page of the players the actor may read, ordered by name and then by id,
// with one location filter and a status. The domain rule has the last word on
// visibility, so a batch can hold rows the actor may not read; the query keeps
// pulling batches until the page is full, which keeps every page the same size
// without an index per scope.
export async function listPlayers(
  db: Firestore,
  tenantId: string,
  membership: Membership,
  params: ListPlayersParams,
): Promise<ListPlayersResult> {
  assertMayListPlayers(membership, tenantId);
  const limit = resolveLimit(params.limit);
  assertValidStatus(params.status);
  let after = params.cursor === undefined ? null : decodeCursor(params.cursor);
  await checkLocationFilter(db, tenantId, membership, params);

  const scoped = scopedPlayerQuery(db, tenantId, membership, params);
  if (!scoped) {
    return {players: [], nextCursor: null};
  }

  // One more than the page, to know whether there is a next page.
  const wanted = limit + 1;
  const found: Player[] = [];
  let exhausted = false;
  while (found.length < wanted && !exhausted) {
    let batch = scoped.query
      .orderBy("nameKey")
      .orderBy(FieldPath.documentId())
      .limit(wanted);
    if (after) {
      batch = batch.startAfter(after[0], after[1]);
    }
    const snap = await batch.get();
    for (const doc of snap.docs) {
      const player = fromPlayerDoc(doc.id, tenantId, doc.data());
      after = [player.nameKey, player.id];
      if (scoped.canRead(player)) {
        found.push(player);
      }
    }
    exhausted = snap.size < wanted;
  }

  const page = found.slice(0, limit);
  return {
    players: page.map(toSummary),
    nextCursor: found.length > limit ? encodeCursor(page[limit - 1]) : null,
  };
}
