import {beforeEach, describe, expect, it, vi} from "vitest";
import {
  GcsFileStorage,
  type Bucket,
} from "../../../../../src/document/infrastructure/storage/gcs-file-storage.js";

const expiresAt = new Date("2026-10-08T12:15:00Z");

type FakeFile = {
  getSignedUrl: ReturnType<typeof vi.fn>;
  getMetadata: ReturnType<typeof vi.fn>;
  move: ReturnType<typeof vi.fn>;
};

let files: Map<string, FakeFile>;
let storage: GcsFileStorage;

function fileFor(path: string): FakeFile {
  let file = files.get(path);
  if (!file) {
    file = {
      getSignedUrl: vi.fn(async () => [`https://signed.example/${path}`]),
      getMetadata: vi.fn(async () => [
        {
          contentType: "application/pdf",
          size: "2048",
          timeCreated: "2026-10-08T12:00:00.000Z",
        },
      ]),
      move: vi.fn(async () => [{}]),
    };
    files.set(path, file);
  }
  return file;
}

beforeEach(() => {
  files = new Map();
  const bucket = {name: "bucket-x", file: (path: string) => fileFor(path)};
  storage = new GcsFileStorage(bucket as unknown as Bucket, () => "up-123");
});

describe("GcsFileStorage.createUpload", () => {
  it("signs a v4 write URL for the exact content type and size", async () => {
    const ticket = await storage.createUpload({
      tenantId: "t1",
      contentType: "application/pdf",
      size: 2048,
      expiresAt,
    });
    expect(ticket).toEqual({
      uploadId: "up-123",
      uploadUrl: "https://signed.example/uploads/t1/up-123",
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": "application/pdf",
        "x-goog-content-length-range": "2048,2048",
      },
      expiresAt,
    });
    expect(fileFor("uploads/t1/up-123").getSignedUrl).toHaveBeenCalledWith({
      version: "v4",
      action: "write",
      expires: expiresAt,
      contentType: "application/pdf",
      extensionHeaders: {"x-goog-content-length-range": "2048,2048"},
    });
  });
});

describe("GcsFileStorage.createDownloadUrl", () => {
  it("signs a v4 read URL until the expiry", async () => {
    const link = await storage.createDownloadUrl({path: "a/b", expiresAt});
    expect(link).toEqual({url: "https://signed.example/a/b", expiresAt});
    expect(fileFor("a/b").getSignedUrl).toHaveBeenCalledWith({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });
  });
});

describe("GcsFileStorage.stat", () => {
  it("reads type, size and creation time from the stored object", async () => {
    expect(await storage.stat("a/b")).toEqual({
      contentType: "application/pdf",
      size: 2048,
      createdAt: new Date("2026-10-08T12:00:00.000Z"),
    });
  });

  it("returns null when the object does not exist", async () => {
    fileFor("missing").getMetadata.mockRejectedValue({code: 404});
    expect(await storage.stat("missing")).toBeNull();
  });

  it("rethrows other errors", async () => {
    fileFor("broken").getMetadata.mockRejectedValue(new Error("network"));
    await expect(storage.stat("broken")).rejects.toThrow("network");
  });
});

describe("GcsFileStorage.move", () => {
  it("moves the object to the destination path", async () => {
    await storage.move("from", "to");
    expect(fileFor("from").move).toHaveBeenCalledWith("to");
  });
});
