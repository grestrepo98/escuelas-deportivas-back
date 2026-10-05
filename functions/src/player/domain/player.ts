export const PLAYER_STATUSES = [
  "preinscrito",
  "activo",
  "pausado",
  "retirado",
] as const;

export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const DOCUMENT_TYPES = ["RC", "TI", "CC", "CE", "PA", "PPT"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type PersonDocument = {
  type: DocumentType;
  number: string;
};

export type GuardianLink = {
  guardianId: string;
  fullName: string; // copy for the light index; updated when the guardian is
  relationship: string; // "madre", "padre", "abuela", ...
  isPaymentResponsible: boolean;
};

export type DataConsent = {
  guardianId: string;
  recordedBy: string; // uid of the staff member
  at: Date; // UTC
};

export type Player = {
  id: string;
  tenantId: string;
  firstNames: string;
  lastNames: string;
  nameKey: string; // normalized last names + first names
  document: PersonDocument | null;
  documentKey: string | null; // `${type}:${normalized number}`
  birthDate: string; // "YYYY-MM-DD"
  groupId: string;
  venueId: string; // copied from the group
  categoryId: string; // copied from the group
  status: PlayerStatus;
  statusReason: string | null;
  joinedAt: Date; // UTC
  emergencyContact: {name: string; phone: string; relationship: string};
  medical: {
    bloodType?: string;
    allergies?: string;
    conditions?: string;
    medications?: string;
    notes?: string;
  };
  guardians: GuardianLink[];
  guardianIds: string[]; // for array-contains
  dataConsent: DataConsent | null;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};

export type PlayerPlacementState = {
  groupId?: string;
  venueId?: string;
  categoryId?: string;
  status?: PlayerStatus;
};

export type PlayerHistoryEntry = {
  id: string;
  type: "placement" | "status";
  before: PlayerPlacementState;
  after: PlayerPlacementState;
  reason: string | null;
  actorUid: string;
  at: Date; // UTC
};
