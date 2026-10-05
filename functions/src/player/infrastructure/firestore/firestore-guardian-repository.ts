import type {Firestore, Transaction} from "firebase-admin/firestore";
import type {Guardian} from "../../domain/guardian.js";
import type {GuardianRepository} from "../../application/guardian-repository.js";
import {fromGuardianDoc, toGuardianDoc} from "./guardian-mapper.js";

// tenants/{tenantId}/guardians/{guardianId}. Bound to a transaction when one
// is given.
export class FirestoreGuardianRepository implements GuardianRepository {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  // Generated locally: it does not read or reserve anything in Firestore.
  newId(): string {
    return this.db.collection("guardians").doc().id;
  }

  async get(tenantId: string, id: string): Promise<Guardian | null> {
    const ref = this.db.doc(this.path(tenantId, id));
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists
      ? fromGuardianDoc(snap.id, tenantId, snap.data()!)
      : null;
  }

  async save(guardian: Guardian): Promise<void> {
    const ref = this.db.doc(this.path(guardian.tenantId, guardian.id));
    const data = toGuardianDoc(guardian);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }

  async findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Guardian | null> {
    const query = this.db
      .collection(`tenants/${tenantId}/guardians`)
      .where("documentKey", "==", documentKey)
      .limit(1);
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    const [doc] = snap.docs;
    return doc ? fromGuardianDoc(doc.id, tenantId, doc.data()) : null;
  }

  private path(tenantId: string, id: string): string {
    return `tenants/${tenantId}/guardians/${id}`;
  }
}
