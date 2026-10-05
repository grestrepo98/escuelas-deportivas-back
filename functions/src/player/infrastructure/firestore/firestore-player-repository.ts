import type {Firestore, Query, Transaction} from "firebase-admin/firestore";
import type {Player} from "../../domain/player.js";
import type {PlayerRepository} from "../../application/player-repository.js";
import {fromPlayerDoc, toPlayerDoc} from "./player-mapper.js";

// tenants/{tenantId}/players/{playerId}. Bound to a transaction when one is
// given.
export class FirestorePlayerRepository implements PlayerRepository {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  // Generated locally: it does not read or reserve anything in Firestore.
  newId(): string {
    return this.db.collection("players").doc().id;
  }

  async get(tenantId: string, id: string): Promise<Player | null> {
    const ref = this.db.doc(this.path(tenantId, id));
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists ? fromPlayerDoc(snap.id, tenantId, snap.data()!) : null;
  }

  async save(player: Player): Promise<void> {
    const ref = this.db.doc(this.path(player.tenantId, player.id));
    const data = toPlayerDoc(player);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }

  async findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Player | null> {
    const found = await this.run(
      tenantId,
      this.collection(tenantId)
        .where("documentKey", "==", documentKey)
        .limit(1),
    );
    return found[0] ?? null;
  }

  async findByNameAndBirthDate(
    tenantId: string,
    nameKey: string,
    birthDate: string,
  ): Promise<Player[]> {
    return this.run(
      tenantId,
      this.collection(tenantId)
        .where("nameKey", "==", nameKey)
        .where("birthDate", "==", birthDate),
    );
  }

  async listByGuardian(
    tenantId: string,
    guardianId: string,
  ): Promise<Player[]> {
    return this.run(
      tenantId,
      this.collection(tenantId).where(
        "guardianIds",
        "array-contains",
        guardianId,
      ),
    );
  }

  private async run(tenantId: string, query: Query): Promise<Player[]> {
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    return snap.docs.map((doc) => fromPlayerDoc(doc.id, tenantId, doc.data()));
  }

  private collection(tenantId: string) {
    return this.db.collection(`tenants/${tenantId}/players`);
  }

  private path(tenantId: string, id: string): string {
    return `tenants/${tenantId}/players/${id}`;
  }
}
