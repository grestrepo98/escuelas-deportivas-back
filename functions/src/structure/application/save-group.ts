import {DomainError} from "../../shared/domain/errors.js";
import {requireOwner} from "../../membership/application/require-owner.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {requireActiveCategory, requireActiveVenue} from "./group-parents.js";
import type {Group, ScheduleSlot} from "../domain/structure.js";
import {
  isNameTaken,
  validateName,
  validateSchedule,
} from "../domain/validation.js";

export type SaveGroupInput = {
  tenantId: string;
  actorUid: string;
  groupId?: string; // absent = create
  venueId?: string; // required to create; on update it must not change
  categoryId: string;
  name: string;
  schedule: ScheduleSlot[];
  device?: {userAgent?: string};
};

export type SaveGroupResult = {groupId: string};

const snapshot = (group: Group): Record<string, unknown> => ({
  venueId: group.venueId,
  categoryId: group.categoryId,
  name: group.name,
  schedule: group.schedule,
  status: group.status,
});

export class SaveGroup {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SaveGroupInput): Promise<SaveGroupResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, venues, categories, groups, auditLog}) => {
        const actorRole = await requireOwner(memberships, tenantId, actorUid);

        const name = validateName(input.name);
        const schedule = validateSchedule(input.schedule);
        const now = this.clock.now();

        const existing = input.groupId
          ? await groups.get(tenantId, input.groupId)
          : null;
        if (input.groupId && !existing) {
          throw new DomainError("not_found", "Group not found");
        }

        let venueId: string;
        if (existing) {
          if (
            input.venueId !== undefined &&
            input.venueId !== existing.venueId
          ) {
            throw new DomainError(
              "failed_precondition",
              "A group cannot change venue: close it and create another",
            );
          }
          venueId = existing.venueId;
        } else {
          if (!input.venueId) {
            throw new DomainError(
              "invalid_argument",
              "venueId is required to create a group",
            );
          }
          venueId = input.venueId;
          await requireActiveVenue(venues, tenantId, venueId);
        }

        if (!existing || existing.categoryId !== input.categoryId) {
          await requireActiveCategory(categories, tenantId, input.categoryId);
        }

        // A closed group does not hold its name.
        if (!existing || existing.status === "active") {
          const inVenue = (await groups.listByTenant(tenantId)).filter(
            (g) => g.venueId === venueId,
          );
          if (isNameTaken(inVenue, name, existing?.id)) {
            throw new DomainError(
              "failed_precondition",
              "An active group of the venue already uses that name",
            );
          }
        }

        const saved: Group = {
          id: existing?.id ?? groups.newId(),
          tenantId,
          venueId,
          categoryId: input.categoryId,
          name,
          schedule,
          status: existing?.status ?? "active",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await groups.save(saved);

        await auditLog.append({
          tenantId,
          actorUid,
          actorRole,
          action: existing ? "group.updated" : "group.created",
          target: {type: "group", id: saved.id},
          before: existing ? snapshot(existing) : {},
          after: snapshot(saved),
          device: input.device ?? {},
        });

        return {groupId: saved.id};
      },
    );
  }
}
