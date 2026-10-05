import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {Player, PlayerStatus} from "../domain/player.js";
import {
  assertCanActivate,
  assertStatusChange,
} from "../domain/player-status.js";
import {loadWritablePlayer} from "./load-writable-player.js";
import {requireStaff} from "./require-staff.js";

// Statuses are set by hand; "en mora" is not one of them (Phase 2 computes it).
export type ChangePlayerStatusInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  status: PlayerStatus;
  reason?: string;
  device?: {userAgent?: string};
};

export type ChangePlayerStatusResult = {
  playerId: string;
  status: PlayerStatus;
};

export class ChangePlayerStatus {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: ChangePlayerStatusInput): Promise<ChangePlayerStatusResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, groups, players, playerHistory, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        const existing = await loadWritablePlayer(
          players,
          actor,
          tenantId,
          input.playerId,
        );

        assertStatusChange({
          from: existing.status,
          to: input.status,
          reason: input.reason,
        });
        if (input.status === "activo") {
          const group = await groups.get(tenantId, existing.groupId);
          assertCanActivate({
            guardians: existing.guardians,
            dataConsent: existing.dataConsent,
            groupActive: group?.status === "active",
          });
        }

        // A re-entry (C12) keeps the same profile: only the status moves,
        // and the history keeps every earlier entry.
        const now = this.clock.now();
        const reason = input.reason?.trim() || null;
        const changed: Player = {
          ...existing,
          status: input.status,
          statusReason: reason,
          updatedAt: now,
        };
        await players.save(changed);

        await playerHistory.append(tenantId, changed.id, {
          type: "status",
          before: {status: existing.status},
          after: {status: changed.status},
          reason,
          actorUid,
        });
        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "player.status_changed",
          target: {type: "player", id: changed.id},
          before: {status: existing.status},
          after: {status: changed.status},
          ...(reason ? {reason} : {}),
          device: input.device ?? {},
        });

        return {playerId: changed.id, status: changed.status};
      },
    );
  }
}
