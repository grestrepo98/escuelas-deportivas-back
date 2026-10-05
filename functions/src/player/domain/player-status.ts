import {DomainError} from "../../shared/domain/errors.js";
import {assertActiveHasResponsible} from "./guardian-links.js";
import type {DataConsent, GuardianLink, PlayerStatus} from "./player.js";

// "retirado -> preinscrito | activo" is the re-entry of the same profile (C12).
const TRANSITIONS: Record<PlayerStatus, readonly PlayerStatus[]> = {
  preinscrito: ["activo", "retirado"],
  activo: ["pausado", "retirado"],
  pausado: ["activo", "retirado"],
  retirado: ["preinscrito", "activo"],
};

const REASON_REQUIRED: readonly PlayerStatus[] = ["pausado", "retirado"];

export function assertStatusChange(input: {
  from: PlayerStatus;
  to: PlayerStatus;
  reason?: string | null;
}): void {
  const {from, to, reason} = input;
  if (from === to) {
    throw new DomainError("failed_precondition", `The player is already ${to}`);
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError(
      "failed_precondition",
      `A ${from} player cannot become ${to}`,
    );
  }
  if (REASON_REQUIRED.includes(to) && (reason ?? "").trim() === "") {
    throw new DomainError(
      "invalid_argument",
      `A reason is required to move a player to ${to}`,
    );
  }
}

// Becoming active needs a payment responsible, the data consent and an
// active group.
export function assertCanActivate(input: {
  guardians: GuardianLink[];
  dataConsent: DataConsent | null;
  groupActive: boolean;
}): void {
  assertActiveHasResponsible(input.guardians);
  if (input.dataConsent === null) {
    throw new DomainError(
      "failed_precondition",
      "The data consent must be recorded before activating a player",
    );
  }
  if (!input.groupActive) {
    throw new DomainError(
      "failed_precondition",
      "An active player needs an active group",
    );
  }
}
