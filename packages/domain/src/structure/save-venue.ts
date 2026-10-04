import {DomainError} from "../errors.js";
import {requireOwner} from "../membership/require-owner.js";
import type {Clock} from "../ports/clock.js";
import type {UnitOfWork} from "../ports/unit-of-work.js";
import type {Venue} from "./structure.js";
import {isNameTaken, validateName} from "./validation.js";

export type SaveVenueInput = {
  tenantId: string;
  actorUid: string;
  venueId?: string; // absent = create
  name: string;
  address: string;
  facility?: string;
  device?: {userAgent?: string};
};

export type SaveVenueResult = {venueId: string};

const snapshot = (venue: Venue): Record<string, unknown> => ({
  name: venue.name,
  address: venue.address,
  ...(venue.facility !== undefined && {facility: venue.facility}),
  status: venue.status,
});

export class SaveVenue {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SaveVenueInput): Promise<SaveVenueResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, venues, auditLog}) => {
      const actorRole = await requireOwner(memberships, tenantId, actorUid);

      const name = validateName(input.name);
      const address = validateName(input.address, "address");
      const facility = input.facility?.trim() || undefined;
      const now = this.clock.now();

      const existing = input.venueId ?
        await venues.get(tenantId, input.venueId) :
        null;
      if (input.venueId && !existing) {
        throw new DomainError("not_found", "Venue not found");
      }

      // A closed venue does not hold its name.
      if (!existing || existing.status === "active") {
        const all = await venues.listByTenant(tenantId);
        if (isNameTaken(all, name, existing?.id)) {
          throw new DomainError(
            "failed_precondition",
            "An active venue already uses that name",
          );
        }
      }

      const saved: Venue = {
        id: existing?.id ?? venues.newId(),
        tenantId,
        name,
        address,
        ...(facility !== undefined && {facility}),
        status: existing?.status ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await venues.save(saved);

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: existing ? "venue.updated" : "venue.created",
        target: {type: "venue", id: saved.id},
        before: existing ? snapshot(existing) : {},
        after: snapshot(saved),
        device: input.device ?? {},
      });

      return {venueId: saved.id};
    });
  }
}
