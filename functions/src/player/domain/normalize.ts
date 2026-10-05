import {DomainError} from "../../shared/domain/errors.js";

// Lowercase, no accents (ñ folds to n), single spaces, trimmed.
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Last names first, so sorting by this key sorts by last name.
export function nameKey(firstNames: string, lastNames: string): string {
  return `${normalizeText(lastNames)} ${normalizeText(firstNames)}`.trim();
}

// Drops dots, spaces, hyphens and leading zeros; letters are uppercased.
export function normalizeDocumentNumber(value: string): string {
  const compact = value.replace(/[.\s-]/g, "").toUpperCase();
  if (compact === "") {
    throw new DomainError(
      "invalid_argument",
      "document number must not be blank",
    );
  }
  return compact.replace(/^0+(?=.)/, "");
}

export function documentKey(document: {type: string; number: string}): string {
  return `${document.type}:${normalizeDocumentNumber(document.number)}`;
}
