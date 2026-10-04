import {DomainError} from "../errors.js";
import type {
  CategoryRepository,
  VenueRepository,
} from "../ports/structure-repository.js";

// A group may only live under a venue and a category that exist and are
// active; this is checked when creating, reopening or recategorizing.
export async function requireActiveVenue(
  venues: VenueRepository,
  tenantId: string,
  venueId: string,
): Promise<void> {
  const venue = await venues.get(tenantId, venueId);
  if (!venue) {
    throw new DomainError("not_found", "Venue not found");
  }
  if (venue.status !== "active") {
    throw new DomainError("failed_precondition", "The venue is closed");
  }
}

export async function requireActiveCategory(
  categories: CategoryRepository,
  tenantId: string,
  categoryId: string,
): Promise<void> {
  const category = await categories.get(tenantId, categoryId);
  if (!category) {
    throw new DomainError("not_found", "Category not found");
  }
  if (category.status !== "active") {
    throw new DomainError("failed_precondition", "The category is closed");
  }
}
