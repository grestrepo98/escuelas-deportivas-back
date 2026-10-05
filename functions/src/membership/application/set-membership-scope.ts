import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {membershipId, type Scope} from "../domain/membership.js";
import {resolveScopeForRole, type ScopeInput} from "../domain/scope.js";
import {requireOwner} from "./require-owner.js";
import {assertScopeReferences} from "./scope-references.js";

export type SetMembershipScopeInput = {
  tenantId: string;
  actorUid: string;
  targetUid: string;
  scope: ScopeInput;
  device?: {userAgent?: string};
};

export type SetMembershipScopeResult = {
  membershipId: string;
  scope: Scope;
};

// Replaces the whole scope of a membership. The role does not change here:
// the new scope must fit it (see resolveScopeForRole).
export class SetMembershipScope {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SetMembershipScopeInput): Promise<SetMembershipScopeResult> {
    const {tenantId, actorUid, targetUid} = input;

    return this.unitOfWork.run(async (tx) => {
      const actorRole = await requireOwner(tx.memberships, tenantId, actorUid);

      const target = await tx.memberships.get(targetUid, tenantId);
      if (!target) {
        throw new DomainError("not_found", "Membership not found");
      }
      // Their scope is made of players, which only a later spec can assign.
      if (target.role === "guardian" || target.role === "adultPlayer") {
        throw new DomainError(
          "invalid_argument",
          `The scope of a ${target.role} is not managed here`,
        );
      }

      const scope = resolveScopeForRole(target.role, input.scope);
      await assertScopeReferences(tx, tenantId, scope);

      await tx.memberships.save({
        ...target,
        scope,
        updatedAt: this.clock.now(),
      });

      const id = membershipId(targetUid, tenantId);
      await tx.auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: "membership.scope_changed",
        target: {type: "membership", id},
        before: {scope: target.scope},
        after: {scope},
        device: input.device ?? {},
      });

      return {membershipId: id, scope};
    });
  }
}
