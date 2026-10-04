import {DomainError} from "../../shared/domain/errors.js";
import type {MembershipRepository} from "./membership-repository.js";
import {isActiveMembershipOf} from "../domain/membership.js";
import type {Role} from "../domain/role.js";

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
