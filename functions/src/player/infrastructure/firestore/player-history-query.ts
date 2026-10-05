import type {Firestore} from "firebase-admin/firestore";
import {DomainError} from "../../../shared/domain/errors.js";
import type {Membership} from "../../../membership/domain/membership.js";
import type {PlayerHistoryEntry} from "../../domain/player.js";
import {assertCanReadPlayer} from "../../domain/player-visibility.js";
import {FirestorePlayerRepository} from "./firestore-player-repository.js";
import {fromHistoryDoc} from "./player-mapper.js";
import {assertMayListPlayers} from "./player-scope.js";

export type PlayerHistory = {entries: PlayerHistoryEntry[]};

// The group and status changes of one player, newest first. Whoever can read
// the player can read its history.
export async function readPlayerHistory(
  db: Firestore,
  tenantId: string,
  membership: Membership,
  playerId: string,
): Promise<PlayerHistory> {
  assertMayListPlayers(membership, tenantId);
  const player = await new FirestorePlayerRepository(db).get(
    tenantId,
    playerId,
  );
  if (!player) {
    throw new DomainError("not_found", "Player not found");
  }
  assertCanReadPlayer(membership, player);

  const snap = await db
    .collection(`tenants/${tenantId}/players/${playerId}/history`)
    .orderBy("at", "desc")
    .get();
  return {entries: snap.docs.map((doc) => fromHistoryDoc(doc.id, doc.data()))};
}
