import {Timestamp, type DocumentData} from "firebase-admin/firestore";
import type {DocumentType, PlayerDocument} from "../../domain/document.js";

// The id and the tenant come from the path, so they are not stored.
export function toDocumentDoc(document: PlayerDocument): DocumentData {
  return {
    playerId: document.playerId,
    type: document.type,
    status: document.status,
    ...(document.supersededBy !== undefined && {
      supersededBy: document.supersededBy,
    }),
    ...(document.file !== undefined && {file: document.file}),
    ...(document.policy !== undefined && {policy: document.policy}),
    createdAt: Timestamp.fromDate(document.createdAt),
    createdBy: document.createdBy,
  };
}

export function fromDocumentDoc(
  id: string,
  tenantId: string,
  data: DocumentData,
): PlayerDocument {
  return {
    id,
    tenantId,
    playerId: data.playerId,
    type: data.type as DocumentType,
    status: data.status,
    ...(data.supersededBy !== undefined && {supersededBy: data.supersededBy}),
    ...(data.file !== undefined && {file: data.file}),
    ...(data.policy !== undefined && {policy: data.policy}),
    createdAt: (data.createdAt as Timestamp).toDate(),
    createdBy: data.createdBy,
  };
}
