import {DomainError} from "../../shared/domain/errors.js";
import {requireOwner} from "../../membership/application/require-owner.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {StructureStatus} from "../domain/structure.js";
import {isNameTaken} from "../domain/validation.js";

export type SetVenueStatusInput = {
  tenantId: string;
  actorUid: string;
  venueId: string;
  status: StructureStatus;
  reason?: string;
  device?: {userAgent?: string};
};

export type SetVenueStatusResult = {
  venueId: string;
  status: StructureStatus;
};

export class SetVenueStatus {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SetVenueStatusInput): Promise<SetVenueStatusResult> {
    const {tenantId, actorUid, venueId, status} = input;

    return this.unitOfWork.run(
      async ({memberships, venues, groups, auditLog}) => {
        const actorRole = await requireOwner(memberships, tenantId, actorUid);

        const venue = await venues.get(tenantId, venueId);
        if (!venue) {
          throw new DomainError("not_found", "Venue not found");
        }
        if (venue.status === status) {
          throw new DomainError(
            "failed_precondition",
            `The venue is already ${status}`,
          );
        }

        if (status === "closed") {
          const tenantGroups = await groups.listByTenant(tenantId);
          if (
            tenantGroups.some(
              (g) => g.venueId === venueId && g.status === "active",
            )
          ) {
            throw new DomainError(
              "failed_precondition",
              "Close or move the active groups of the venue first",
            );
          }
        } else {
          const all = await venues.listByTenant(tenantId);
          if (isNameTaken(all, venue.name, venue.id)) {
            throw new DomainError(
              "failed_precondition",
              "An active venue already uses that name",
            );
          }
        }

        await venues.save({...venue, status, updatedAt: this.clock.now()});

        await auditLog.append({
          tenantId,
          actorUid,
          actorRole,
          action: status === "closed" ? "venue.closed" : "venue.reopened",
          target: {type: "venue", id: venueId},
          before: {status: venue.status},
          after: {status},
          ...(input.reason !== undefined && {reason: input.reason}),
          device: input.device ?? {},
        });

        return {venueId, status};
      },
    );
  }
}
