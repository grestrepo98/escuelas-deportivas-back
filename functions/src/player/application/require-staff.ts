import {DomainError} from "../../shared/domain/errors.js";
import type {MembershipRepository} from "../../membership/application/membership-repository.js";
import {
  isActiveMembershipOf,
  type Membership,
} from "../../membership/domain/membership.js";

const STAFF_ROLES = ["owner", "accountant", "coordinator"];

// The staff that may write players: owner, accountant and coordinator. The
// venue check of a coordinator happens once the player's venue is known.
export async function requireStaff(
  memberships: MembershipRepository,
  tenantId: string,
  actorUid: string,
): Promise<Membership> {
  const actor = await memberships.get(actorUid, tenantId);
  if (
    !isActiveMembershipOf(actor, tenantId) ||
    actor == null ||
    !STAFF_ROLES.includes(actor.role)
  ) {
    throw new DomainError(
      "permission_denied",
      "Only the owner, an accountant or a coordinator can do this",
    );
  }
  return actor;
}
