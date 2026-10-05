import type {Membership} from "../domain/membership.js";

// Hook for C21: phase 2 plugs in a guard that checks the open cash register.
// Throws DomainError("failed_precondition") when the membership cannot be
// deactivated right now.
export interface MembershipDeactivationGuard {
  assertCanDeactivate(membership: Membership): Promise<void>;
}
