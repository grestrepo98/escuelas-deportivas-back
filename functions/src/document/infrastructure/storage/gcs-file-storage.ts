import {randomUUID} from "node:crypto";
import type {getStorage} from "firebase-admin/storage";
import {uploadPath} from "../../domain/document-paths.js";
import type {
  DownloadLink,
  FileStorage,
  StoredFile,
  UploadTicket,
} from "../../application/file-storage.js";

export type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

// Cloud Storage through the Admin SDK. Uploads and downloads use v4 signed
// URLs, so the file never passes through the function (D-08). Signing needs
// the service account to be allowed to sign (see the deployment guide).
export class GcsFileStorage implements FileStorage {
  constructor(
    protected readonly bucket: Bucket,
    protected readonly newId: () => string = randomUUID,
  ) {}

  async createUpload(input: {
    tenantId: string;
    contentType: string;
    size: number;
    expiresAt: Date;
  }): Promise<UploadTicket> {
    const uploadId = this.newId();
    // The signature fixes the content type and the exact size.
    const lengthRange = `${input.size},${input.size}`;
    const [uploadUrl] = await this.bucket
      .file(uploadPath(input.tenantId, uploadId))
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: input.expiresAt,
        contentType: input.contentType,
        extensionHeaders: {"x-goog-content-length-range": lengthRange},
      });
    return {
      uploadId,
      uploadUrl,
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": input.contentType,
        "x-goog-content-length-range": lengthRange,
      },
      expiresAt: input.expiresAt,
    };
  }

  async stat(path: string): Promise<StoredFile | null> {
    try {
      const [metadata] = await this.bucket.file(path).getMetadata();
      return {
        contentType: String(metadata.contentType ?? ""),
        size: Number(metadata.size),
        createdAt: new Date(String(metadata.timeCreated)),
      };
    } catch (error) {
      if ((error as {code?: number}).code === 404) return null;
      throw error;
    }
  }

  async move(from: string, to: string): Promise<void> {
    await this.bucket.file(from).move(to);
  }

  async createDownloadUrl(input: {
    path: string;
    expiresAt: Date;
  }): Promise<DownloadLink> {
    const [url] = await this.bucket.file(input.path).getSignedUrl({
      version: "v4",
      action: "read",
      expires: input.expiresAt,
    });
    return {url, expiresAt: input.expiresAt};
  }
}
