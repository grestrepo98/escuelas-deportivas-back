import {Timestamp, type DocumentData} from "firebase-admin/firestore";
import {
  PLAYER_STATUSES,
  type DataConsent,
  type Player,
  type PlayerHistoryEntry,
  type PlayerStatus,
} from "../../domain/player.js";

const toDate = (value: unknown): Date => (value as Timestamp).toDate();

// Firestore rejects `undefined`, so optional fields are dropped, not stored.
export function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function status(data: DocumentData): PlayerStatus {
  if (!PLAYER_STATUSES.includes(data.status)) {
    throw new Error(`Corrupt player: unknown status "${data.status}"`);
  }
  return data.status;
}

function consentFromDoc(data: DocumentData | null | undefined) {
  if (!data) return null;
  const consent: DataConsent = {
    guardianId: data.guardianId,
    recordedBy: data.recordedBy,
    at: toDate(data.at),
  };
  return consent;
}

export function fromHistoryDoc(
  id: string,
  data: DocumentData,
): PlayerHistoryEntry {
  if (data.type !== "placement" && data.type !== "status") {
    throw new Error(`Corrupt history entry: unknown type "${data.type}"`);
  }
  return {
    id,
    type: data.type,
    before: {...data.before},
    after: {...data.after},
    reason: data.reason ?? null,
    actorUid: data.actorUid,
    at: toDate(data.at),
  };
}

// The id and the tenantId live in the document path, so they are not stored.
export function toPlayerDoc(player: Player): DocumentData {
  return {
    firstNames: player.firstNames,
    lastNames: player.lastNames,
    nameKey: player.nameKey,
    document: player.document,
    documentKey: player.documentKey,
    birthDate: player.birthDate,
    groupId: player.groupId,
    venueId: player.venueId,
    categoryId: player.categoryId,
    status: player.status,
    statusReason: player.statusReason,
    joinedAt: Timestamp.fromDate(player.joinedAt),
    emergencyContact: player.emergencyContact,
    medical: withoutUndefined(player.medical),
    guardians: player.guardians,
    guardianIds: player.guardianIds,
    dataConsent: player.dataConsent && {
      guardianId: player.dataConsent.guardianId,
      recordedBy: player.dataConsent.recordedBy,
      at: Timestamp.fromDate(player.dataConsent.at),
    },
    createdAt: Timestamp.fromDate(player.createdAt),
    updatedAt: Timestamp.fromDate(player.updatedAt),
  };
}

export function fromPlayerDoc(
  id: string,
  tenantId: string,
  data: DocumentData,
): Player {
  return {
    id,
    tenantId,
    firstNames: data.firstNames,
    lastNames: data.lastNames,
    nameKey: data.nameKey,
    document: data.document
      ? {type: data.document.type, number: data.document.number}
      : null,
    documentKey: data.documentKey ?? null,
    birthDate: data.birthDate,
    groupId: data.groupId,
    venueId: data.venueId,
    categoryId: data.categoryId,
    status: status(data),
    statusReason: data.statusReason ?? null,
    joinedAt: toDate(data.joinedAt),
    emergencyContact: {
      name: data.emergencyContact.name,
      phone: data.emergencyContact.phone,
      relationship: data.emergencyContact.relationship,
    },
    medical: {...data.medical},
    // Firestore returns map keys sorted; rebuild each link in a fixed order.
    guardians: (data.guardians ?? []).map(
      (link: Player["guardians"][number]) => ({
        guardianId: link.guardianId,
        fullName: link.fullName,
        relationship: link.relationship,
        isPaymentResponsible: link.isPaymentResponsible,
      }),
    ),
    guardianIds: data.guardianIds ?? [],
    dataConsent: consentFromDoc(data.dataConsent),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}
