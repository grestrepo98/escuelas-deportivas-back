import type {Firestore, Query, Transaction} from "firebase-admin/firestore";
import type {DocumentType, PlayerDocument} from "../../domain/document.js";
import type {DocumentRepository} from "../../application/document-repository.js";
import {fromDocumentDoc, toDocumentDoc} from "./document-mapper.js";

// Firestore allows at most 30 values in an `in` filter.
const IN_LIMIT = 30;

// tenants/{tenantId}/documents/{documentId}. Bound to a transaction when one
// is given.
export class FirestoreDocumentRepository implements DocumentRepository {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  // Generated locally: it does not read or reserve anything in Firestore.
  newId(): string {
    return this.db.collection("documents").doc().id;
  }

  async get(tenantId: string, id: string): Promise<PlayerDocument | null> {
    const ref = this.db.doc(this.path(tenantId, id));
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists
      ? fromDocumentDoc(snap.id, tenantId, snap.data()!)
      : null;
  }

  async save(document: PlayerDocument): Promise<void> {
    const ref = this.db.doc(this.path(document.tenantId, document.id));
    const data = toDocumentDoc(document);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }

  async findCurrent(
    tenantId: string,
    playerId: string,
    type: DocumentType,
  ): Promise<PlayerDocument | null> {
    const found = await this.run(
      tenantId,
      this.collection(tenantId)
        .where("playerId", "==", playerId)
        .where("type", "==", type)
        .where("status", "==", "current")
        .limit(1),
    );
    return found[0] ?? null;
  }

  async listByPlayer(
    tenantId: string,
    playerId: string,
    options: {includeSuperseded: boolean},
  ): Promise<PlayerDocument[]> {
    let query = this.collection(tenantId).where("playerId", "==", playerId);
    if (!options.includeSuperseded) {
      query = query.where("status", "==", "current");
    }
    return this.run(tenantId, query.orderBy("createdAt", "desc"));
  }

  async listCurrentPolicies(
    tenantId: string,
    playerIds: string[],
  ): Promise<PlayerDocument[]> {
    const found: PlayerDocument[] = [];
    for (let i = 0; i < playerIds.length; i += IN_LIMIT) {
      const chunk = playerIds.slice(i, i + IN_LIMIT);
      found.push(
        ...(await this.run(
          tenantId,
          this.collection(tenantId)
            .where("type", "==", "policy")
            .where("status", "==", "current")
            .where("playerId", "in", chunk),
        )),
      );
    }
    return found;
  }

  private collection(tenantId: string) {
    return this.db.collection(`tenants/${tenantId}/documents`);
  }

  private path(tenantId: string, id: string): string {
    return `tenants/${tenantId}/documents/${id}`;
  }

  private async run(tenantId: string, query: Query): Promise<PlayerDocument[]> {
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    return snap.docs.map((doc) =>
      fromDocumentDoc(doc.id, tenantId, doc.data()),
    );
  }
}
