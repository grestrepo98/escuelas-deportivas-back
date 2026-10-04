import type {Role} from "../../domain/role.js";
import type {Scope} from "../../domain/membership.js";
import type {Firestore} from "firebase-admin/firestore";
import {fromMembershipDoc} from "./membership-mapper.js";

export type MyMembership = {
  tenantId: string;
  tenantName: string;
  role: Role;
  scope: Scope;
};

// Read model for "which schools can I enter?": the caller's active
// memberships joined with the tenant name. A membership whose tenant document
// is missing is dangling data and is left out rather than shown half-empty.
export async function findMyMemberships(
  db: Firestore,
  uid: string,
): Promise<MyMembership[]> {
  const snap = await db.collection("memberships")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .get();
  const memberships = snap.docs.map((d) => fromMembershipDoc(d.data()));
  if (memberships.length === 0) return [];

  const tenants = await db.getAll(
    ...memberships.map((m) => db.doc(`tenants/${m.tenantId}`)),
  );
  const names = new Map(tenants
    .filter((t) => t.exists)
    .map((t) => [t.id, t.data()!.name as string]));

  return memberships.flatMap((m) => {
    const tenantName = names.get(m.tenantId);
    return tenantName === undefined ? [] : [{
      tenantId: m.tenantId,
      tenantName,
      role: m.role,
      scope: m.scope,
    }];
  });
}
