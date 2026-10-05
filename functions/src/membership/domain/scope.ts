import {DomainError} from "../../shared/domain/errors.js";
import type {Scope} from "./membership.js";
import type {Role} from "./role.js";

// What a client may send: players are never assigned by hand.
export type ScopeInput = {venueIds?: string[]; groupIds?: string[]};

function unique(ids: string[], field: string): string[] {
  for (const id of ids) {
    if (id.trim() === "") {
      throw new DomainError("invalid_argument", `${field} has a blank id`);
    }
  }
  return [...new Set(ids)];
}

function invalid(message: string): never {
  throw new DomainError("invalid_argument", message);
}

// Pure shape rule per role (spec 05). Whether the venues and groups exist and
// are active is checked by the use case, inside the transaction.
// guardian and adultPlayer are not validated here: their scope is player ids,
// which only exist once the players module does.
export function resolveScopeForRole(
  role: Role,
  input: ScopeInput | undefined,
): Scope {
  const venueIds = unique(input?.venueIds ?? [], "venueIds");
  const groupIds = unique(input?.groupIds ?? [], "groupIds");
  const scope: Scope = {venueIds, groupIds, playerIds: []};

  switch (role) {
    case "owner":
    case "accountant":
      if (venueIds.length > 0 || groupIds.length > 0) {
        invalid(`${role} has no scope: venueIds and groupIds must be empty`);
      }
      return scope;
    case "coordinator":
      if (venueIds.length === 0) {
        invalid("a coordinator needs at least one venue");
      }
      if (groupIds.length > 0) {
        invalid("a coordinator is scoped by venues, not groups");
      }
      return scope;
    case "teacher":
      if (groupIds.length === 0) {
        invalid("a teacher needs at least one group");
      }
      if (venueIds.length > 0) {
        invalid("a teacher is scoped by groups, not venues");
      }
      return scope;
    default:
      return scope;
  }
}
