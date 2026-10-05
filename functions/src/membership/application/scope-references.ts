import {DomainError} from "../../shared/domain/errors.js";
import type {Scope} from "../domain/membership.js";
import type {
  GroupRepository,
  VenueRepository,
} from "../../structure/application/structure-repository.js";

type StructureReaders = {venues: VenueRepository; groups: GroupRepository};

// Every venue and group a scope points to must exist in this organization and
// be active. The repositories are tenant-scoped, so an id from another
// organization is indistinguishable from a missing one: both are a bad
// request (400), while a closed one is a precondition failure (409).
export async function assertScopeReferences(
  {venues, groups}: StructureReaders,
  tenantId: string,
  scope: Pick<Scope, "venueIds" | "groupIds">,
): Promise<void> {
  for (const venueId of scope.venueIds) {
    const venue = await venues.get(tenantId, venueId);
    if (!venue) {
      throw new DomainError("invalid_argument", `Unknown venue: ${venueId}`);
    }
    if (venue.status !== "active") {
      throw new DomainError(
        "failed_precondition",
        `The venue is closed: ${venueId}`,
      );
    }
  }
  for (const groupId of scope.groupIds) {
    const group = await groups.get(tenantId, groupId);
    if (!group) {
      throw new DomainError("invalid_argument", `Unknown group: ${groupId}`);
    }
    if (group.status !== "active") {
      throw new DomainError(
        "failed_precondition",
        `The group is closed: ${groupId}`,
      );
    }
  }
}
