import {DomainError} from "../../shared/domain/errors.js";
import type {Guardian, ContactPreference} from "../domain/guardian.js";
import {validateGuardianLinks} from "../domain/guardian-links.js";
import {documentKey} from "../domain/normalize.js";
import type {GuardianLink, PersonDocument} from "../domain/player.js";
import {validateRequiredText} from "../domain/validation.js";
import type {GuardianRepository} from "./guardian-repository.js";

export type NewGuardianInput = {
  firstNames: string;
  lastNames: string;
  document: PersonDocument;
  phone: string;
  email?: string | null;
  preferredContact: ContactPreference;
};

// An existing guardian by id, or a new one created in the same call.
export type GuardianLinkInput = (
  {guardianId: string} | {guardian: NewGuardianInput}
) & {
  relationship: string;
  isPaymentResponsible: boolean;
};

export type ResolvedGuardianLinks = {
  links: GuardianLink[];
  created: Guardian[]; // new guardians, not saved yet
};

export function guardianFullName(guardian: {
  firstNames: string;
  lastNames: string;
}): string {
  return `${guardian.firstNames} ${guardian.lastNames}`;
}

// Read-only: it resolves the links and builds the new guardians, and the
// caller saves them. Keeping every read before the first write is what
// Firestore transactions require.
export async function resolveGuardianLinks(
  guardians: GuardianRepository,
  tenantId: string,
  inputs: GuardianLinkInput[],
  now: Date,
): Promise<ResolvedGuardianLinks> {
  const links: GuardianLink[] = [];
  const created: Guardian[] = [];
  const newKeys = new Set<string>();

  for (const input of inputs) {
    const relationship = validateRequiredText(
      input.relationship,
      "relationship",
    );

    if ("guardianId" in input) {
      const existing = await guardians.get(tenantId, input.guardianId);
      if (!existing) {
        throw new DomainError("not_found", "Guardian not found");
      }
      links.push({
        guardianId: existing.id,
        fullName: guardianFullName(existing),
        relationship,
        isPaymentResponsible: input.isPaymentResponsible,
      });
      continue;
    }

    const draft = input.guardian;
    const key = documentKey(draft.document);
    if (newKeys.has(key)) {
      throw new DomainError(
        "invalid_argument",
        "Two new guardians share the same document",
      );
    }
    newKeys.add(key);

    const clash = await guardians.findByDocumentKey(tenantId, key);
    if (clash) {
      throw new DomainError(
        "failed_precondition",
        "A guardian with that document already exists",
        {guardianId: clash.id},
      );
    }

    const guardian: Guardian = {
      id: guardians.newId(),
      tenantId,
      firstNames: validateRequiredText(draft.firstNames, "guardian.firstNames"),
      lastNames: validateRequiredText(draft.lastNames, "guardian.lastNames"),
      document: draft.document,
      documentKey: key,
      phone: validateRequiredText(draft.phone, "guardian.phone"),
      email: draft.email ?? null,
      preferredContact: draft.preferredContact,
      createdAt: now,
      updatedAt: now,
    };
    created.push(guardian);
    links.push({
      guardianId: guardian.id,
      fullName: guardianFullName(guardian),
      relationship,
      isPaymentResponsible: input.isPaymentResponsible,
    });
  }

  validateGuardianLinks(links);
  return {links, created};
}
