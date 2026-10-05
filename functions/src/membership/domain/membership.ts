import type {Role} from "./role.js";

export type MembershipStatus = "active" | "inactive";

// Empty lists mean "no scope restriction" for owner and accountant.
export type Scope = {
  venueIds: string[];
  groupIds: string[];
  playerIds: string[];
};

export type Membership = {
  uid: string;
  tenantId: string;
  role: Role;
  status: MembershipStatus;
  scope: Scope;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};

export function membershipId(uid: string, tenantId: string): string {
  return `${uid}_${tenantId}`;
}

export function isActiveMembershipOf(
  membership: Membership | null | undefined,
  tenantId: string,
): boolean {
  return (
    membership != null &&
    membership.tenantId === tenantId &&
    membership.status === "active"
  );
}
