import type {StructureRepository} from "@escuelas/domain";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import type {StructureMapper} from "./structure-mapper.js";

// tenants/{tenantId}/{collection}/{id}: one class serves venues, categories
// and groups. Bound to a transaction when one is given.
export class FirestoreStructureRepository<
  T extends {id: string; tenantId: string},
> implements StructureRepository<T> {
  constructor(
    private readonly db: Firestore,
    private readonly collection: string,
    private readonly mapper: StructureMapper<T>,
    private readonly tx?: Transaction,
  ) {}

  // Generated locally: it does not read or reserve anything in Firestore.
  newId(): string {
    return this.db.collection(this.collection).doc().id;
  }

  async get(tenantId: string, id: string): Promise<T | null> {
    const ref = this.db.doc(this.path(tenantId, id));
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists ?
      this.mapper.fromDoc(snap.id, tenantId, snap.data()!) :
      null;
  }

  async save(entity: T): Promise<void> {
    const ref = this.db.doc(this.path(entity.tenantId, entity.id));
    const data = this.mapper.toDoc(entity);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }

  async listByTenant(tenantId: string): Promise<T[]> {
    const query = this.db.collection(`tenants/${tenantId}/${this.collection}`);
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    return snap.docs.map((d) => this.mapper.fromDoc(d.id, tenantId, d.data()));
  }

  private path(tenantId: string, id: string): string {
    return `tenants/${tenantId}/${this.collection}/${id}`;
  }
}
