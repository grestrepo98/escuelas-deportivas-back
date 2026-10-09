export const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

// A pending upload older than this cannot be confirmed (the bucket lifecycle
// rule deletes it a day after creation).
export const UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// The upload id becomes part of a storage path and a document id.
export function isValidUploadId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

// Pending uploads are deleted by the bucket lifecycle rule if never confirmed.
export function uploadPath(tenantId: string, uploadId: string): string {
  return `uploads/${tenantId}/${uploadId}`;
}

export function documentPath(
  tenantId: string,
  playerId: string,
  documentId: string,
): string {
  return `tenants/${tenantId}/players/${playerId}/documents/${documentId}`;
}
