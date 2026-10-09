export const DOCUMENT_TYPES = [
  "identity",
  "policy",
  "dataAuthorization",
  "medicalCertificate",
  "photo",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type PolicyData = {
  number: string;
  insurer: string;
  validFrom: string; // YYYY-MM-DD, calendar day in Bogota
  validUntil: string; // YYYY-MM-DD, inclusive
};

export type DocumentFile = {
  path: string; // tenants/{t}/players/{p}/documents/{docId}
  contentType: string;
  size: number; // bytes
};

export type PlayerDocument = {
  id: string;
  tenantId: string;
  // The venue and group are not copied here: the caller's scope is checked
  // against the player, read on each request (ADR 0013).
  playerId: string;
  type: DocumentType;
  status: "current" | "superseded";
  supersededBy?: string;
  file?: DocumentFile;
  policy?: PolicyData; // only when type === "policy"
  createdAt: Date; // UTC
  createdBy: string; // uid
};

// Computed on read, never stored.
export type PolicyStatus = "valid" | "expiring" | "expired" | "missing";
