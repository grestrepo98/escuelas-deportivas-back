import {
  FieldValue,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import type {PlayerHistoryEntry} from "../../domain/player.js";
import type {PlayerHistoryWriter} from "../../application/player-history-writer.js";
import {withoutUndefined} from "./player-mapper.js";

// tenants/{tenantId}/players/{playerId}/history/{entryId}. Create-only: it
// always uses `create` on a fresh id, so an entry can never be overwritten.
export class FirestorePlayerHistoryWriter implements PlayerHistoryWriter {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  async append(
    tenantId: string,
    playerId: string,
    entry: Omit<PlayerHistoryEntry, "id" | "at">,
  ): Promise<void> {
    const ref = this.db
      .collection(`tenants/${tenantId}/players/${playerId}/history`)
      .doc();
    const data = {
      type: entry.type,
      before: withoutUndefined(entry.before),
      after: withoutUndefined(entry.after),
      reason: entry.reason,
      actorUid: entry.actorUid,
      at: FieldValue.serverTimestamp(),
    };
    if (this.tx) {
      this.tx.create(ref, data);
    } else {
      await ref.create(data);
    }
  }
}
