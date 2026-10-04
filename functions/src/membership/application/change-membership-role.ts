import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {isActiveMembershipOf, membershipId} from "../domain/membership.js";
import type {Role} from "../domain/role.js";

export type ChangeMembershipRoleInput = {
  tenantId: string;
  actorUid: string;
  targetUid: string;
  newRole: Role;
  reason?: string;
  device?: {userAgent?: string};
};

export type ChangeMembershipRoleResult = {
  membershipId: string;
  role: Role;
};

export class ChangeMembershipRole {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(
    input: ChangeMembershipRoleInput,
  ): Promise<ChangeMembershipRoleResult> {
    const {tenantId, actorUid, targetUid, newRole} = input;

    return this.unitOfWork.run(async ({memberships, auditLog}) => {
      const actor = await memberships.get(actorUid, tenantId);
      if (!isActiveMembershipOf(actor, tenantId) || actor?.role !== "owner") {
        throw new DomainError(
          "permission_denied",
          "Only an active owner of the tenant can change roles",
        );
      }

      const target = await memberships.get(targetUid, tenantId);
      if (!target) {
        throw new DomainError("not_found", "Membership not found");
      }

      if (target.role === newRole) {
        throw new DomainError(
          "failed_precondition",
          "The new role must differ from the current role",
        );
      }

      if (target.role === "owner" && target.status === "active") {
        const activeOwners = await memberships.countActiveByRole(
          tenantId,
          "owner",
        );
        if (activeOwners <= 1) {
          throw new DomainError(
            "failed_precondition",
            "The tenant must keep at least one active owner",
          );
        }
      }

      const updated = {
        ...target,
        role: newRole,
        updatedAt: this.clock.now(),
      };
      await memberships.save(updated);

      const id = membershipId(targetUid, tenantId);
      await auditLog.append({
        tenantId,
        actorUid,
        actorRole: actor.role,
        action: "membership.role_changed",
        target: {type: "membership", id},
        before: {role: target.role},
        after: {role: newRole},
        ...(input.reason !== undefined && {reason: input.reason}),
        device: input.device ?? {},
      });

      return {membershipId: id, role: newRole};
    });
  }
}
