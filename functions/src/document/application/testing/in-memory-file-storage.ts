import {uploadPath} from "../../domain/document-paths.js";
import type {
  DownloadLink,
  FileStorage,
  StoredFile,
  UploadTicket,
} from "../file-storage.js";

export class InMemoryFileStorage implements FileStorage {
  private files = new Map<string, StoredFile>();
  private sequence = 0;

  async createUpload(input: {
    tenantId: string;
    contentType: string;
    size: number;
    expiresAt: Date;
  }): Promise<UploadTicket> {
    this.sequence += 1;
    const uploadId = `upload-${this.sequence}`;
    return {
      uploadId,
      uploadUrl: `memory://${uploadPath(input.tenantId, uploadId)}`,
      uploadMethod: "PUT",
      uploadHeaders: {"Content-Type": input.contentType},
      expiresAt: input.expiresAt,
    };
  }

  async stat(path: string): Promise<StoredFile | null> {
    const found = this.files.get(path);
    return found ? structuredClone(found) : null;
  }

  async move(from: string, to: string): Promise<void> {
    const found = this.files.get(from);
    if (!found) throw new Error(`No file at ${from}`);
    this.files.set(to, found);
    this.files.delete(from);
  }

  async createDownloadUrl(input: {
    path: string;
    expiresAt: Date;
  }): Promise<DownloadLink> {
    if (!this.files.has(input.path)) {
      throw new Error(`No file at ${input.path}`);
    }
    return {url: `memory://${input.path}`, expiresAt: input.expiresAt};
  }

  // Test helper: what a client does after receiving an upload URL.
  put(path: string, file: StoredFile): void {
    this.files.set(path, structuredClone(file));
  }
}
