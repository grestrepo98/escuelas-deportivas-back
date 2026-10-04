import {DomainError} from "../errors.js";
import type {MembershipRepository} from "../ports/membership-repository.js";
import {isActiveMembershipOf} from "./membership.js";
import type {Role} from "./role.js";

// Only an active owner of the tenant may write structure.
export async function requireOwner(
  memberships: MembershipRepository,
  tenantId: string,
  actorUid: string,
): Promise<Role> {
  const actor = await memberships.get(actorUid, tenantId);
  if (!isActiveMembershipOf(actor, tenantId) || actor?.role !== "owner") {
    throw new DomainError(
      "permission_denied",
      "Only an active owner of the tenant can do this",
    );
  }
  return actor.role;
}
