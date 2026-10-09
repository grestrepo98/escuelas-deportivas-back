import {DomainError} from "../../shared/domain/errors.js";
import type {MembershipRepository} from "../../membership/application/membership-repository.js";
import {
  isActiveMembershipOf,
  type Membership,
} from "../../membership/domain/membership.js";

const READER_ROLES = ["owner", "accountant", "coordinator", "teacher"];

// Who may read documents at all; the scope and the types come after.
export async function requireReader(
  memberships: MembershipRepository,
  tenantId: string,
  actorUid: string,
): Promise<Membership> {
  const actor = await memberships.get(actorUid, tenantId);
  if (
    !isActiveMembershipOf(actor, tenantId) ||
    actor == null ||
    !READER_ROLES.includes(actor.role)
  ) {
    throw new DomainError(
      "permission_denied",
      "This role cannot read documents",
    );
  }
  return actor;
}
