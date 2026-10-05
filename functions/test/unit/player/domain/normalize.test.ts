import {describe, expect, it} from "vitest";
import {
  documentKey,
  nameKey,
  normalizeDocumentNumber,
  normalizeText,
} from "../../../../src/player/domain/normalize.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

describe("normalizeText", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeText("JOSÉ ÁNGEL")).toBe("jose angel");
  });

  it("collapses inner spaces and trims the ends", () => {
    expect(normalizeText("  María   del  Mar ")).toBe("maria del mar");
  });

  it("folds the letter ñ to n", () => {
    expect(normalizeText("Muñoz")).toBe("munoz");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeText("   ")).toBe("");
  });
});

describe("nameKey", () => {
  it("puts last names first, normalized", () => {
    expect(nameKey("Juan Camilo", "Pérez  Gómez")).toBe(
      "perez gomez juan camilo",
    );
  });

  it("is equal for spellings that differ only in case, accents or spaces", () => {
    expect(nameKey("ANDRÉS", " lópez ")).toBe(nameKey("Andres", "Lopez"));
  });

  it("differs when the names differ", () => {
    expect(nameKey("Ana", "Ruiz")).not.toBe(nameKey("Ana", "Ruiza"));
  });
});

describe("normalizeDocumentNumber", () => {
  it("removes dots, spaces and hyphens", () => {
    expect(normalizeDocumentNumber("1.234.567-8")).toBe("12345678");
    expect(normalizeDocumentNumber(" 1 234 567 ")).toBe("1234567");
  });

  it("removes leading zeros", () => {
    expect(normalizeDocumentNumber("0001234")).toBe("1234");
  });

  it("keeps a single zero when the number is only zeros", () => {
    expect(normalizeDocumentNumber("000")).toBe("0");
  });

  it("uppercases alphanumeric numbers", () => {
    expect(normalizeDocumentNumber("ab123456")).toBe("AB123456");
  });

  it("rejects a blank number", () => {
    try {
      normalizeDocumentNumber(" . ");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("invalid_argument");
      return;
    }
    throw new Error("expected DomainError invalid_argument");
  });
});

describe("documentKey", () => {
  it("joins the type and the normalized number", () => {
    expect(documentKey({type: "CC", number: "1.020.304"})).toBe("CC:1020304");
  });

  it("does not match across document types", () => {
    expect(documentKey({type: "TI", number: "123"})).not.toBe(
      documentKey({type: "CC", number: "123"}),
    );
  });

  it("matches the same document written differently", () => {
    expect(documentKey({type: "TI", number: "0012.345"})).toBe(
      documentKey({type: "TI", number: "12345"}),
    );
  });
});
