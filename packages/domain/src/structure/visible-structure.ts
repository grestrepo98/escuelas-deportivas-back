import {DomainError} from "../errors.js";
import type {Membership} from "../membership/membership.js";
import type {Category, Group, Venue} from "./structure.js";

export type Structure = {
  venues: Venue[];
  categories: Category[];
  groups: Group[];
};

// Applies the visibility table of the structure to a membership. The caller
// has already proven the membership is active in the tenant. An empty scope
// means "no restriction" only for owner and accountant (spec 01); a
// coordinator or teacher with an empty scope sees nothing.
export function visibleStructure(
  membership: Membership,
  structure: Structure,
): Structure {
  const {role, scope} = membership;

  switch (role) {
  case "owner":
  case "accountant":
    return structure;

  case "coordinator": {
    const venueIds = new Set(scope.venueIds);
    return {
      venues: structure.venues.filter((v) => venueIds.has(v.id)),
      categories: venueIds.size === 0 ? [] : structure.categories,
      groups: structure.groups.filter((g) => venueIds.has(g.venueId)),
    };
  }

  case "teacher": {
    const groupIds = new Set(scope.groupIds);
    const groups = structure.groups.filter((g) => groupIds.has(g.id));
    const venueIds = new Set(groups.map((g) => g.venueId));
    const categoryIds = new Set(groups.map((g) => g.categoryId));
    return {
      venues: structure.venues.filter((v) => venueIds.has(v.id)),
      categories: structure.categories.filter((c) => categoryIds.has(c.id)),
      groups,
    };
  }

  default:
    throw new DomainError(
      "permission_denied",
      "This role cannot read the organization structure",
    );
  }
}
