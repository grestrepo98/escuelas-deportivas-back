import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {DEFAULT_POLICY_WARNING_DAYS} from "../../tenant/domain/tenant.js";
import type {PlayerDocument, PolicyStatus} from "../domain/document.js";
import {
  assertCanAccessPlayerDocuments,
  visibleTypesFor,
} from "../domain/document-visibility.js";
import {policyStatus} from "../domain/policy-status.js";
import type {PlayerReader} from "./player-reader.js";
import {requireReader} from "./require-reader.js";

export type ListPlayerDocumentsInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  history?: boolean;
};

export type ListPlayerDocumentsResult = {
  documents: PlayerDocument[];
  policyStatus: PolicyStatus;
};

export class ListPlayerDocuments {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly players: PlayerReader,
    private readonly clock: Clock,
  ) {}

  execute(input: ListPlayerDocumentsInput): Promise<ListPlayerDocumentsResult> {
    const {tenantId, actorUid, playerId} = input;

    return this.unitOfWork.run(async ({memberships, documents, tenants}) => {
      const actor = await requireReader(memberships, tenantId, actorUid);
      const player = await this.players.get(tenantId, playerId);
      if (!player) {
        throw new DomainError("not_found", "Player not found");
      }
      assertCanAccessPlayerDocuments(actor, player);

      const visible = visibleTypesFor(actor);
      const all = await documents.listByPlayer(tenantId, playerId, {
        includeSuperseded: input.history === true,
      });
      const current = await documents.findCurrent(tenantId, playerId, "policy");
      const tenant = await tenants.get(tenantId);

      return {
        documents: all.filter((document) => visible.includes(document.type)),
        policyStatus: policyStatus(
          current?.policy,
          this.clock.now(),
          tenant?.policyWarningDays ?? DEFAULT_POLICY_WARNING_DAYS,
        ),
      };
    });
  }
}
