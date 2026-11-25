import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {requireStaff} from "../../player/application/require-staff.js";
import {DEFAULT_POLICY_WARNING_DAYS} from "../../tenant/domain/tenant.js";
import type {PolicyData, PolicyStatus} from "../domain/document.js";
import {canAccessPlayerDocuments} from "../domain/document-visibility.js";
import {policyStatus} from "../domain/policy-status.js";
import type {PlayerReader} from "./player-reader.js";

export type ListCategoryPoliciesInput = {
  tenantId: string;
  actorUid: string;
  categoryId: string;
};

export type CategoryPolicyItem = {
  playerId: string;
  fullName: string;
  groupId: string;
  policy?: PolicyData;
  policyStatus: PolicyStatus;
};

export type ListCategoryPoliciesResult = {items: CategoryPolicyItem[]};

// Who has a policy and who does not, for registering teams in the league.
export class ListCategoryPolicies {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly players: PlayerReader,
    private readonly clock: Clock,
  ) {}

  execute(
    input: ListCategoryPoliciesInput,
  ): Promise<ListCategoryPoliciesResult> {
    const {tenantId, actorUid, categoryId} = input;

    return this.unitOfWork.run(
      async ({memberships, categories, documents, tenants}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        if (!(await categories.get(tenantId, categoryId))) {
          throw new DomainError("not_found", "Category not found");
        }

        const players = (
          await this.players.listByCategory(tenantId, categoryId)
        ).filter((player) => canAccessPlayerDocuments(actor, player));
        const policies = await documents.listCurrentPolicies(
          tenantId,
          players.map((player) => player.id),
        );
        const byPlayer = new Map(policies.map((p) => [p.playerId, p.policy]));
        const tenant = await tenants.get(tenantId);
        const now = this.clock.now();
        const warningDays =
          tenant?.policyWarningDays ?? DEFAULT_POLICY_WARNING_DAYS;

        const items = players
          .map((player): CategoryPolicyItem => {
            const policy = byPlayer.get(player.id);
            return {
              playerId: player.id,
              fullName: player.fullName,
              groupId: player.groupId,
              ...(policy !== undefined && {policy}),
              policyStatus: policyStatus(policy, now, warningDays),
            };
          })
          .sort(
            (a, b) =>
              a.groupId.localeCompare(b.groupId) ||
              a.fullName.localeCompare(b.fullName),
          );
        return {items};
      },
    );
  }
}
