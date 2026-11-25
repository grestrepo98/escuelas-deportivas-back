export type StoredFile = {
  contentType: string;
  size: number; // bytes, as stored, never as declared by the client
  createdAt: Date;
};

export type UploadTicket = {
  uploadId: string;
  uploadUrl: string;
  // A signed write URL takes PUT; the Storage emulator takes POST.
  uploadMethod: "PUT" | "POST";
  // Headers the client must send with the upload: the signature covers the
  // content type and the exact size.
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
};

export type DownloadLink = {url: string; expiresAt: Date};

// Files never pass through the functions (D-08): clients upload and download
// with short-lived signed URLs.
export interface FileStorage {
  // A URL to upload one object to `uploads/{t}/{uploadId}`, signed for
  // that exact content type and size until `expiresAt`.
  createUpload(input: {
    tenantId: string;
    contentType: string;
    size: number;
    expiresAt: Date;
  }): Promise<UploadTicket>;
  stat(path: string): Promise<StoredFile | null>;
  move(from: string, to: string): Promise<void>;
  createDownloadUrl(input: {
    path: string;
    expiresAt: Date;
  }): Promise<DownloadLink>;
}
