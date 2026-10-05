import {DomainError} from "../../shared/domain/errors.js";
import type {GuardianLink} from "./player.js";

// Shape rules: no repeated guardian and at most one payment responsible.
export function validateGuardianLinks(links: GuardianLink[]): void {
  const seen = new Set<string>();
  for (const link of links) {
    if (seen.has(link.guardianId)) {
      throw new DomainError(
        "invalid_argument",
        "A guardian cannot be linked twice to the same player",
      );
    }
    seen.add(link.guardianId);
  }
  if (links.filter((link) => link.isPaymentResponsible).length > 1) {
    throw new DomainError(
      "invalid_argument",
      "A player has at most one payment responsible guardian",
    );
  }
}

export function paymentResponsibleOf(
  links: GuardianLink[],
): GuardianLink | null {
  return links.find((link) => link.isPaymentResponsible) ?? null;
}

// An active player has exactly one payment responsible guardian.
export function assertActiveHasResponsible(links: GuardianLink[]): void {
  if (links.filter((link) => link.isPaymentResponsible).length !== 1) {
    throw new DomainError(
      "failed_precondition",
      "An active player needs exactly one payment responsible guardian",
    );
  }
}
