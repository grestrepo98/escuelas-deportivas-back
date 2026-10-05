import type {MembershipDeactivationGuard} from "../membership-deactivation-guard.js";

// The default until phase 2 brings the cash register: never blocks.
export class AllowAllDeactivationGuard implements MembershipDeactivationGuard {
  async assertCanDeactivate(): Promise<void> {}
}
