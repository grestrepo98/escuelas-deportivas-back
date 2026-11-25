import {describe, expect, it} from "vitest";
import {
  DOWNLOAD_URL_TTL_MS,
  UPLOAD_URL_TTL_MS,
  documentPath,
  uploadPath,
} from "../../../../src/document/domain/document-paths.js";

describe("document paths", () => {
  it("builds the pending upload path", () => {
    expect(uploadPath("t1", "u9")).toBe("uploads/t1/u9");
  });

  it("builds the final document path", () => {
    expect(documentPath("t1", "p1", "d1")).toBe(
      "tenants/t1/players/p1/documents/d1",
    );
  });

  it("gives the upload url 15 minutes and the download url 5", () => {
    expect(UPLOAD_URL_TTL_MS).toBe(15 * 60 * 1000);
    expect(DOWNLOAD_URL_TTL_MS).toBe(5 * 60 * 1000);
  });
});
