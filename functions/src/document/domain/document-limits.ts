import {DomainError} from "../../shared/domain/errors.js";
import {DOCUMENT_TYPES} from "./document.js";
import type {DocumentType} from "./document.js";

export {DOCUMENT_TYPES};

const MB = 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ANY_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

type Limits = {contentTypes: readonly string[]; maxSize: number};

function limitsFor(type: DocumentType): Limits {
  if (type === "photo") {
    return {contentTypes: IMAGE_TYPES, maxSize: 2 * MB};
  }
  return {contentTypes: ANY_TYPES, maxSize: 10 * MB};
}

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" &&
    (DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

// Checked when the upload URL is requested and again on confirm, with the
// type and size read from the stored object.
export function assertUploadAllowed(input: {
  type: DocumentType;
  contentType: string;
  size: number;
}): void {
  const {type, contentType, size} = input;
  const limits = limitsFor(type);
  if (!limits.contentTypes.includes(contentType)) {
    throw new DomainError(
      "invalid_argument",
      `A ${type} document cannot be ${contentType}`,
    );
  }
  if (!Number.isInteger(size) || size <= 0) {
    throw new DomainError("invalid_argument", "The file size is not valid");
  }
  if (size > limits.maxSize) {
    throw new DomainError(
      "invalid_argument",
      `A ${type} document can be at most ${limits.maxSize / MB} MB`,
    );
  }
}
