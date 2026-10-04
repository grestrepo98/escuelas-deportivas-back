import {isRole} from "../../domain/role.js";
import {type Membership} from "../../domain/membership.js";
import {Timestamp, type DocumentData} from "firebase-admin/firestore";

export function toMembershipDoc(membership: Membership): DocumentData {
  return {
    uid: membership.uid,
    tenantId: membership.tenantId,
    role: membership.role,
    status: membership.status,
    scope: membership.scope,
    createdAt: Timestamp.fromDate(membership.createdAt),
    updatedAt: Timestamp.fromDate(membership.updatedAt),
  };
}

export function fromMembershipDoc(data: DocumentData): Membership {
  if (!isRole(data.role)) {
    throw new Error(`Corrupt membership: unknown role "${data.role}"`);
  }
  if (data.status !== "active" && data.status !== "inactive") {
    throw new Error(`Corrupt membership: unknown status "${data.status}"`);
  }
  return {
    uid: data.uid,
    tenantId: data.tenantId,
    role: data.role,
    status: data.status,
    scope: {
      venueIds: data.scope?.venueIds ?? [],
      groupIds: data.scope?.groupIds ?? [],
      playerIds: data.scope?.playerIds ?? [],
    },
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  };
}
