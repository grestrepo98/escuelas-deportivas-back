import {describe, expect, it} from "vitest";
import {
  DOCUMENT_TYPES,
  assertUploadAllowed,
  isDocumentType,
} from "../../../../src/document/domain/document-limits.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

const MB = 1024 * 1024;

function invalid(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("invalid_argument");
    return;
  }
  throw new Error("expected DomainError invalid_argument");
}

describe("isDocumentType", () => {
  it("accepts the five catalog types and nothing else", () => {
    expect([...DOCUMENT_TYPES].sort()).toEqual([
      "dataAuthorization",
      "identity",
      "medicalCertificate",
      "photo",
      "policy",
    ]);
    expect(isDocumentType("policy")).toBe(true);
    expect(isDocumentType("invoice")).toBe(false);
    expect(isDocumentType(undefined)).toBe(false);
  });
});

describe("assertUploadAllowed", () => {
  it("accepts a 10 MB PDF policy", () => {
    expect(() =>
      assertUploadAllowed({
        type: "policy",
        contentType: "application/pdf",
        size: 10 * MB,
      }),
    ).not.toThrow();
  });

  it("rejects an 11 MB PDF policy", () => {
    invalid(() =>
      assertUploadAllowed({
        type: "policy",
        contentType: "application/pdf",
        size: 11 * MB,
      }),
    );
  });

  it("accepts a 2 MB photo and rejects a 3 MB photo", () => {
    expect(() =>
      assertUploadAllowed({
        type: "photo",
        contentType: "image/jpeg",
        size: 2 * MB,
      }),
    ).not.toThrow();
    invalid(() =>
      assertUploadAllowed({
        type: "photo",
        contentType: "image/jpeg",
        size: 3 * MB,
      }),
    );
  });

  it("rejects a PDF photo", () => {
    invalid(() =>
      assertUploadAllowed({
        type: "photo",
        contentType: "application/pdf",
        size: 1 * MB,
      }),
    );
  });

  it.each(["image/jpeg", "image/png", "image/webp", "application/pdf"])(
    "accepts %s for identity",
    (contentType) => {
      expect(() =>
        assertUploadAllowed({type: "identity", contentType, size: 1000}),
      ).not.toThrow();
    },
  );

  it("rejects other content types", () => {
    invalid(() =>
      assertUploadAllowed({
        type: "identity",
        contentType: "image/gif",
        size: 1000,
      }),
    );
  });

  it("rejects an empty or non-integer size", () => {
    for (const size of [0, -1, 1.5, Number.NaN]) {
      invalid(() =>
        assertUploadAllowed({
          type: "identity",
          contentType: "image/png",
          size,
        }),
      );
    }
  });
});
