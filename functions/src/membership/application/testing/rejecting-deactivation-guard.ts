import {DomainError} from "../../../shared/domain/errors.js";
import type {MembershipDeactivationGuard} from "../membership-deactivation-guard.js";

// Test double for the C21 case: always blocks the deactivation.
export class RejectingDeactivationGuard implements MembershipDeactivationGuard {
  constructor(
    private readonly message = "The membership cannot be deactivated",
  ) {}

  async assertCanDeactivate(): Promise<void> {
    throw new DomainError("failed_precondition", this.message);
  }
}
