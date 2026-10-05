import {DomainError} from "../../shared/domain/errors.js";
import type {Membership} from "../../membership/domain/membership.js";
import type {Player} from "./player.js";

// What a teacher sees: no document, guardians or consent. `documentKey` and
// `guardianIds` go too because they reveal the document and the guardians.
export type TeacherPlayerView = Omit<
  Player,
  "document" | "documentKey" | "guardians" | "guardianIds" | "dataConsent"
>;

const LISTER_ROLES: Membership["role"][] = [
  "owner",
  "accountant",
  "coordinator",
  "teacher",
];

function denied(message: string): DomainError {
  return new DomainError("permission_denied", message);
}

// The caller has already proven the membership is active in the tenant. An
// empty scope means "no restriction" only for owner and accountant; a
// coordinator or teacher with an empty scope sees nothing.
export function canReadPlayer(
  membership: Membership,
  player: Pick<Player, "venueId" | "groupId">,
): boolean {
  const {role, scope} = membership;
  switch (role) {
    case "owner":
    case "accountant":
      return true;
    case "coordinator":
      return scope.venueIds.includes(player.venueId);
    case "teacher":
      return scope.groupIds.includes(player.groupId);
    default:
      return false;
  }
}

export function assertCanReadPlayer(
  membership: Membership,
  player: Pick<Player, "venueId" | "groupId">,
): void {
  if (canReadPlayer(membership, player)) return;
  switch (membership.role) {
    case "coordinator":
      throw denied("This player is outside your venues");
    case "teacher":
      throw denied("This player is outside your groups");
    default:
      throw denied("This role cannot read players");
  }
}

// Who may list players at all, before any scope is applied.
export function assertCanListPlayers(membership: Membership): void {
  if (!LISTER_ROLES.includes(membership.role)) {
    throw denied("This role cannot list players");
  }
}

// Owner, accountant and coordinator (in their venues) write. A teacher does
// not.
export function assertCanWriteInVenue(
  membership: Membership,
  venueId: string,
): void {
  const {role, scope} = membership;
  switch (role) {
    case "owner":
    case "accountant":
      return;
    case "coordinator":
      if (scope.venueIds.includes(venueId)) return;
      throw denied("This venue is outside your venues");
    default:
      throw denied("This role cannot change players");
  }
}

export function playerViewFor(
  membership: Membership,
  player: Player,
): Player | TeacherPlayerView {
  assertCanReadPlayer(membership, player);
  if (membership.role !== "teacher") {
    return player;
  }
  const view: Partial<Player> = {...player};
  delete view.document;
  delete view.documentKey;
  delete view.guardians;
  delete view.guardianIds;
  delete view.dataConsent;
  return view as TeacherPlayerView;
}

// Who may see or edit a guardian: owner and accountant always; a coordinator
// only when the guardian is linked to a player of their venues. `linked` are
// the players the guardian is linked to.
export function canSeeGuardian(
  membership: Membership,
  linked: Pick<Player, "venueId">[],
): boolean {
  switch (membership.role) {
    case "owner":
    case "accountant":
      return true;
    case "coordinator":
      return linked.some((player) =>
        membership.scope.venueIds.includes(player.venueId),
      );
    default:
      return false;
  }
}
