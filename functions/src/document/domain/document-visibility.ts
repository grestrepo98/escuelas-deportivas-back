import type {Membership} from "../../membership/domain/membership.js";
import {assertCanWriteInVenue} from "../../player/domain/player-visibility.js";
import {DomainError} from "../../shared/domain/errors.js";
import {DOCUMENT_TYPES} from "./document.js";
import type {DocumentType} from "./document.js";

// Where the player is, plus the type of document being read.
export type DocumentTarget = {
  venueId: string;
  groupId: string;
  type: DocumentType;
};

// A teacher needs the photo and the policy at a match, nothing else.
const TEACHER_TYPES: readonly DocumentType[] = ["photo", "policy"];

function denied(message: string): DomainError {
  return new DomainError("permission_denied", message);
}

export function visibleTypesFor(membership: Membership): DocumentType[] {
  return membership.role === "teacher"
    ? [...TEACHER_TYPES]
    : [...DOCUMENT_TYPES];
}

type PlayerPlace = Pick<DocumentTarget, "venueId" | "groupId">;

// The scope rule alone, whatever the document type. The caller has already
// proven the membership is active in the tenant.
export function canAccessPlayerDocuments(
  membership: Membership,
  player: PlayerPlace,
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

export function assertCanAccessPlayerDocuments(
  membership: Membership,
  player: PlayerPlace,
): void {
  if (canAccessPlayerDocuments(membership, player)) return;
  switch (membership.role) {
    case "coordinator":
      throw denied("This player is outside your venues");
    case "teacher":
      throw denied("This player is outside your groups");
    default:
      throw denied("This role cannot read documents");
  }
}

// Scope plus type: a teacher reads only the photo and the policy.
export function assertCanReadDocument(
  membership: Membership,
  document: DocumentTarget,
): void {
  assertCanAccessPlayerDocuments(membership, document);
  if (!visibleTypesFor(membership).includes(document.type)) {
    throw denied("This role cannot read this document type");
  }
}

// Same writers as the player module: owner, accountant and coordinator (in
// their venues).
export function assertCanWriteDocument(
  membership: Membership,
  venueId: string,
): void {
  assertCanWriteInVenue(membership, venueId);
}
