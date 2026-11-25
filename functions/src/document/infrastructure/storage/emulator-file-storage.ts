import {randomUUID} from "node:crypto";
import {uploadPath} from "../../domain/document-paths.js";
import type {
  DownloadLink,
  UploadTicket,
} from "../../application/file-storage.js";
import {GcsFileStorage, type Bucket} from "./gcs-file-storage.js";

// The Storage emulator cannot sign URLs (D-13), so this adapter points the
// client straight at the emulator REST API. It covers the logic of the flow
// only: real signing is proven in `dev` by `smoke:dev`. The emulator skips the
// deny-all rules for requests that carry an owner token.
export class EmulatorFileStorage extends GcsFileStorage {
  constructor(
    bucket: Bucket,
    private readonly host: string,
    newId: () => string = randomUUID,
  ) {
    super(bucket, newId);
  }

  async createUpload(input: {
    tenantId: string;
    contentType: string;
    size: number;
    expiresAt: Date;
  }): Promise<UploadTicket> {
    const uploadId = this.newId();
    const path = uploadPath(input.tenantId, uploadId);
    return {
      uploadId,
      uploadUrl: `http://${this.host}/v0/b/${this.bucket.name}/o?name=${encodeURIComponent(path)}`,
      uploadMethod: "POST",
      uploadHeaders: {
        "Content-Type": input.contentType,
        Authorization: "Bearer owner",
      },
      expiresAt: input.expiresAt,
    };
  }

  // The emulator serves any object that carries a download token.
  async createDownloadUrl(input: {
    path: string;
    expiresAt: Date;
  }): Promise<DownloadLink> {
    const token = randomUUID();
    await this.bucket
      .file(input.path)
      .setMetadata({metadata: {firebaseStorageDownloadTokens: token}});
    return {
      url:
        `http://${this.host}/v0/b/${this.bucket.name}/o/` +
        `${encodeURIComponent(input.path)}?alt=media&token=${token}`,
      expiresAt: input.expiresAt,
    };
  }
}
