import {membershipId, type Membership} from "../../domain/membership.js";
import {type MembershipRepository} from "../../application/membership-repository.js";
import {type Role} from "../../domain/role.js";
import type {Firestore, Transaction} from "firebase-admin/firestore";
import {fromMembershipDoc, toMembershipDoc} from "./membership-mapper.js";

// memberships/{uid}_{tenantId}. Bound to a transaction when one is given.
export class FirestoreMembershipRepository implements MembershipRepository {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  async get(uid: string, tenantId: string): Promise<Membership | null> {
    const ref = this.db.doc(`memberships/${membershipId(uid, tenantId)}`);
    const snap = this.tx ? await this.tx.get(ref) : await ref.get();
    return snap.exists ? fromMembershipDoc(snap.data()!) : null;
  }

  async save(membership: Membership): Promise<void> {
    const ref = this.db.doc(
      `memberships/${membershipId(membership.uid, membership.tenantId)}`,
    );
    const data = toMembershipDoc(membership);
    if (this.tx) {
      this.tx.set(ref, data);
    } else {
      await ref.set(data);
    }
  }

  async countActiveByRole(tenantId: string, role: Role): Promise<number> {
    const query = this.db
      .collection("memberships")
      .where("tenantId", "==", tenantId)
      .where("role", "==", role)
      .where("status", "==", "active");
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    return snap.size;
  }

  async listByTenant(tenantId: string): Promise<Membership[]> {
    const query = this.db
      .collection("memberships")
      .where("tenantId", "==", tenantId);
    const snap = this.tx ? await this.tx.get(query) : await query.get();
    return snap.docs.map((doc) => fromMembershipDoc(doc.data()));
  }
}
