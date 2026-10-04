import {
  isActiveMembershipOf,
  type Membership,
} from "../domain/membership.js";
import type {Firestore} from "firebase-admin/firestore";
import type {AuthData} from "firebase-functions/tasks";
import {HttpsError} from "firebase-functions/v2/https";
import {
  FirestoreMembershipRepository,
} from "./firestore/firestore-membership-repository.js";

// The uid always comes from the verified session, never from the payload.
export function requireUid(auth: AuthData | undefined): string {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication is required");
  }
  return auth.uid;
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
    throw new HttpsError(
      "permission-denied",
      "No active membership in this tenant",
    );
  }
  return membership;
}
