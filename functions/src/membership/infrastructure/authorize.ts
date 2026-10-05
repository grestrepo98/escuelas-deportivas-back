import {
  isActiveMembershipOf,
  type Membership,
} from "../domain/membership.js";
import type {Firestore} from "firebase-admin/firestore";
import {DomainError} from "../../shared/domain/errors.js";
import {
  FirestoreMembershipRepository,
} from "./firestore/firestore-membership-repository.js";

// The uid always comes from the verified token (`res.locals.uid`, set by the
// authenticate middleware), never from the payload.
export function requireUid(uid: string | undefined): string {
  if (!uid) {
    throw new DomainError("unauthenticated", "Authentication is required");
  }
  return uid;
}

// D-05/D-06: the tenant sent by the client is never trusted on its own. It is
// checked against the caller's membership, read fresh on every call, so a
// deactivation takes effect on the very next request (no claims to expire).
// Missing and inactive memberships get the same answer on purpose.
export async function authorizeTenantMember(
  db: Firestore,
  uid: string,
  tenantId: string,
): Promise<Membership> {
  const membership = await new FirestoreMembershipRepository(db)
    .get(uid, tenantId);
  if (!membership || !isActiveMembershipOf(membership, tenantId)) {
    throw new DomainError(
      "permission_denied",
      "No active membership in this tenant",
    );
  }
  return membership;
}
