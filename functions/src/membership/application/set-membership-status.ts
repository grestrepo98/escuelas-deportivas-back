import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {membershipId, type MembershipStatus} from "../domain/membership.js";
import type {MembershipDeactivationGuard} from "./membership-deactivation-guard.js";
import {requireOwner} from "./require-owner.js";
import {assertScopeReferences} from "./scope-references.js";

export type SetMembershipStatusInput = {
  tenantId: string;
  actorUid: string;
  targetUid: string;
  status: MembershipStatus;
  reason?: string;
  device?: {userAgent?: string};
};

export type SetMembershipStatusResult = {
  membershipId: string;
  status: MembershipStatus;
};

// Deactivating cuts access on the next call (D-06) and deletes nothing. The
// Firebase Auth account stays: the person may belong to other organizations.
export class SetMembershipStatus {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly deactivationGuard: MembershipDeactivationGuard,
    private readonly clock: Clock,
  ) {}

  execute(input: SetMembershipStatusInput): Promise<SetMembershipStatusResult> {
    const {tenantId, actorUid, targetUid, status} = input;

    return this.unitOfWork.run(async (tx) => {
      const actorRole = await requireOwner(tx.memberships, tenantId, actorUid);

      const target = await tx.memberships.get(targetUid, tenantId);
      if (!target) {
        throw new DomainError("not_found", "Membership not found");
      }
      if (target.status === status) {
        throw new DomainError(
          "failed_precondition",
          `The membership is already ${status}`,
        );
      }

      if (status === "inactive") {
        // C21: phase 2 plugs in the open cash register check here.
        await this.deactivationGuard.assertCanDeactivate(target);

        if (target.role === "owner") {
          const activeOwners = await tx.memberships.countActiveByRole(
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
      } else {
        // Venues and groups may have been closed while it was inactive.
        await assertScopeReferences(tx, tenantId, target.scope);
      }

      await tx.memberships.save({
        ...target,
        status,
        updatedAt: this.clock.now(),
      });

      const id = membershipId(targetUid, tenantId);
      await tx.auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: "membership.status_changed",
        target: {type: "membership", id},
        before: {status: target.status},
        after: {status},
        ...(input.reason !== undefined && {reason: input.reason}),
        device: input.device ?? {},
      });

      return {membershipId: id, status};
    });
  }
}
