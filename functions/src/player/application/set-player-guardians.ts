import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {
  assertActiveHasResponsible,
  paymentResponsibleOf,
} from "../domain/guardian-links.js";
import type {GuardianLink} from "../domain/player.js";
import {loadWritablePlayer} from "./load-writable-player.js";
import {requireStaff} from "./require-staff.js";
import {
  resolveGuardianLinks,
  type GuardianLinkInput,
} from "./resolve-guardian-links.js";

// Replaces the whole set of guardians of a player.
export type SetPlayerGuardiansInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  guardians: GuardianLinkInput[];
  device?: {userAgent?: string};
};

export type SetPlayerGuardiansResult = {
  playerId: string;
  createdGuardianIds: string[];
};

const snapshot = (links: GuardianLink[]): Record<string, unknown> => ({
  guardianIds: links.map((link) => link.guardianId),
  paymentResponsibleId: paymentResponsibleOf(links)?.guardianId ?? null,
});

export class SetPlayerGuardians {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SetPlayerGuardiansInput): Promise<SetPlayerGuardiansResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, players, guardians, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        const existing = await loadWritablePlayer(
          players,
          actor,
          tenantId,
          input.playerId,
        );

        const now = this.clock.now();
        const {links, created} = await resolveGuardianLinks(
          guardians,
          tenantId,
          input.guardians,
          now,
        );
        if (existing.status === "activo") {
          assertActiveHasResponsible(links);
        }

        for (const guardian of created) {
          await guardians.save(guardian);
          await auditLog.append({
            tenantId,
            actorUid,
            actorRole: actor.role,
            action: "guardian.created",
            target: {type: "guardian", id: guardian.id},
            before: {},
            after: {
              firstNames: guardian.firstNames,
              lastNames: guardian.lastNames,
            },
            device: input.device ?? {},
          });
        }

        // The data consent stays: it is a record of what was signed, even if
        // the guardian who gave it is no longer linked.
        await players.save({
          ...existing,
          guardians: links,
          guardianIds: links.map((link) => link.guardianId),
          updatedAt: now,
        });
        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "player.guardians_changed",
          target: {type: "player", id: existing.id},
          before: snapshot(existing.guardians),
          after: snapshot(links),
          device: input.device ?? {},
        });

        return {
          playerId: existing.id,
          createdGuardianIds: created.map((guardian) => guardian.id),
        };
      },
    );
  }
}
