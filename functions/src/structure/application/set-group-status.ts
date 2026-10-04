import {DomainError} from "../../shared/domain/errors.js";
import {requireOwner} from "../../membership/application/require-owner.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {requireActiveCategory, requireActiveVenue} from "./group-parents.js";
import type {StructureStatus} from "../domain/structure.js";
import {isNameTaken} from "../domain/validation.js";

export type SetGroupStatusInput = {
  tenantId: string;
  actorUid: string;
  groupId: string;
  status: StructureStatus;
  reason?: string;
  device?: {userAgent?: string};
};

export type SetGroupStatusResult = {
  groupId: string;
  status: StructureStatus;
};

export class SetGroupStatus {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SetGroupStatusInput): Promise<SetGroupStatusResult> {
    const {tenantId, actorUid, groupId, status} = input;

    return this.unitOfWork.run(
      async ({memberships, venues, categories, groups, auditLog}) => {
        const actorRole = await requireOwner(memberships, tenantId, actorUid);

        const group = await groups.get(tenantId, groupId);
        if (!group) {
          throw new DomainError("not_found", "Group not found");
        }
        if (group.status === status) {
          throw new DomainError(
            "failed_precondition",
            `The group is already ${status}`,
          );
        }

        if (status === "active") {
          await requireActiveVenue(venues, tenantId, group.venueId);
          await requireActiveCategory(categories, tenantId, group.categoryId);
          const inVenue = (await groups.listByTenant(tenantId))
            .filter((g) => g.venueId === group.venueId);
          if (isNameTaken(inVenue, group.name, group.id)) {
            throw new DomainError(
              "failed_precondition",
              "An active group of the venue already uses that name",
            );
          }
        }

        await groups.save({...group, status, updatedAt: this.clock.now()});

        await auditLog.append({
          tenantId,
          actorUid,
          actorRole,
          action: status === "closed" ? "group.closed" : "group.reopened",
          target: {type: "group", id: groupId},
          before: {status: group.status},
          after: {status},
          ...(input.reason !== undefined && {reason: input.reason}),
          device: input.device ?? {},
        });

        return {groupId, status};
      },
    );
  }
}
