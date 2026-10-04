import type {Tenant, TenantRepository} from "@escuelas/domain";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {fromTenantDoc, toTenantDoc} from "./tenant-mapper.js";

// tenants/{tenantId}. Bound to a transaction when one is given.
export class FirestoreTenantRepository implements TenantRepository {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  async get(tenantId: string): Promise<Tenant | null> {
    const ref = this.db.doc(`tenants/${tenantId}`);
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists ? fromTenantDoc(snap.id, snap.data()!) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    const ref = this.db.doc(`tenants/${tenant.id}`);
    const data = toTenantDoc(tenant);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }
}
