import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {
  TransactionContext,
  UnitOfWork,
} from "../../shared/application/unit-of-work.js";
import {
  isActiveMembershipOf,
  membershipId,
  type Scope,
} from "../domain/membership.js";
import type {Role} from "../domain/role.js";
import {resolveScopeForRole, type ScopeInput} from "../domain/scope.js";
import {assertScopeReferences} from "./scope-references.js";

export type ChangeMembershipRoleInput = {
  tenantId: string;
  actorUid: string;
  targetUid: string;
  newRole: Role;
  // Required for coordinator (venues) and teacher (groups); owner and
  // accountant end up with an empty scope.
  scope?: ScopeInput;
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

    return this.unitOfWork.run(async (tx) => {
      const {memberships, auditLog} = tx;
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

      const scope = await this.scopeFor(tx, input, target.scope);

      const updated = {
        ...target,
        role: newRole,
        scope,
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
        before: {role: target.role, scope: target.scope},
        after: {role: newRole, scope},
        ...(input.reason !== undefined && {reason: input.reason}),
        device: input.device ?? {},
      });

      return {membershipId: id, role: newRole};
    });
  }

  // Role and scope change together, so a coordinator never ends up without
  // venues nor an accountant with some.
  private async scopeFor(
    tx: TransactionContext,
    input: ChangeMembershipRoleInput,
    current: Scope,
  ): Promise<Scope> {
    const {newRole, scope: requested, tenantId} = input;

    // Their scope is made of players, which survive the role change.
    if (newRole === "guardian" || newRole === "adultPlayer") {
      if (requested?.venueIds?.length || requested?.groupIds?.length) {
        throw new DomainError(
          "invalid_argument",
          `A ${newRole} is not scoped by venues or groups`,
        );
      }
      return current;
    }

    const scope = resolveScopeForRole(newRole, requested);
    await assertScopeReferences(tx, tenantId, scope);
    return scope;
  }
}
