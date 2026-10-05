import {Timestamp, type DocumentData} from "firebase-admin/firestore";
import {CONTACT_PREFERENCES, type Guardian} from "../../domain/guardian.js";

const toDate = (value: unknown): Date => (value as Timestamp).toDate();

// The id and the tenantId live in the document path, so they are not stored.
export function toGuardianDoc(guardian: Guardian): DocumentData {
  return {
    firstNames: guardian.firstNames,
    lastNames: guardian.lastNames,
    document: guardian.document,
    documentKey: guardian.documentKey,
    phone: guardian.phone,
    email: guardian.email,
    preferredContact: guardian.preferredContact,
    createdAt: Timestamp.fromDate(guardian.createdAt),
    updatedAt: Timestamp.fromDate(guardian.updatedAt),
  };
}

export function fromGuardianDoc(
  id: string,
  tenantId: string,
  data: DocumentData,
): Guardian {
  if (!CONTACT_PREFERENCES.includes(data.preferredContact)) {
    throw new Error(
      `Corrupt guardian: unknown contact "${data.preferredContact}"`,
    );
  }
  return {
    id,
    tenantId,
    firstNames: data.firstNames,
    lastNames: data.lastNames,
    document: {type: data.document.type, number: data.document.number},
    documentKey: data.documentKey,
    phone: data.phone,
    email: data.email ?? null,
    preferredContact: data.preferredContact,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}
