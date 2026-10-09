import type {DocumentData, Firestore} from "firebase-admin/firestore";
import type {PlayerReader, PlayerRef} from "../../application/player-reader.js";

// Reads only the fields the document module needs from
// tenants/{tenantId}/players, without going through the player module.
export class FirestorePlayerReader implements PlayerReader {
  constructor(private readonly db: Firestore) {}

  async get(tenantId: string, playerId: string): Promise<PlayerRef | null> {
    const snap = await this.db
      .doc(`tenants/${tenantId}/players/${playerId}`)
      .get();
    return snap.exists ? toRef(snap.id, snap.data()!) : null;
  }

  async listByCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<PlayerRef[]> {
    const snap = await this.db
      .collection(`tenants/${tenantId}/players`)
      .where("categoryId", "==", categoryId)
      .get();
    return snap.docs.map((doc) => toRef(doc.id, doc.data()));
  }
}

// Last names first, like the player name key.
function toRef(id: string, data: DocumentData): PlayerRef {
  return {
    id,
    fullName: `${data.lastNames} ${data.firstNames}`,
    venueId: data.venueId,
    groupId: data.groupId,
    categoryId: data.categoryId,
  };
}
