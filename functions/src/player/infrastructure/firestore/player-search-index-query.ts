import type {Firestore} from "firebase-admin/firestore";
import type {Membership} from "../../../membership/domain/membership.js";
import type {PlayerStatus} from "../../domain/player.js";
import {fromPlayerDoc} from "./player-mapper.js";
import {assertMayListPlayers, scopedPlayerQuery} from "./player-scope.js";

// The light entry the client keeps to search by name, document or guardian
// without a request per keystroke (D-10).
export type PlayerSearchEntry = {
  id: string;
  fullName: string;
  documentNumber?: string;
  guardianNames?: string[];
  status: PlayerStatus;
  groupId: string;
};

export type PlayerSearchIndex = {entries: PlayerSearchEntry[]};

// Every player the actor may read, by name. The teacher gets neither the
// document nor the guardians, like the record itself.
export async function readPlayerSearchIndex(
  db: Firestore,
  tenantId: string,
  membership: Membership,
): Promise<PlayerSearchIndex> {
  assertMayListPlayers(membership, tenantId);
  const scoped = scopedPlayerQuery(db, tenantId, membership, {});
  if (!scoped) {
    return {entries: []};
  }

  const snap = await scoped.query.orderBy("nameKey").get();
  const withPersonalData = membership.role !== "teacher";
  const entries: PlayerSearchEntry[] = [];
  for (const doc of snap.docs) {
    const player = fromPlayerDoc(doc.id, tenantId, doc.data());
    if (!scoped.canRead(player)) continue;
    entries.push({
      id: player.id,
      fullName: `${player.firstNames} ${player.lastNames}`,
      ...(withPersonalData &&
        player.document && {documentNumber: player.document.number}),
      ...(withPersonalData &&
        player.guardians.length > 0 && {
          guardianNames: player.guardians.map((link) => link.fullName),
        }),
      status: player.status,
      groupId: player.groupId,
    });
  }
  return {entries};
}
