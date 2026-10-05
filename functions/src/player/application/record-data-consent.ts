import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {DataConsent} from "../domain/player.js";
import {loadWritablePlayer} from "./load-writable-player.js";
import {requireStaff} from "./require-staff.js";

export type RecordDataConsentInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  guardianId: string; // the guardian who gave the consent; must be linked
  device?: {userAgent?: string};
};

export type RecordDataConsentResult = {
  playerId: string;
  dataConsent: DataConsent;
};

export class RecordDataConsent {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: RecordDataConsentInput): Promise<RecordDataConsentResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, players, auditLog}) => {
      const actor = await requireStaff(memberships, tenantId, actorUid);
      const existing = await loadWritablePlayer(
        players,
        actor,
        tenantId,
        input.playerId,
      );
      if (!existing.guardianIds.includes(input.guardianId)) {
        throw new DomainError(
          "failed_precondition",
          "The guardian is not linked to the player",
        );
      }

      const now = this.clock.now();
      const dataConsent: DataConsent = {
        guardianId: input.guardianId,
        recordedBy: actorUid,
        at: now,
      };
      await players.save({...existing, dataConsent, updatedAt: now});

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole: actor.role,
        action: "player.consent_recorded",
        target: {type: "player", id: existing.id},
        before: {guardianId: existing.dataConsent?.guardianId ?? null},
        after: {guardianId: input.guardianId},
        device: input.device ?? {},
      });

      return {playerId: existing.id, dataConsent};
    });
  }
}
