import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {Player} from "../domain/player.js";
import {assertCanWriteInVenue} from "../domain/player-visibility.js";
import {loadWritablePlayer} from "./load-writable-player.js";
import {requireStaff} from "./require-staff.js";

// Only the data: any charge for the change belongs to the money phase (C10).
export type ChangePlayerPlacementInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  groupId: string;
  reason?: string;
  device?: {userAgent?: string};
};

export type ChangePlayerPlacementResult = {
  playerId: string;
  groupId: string;
  venueId: string;
  categoryId: string;
};

const placementOf = (
  player: Pick<Player, "groupId" | "venueId" | "categoryId">,
) => ({
  groupId: player.groupId,
  venueId: player.venueId,
  categoryId: player.categoryId,
});

export class ChangePlayerPlacement {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(
    input: ChangePlayerPlacementInput,
  ): Promise<ChangePlayerPlacementResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, groups, players, playerHistory, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        // The origin venue must be the coordinator's...
        const existing = await loadWritablePlayer(
          players,
          actor,
          tenantId,
          input.playerId,
        );

        const target = await groups.get(tenantId, input.groupId);
        if (!target) {
          throw new DomainError("not_found", "Group not found");
        }
        // ...and so must the destination.
        assertCanWriteInVenue(actor, target.venueId);
        if (target.status !== "active") {
          throw new DomainError("failed_precondition", "The group is closed");
        }
        if (target.id === existing.groupId) {
          throw new DomainError(
            "failed_precondition",
            "The player is already in that group",
          );
        }

        const now = this.clock.now();
        const reason = input.reason?.trim() || null;
        const before = placementOf(existing);
        const moved: Player = {
          ...existing,
          groupId: target.id,
          venueId: target.venueId,
          categoryId: target.categoryId,
          updatedAt: now,
        };
        await players.save(moved);

        await playerHistory.append(tenantId, moved.id, {
          type: "placement",
          before,
          after: placementOf(moved),
          reason,
          actorUid,
        });
        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "player.placement_changed",
          target: {type: "player", id: moved.id},
          before,
          after: placementOf(moved),
          ...(reason ? {reason} : {}),
          device: input.device ?? {},
        });

        return {playerId: moved.id, ...placementOf(moved)};
      },
    );
  }
}
