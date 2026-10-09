import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

// The emulator does not enforce composite indexes, so this test is what keeps
// the document queries and `firestore.indexes.json` from drifting apart.
const file = resolve(__dirname, "../../../../../../firestore.indexes.json");

type IndexDefinition = {
  collectionGroup: string;
  queryScope: string;
  fields: {fieldPath: string; order: string}[];
};

const indexes: IndexDefinition[] = JSON.parse(
  readFileSync(file, "utf8"),
).indexes;

const documentIndexes = indexes.filter(
  (index) => index.collectionGroup === "documents",
);
const signature = (index: IndexDefinition) =>
  index.fields.map((field) => `${field.fieldPath}:${field.order}`).join(",");

describe("firestore.indexes.json — documents", () => {
  // listByPlayer: playerId == [and status ==], newest first.
  it.each([
    "playerId:ASCENDING,status:ASCENDING,createdAt:DESCENDING",
    "playerId:ASCENDING,createdAt:DESCENDING",
  ])("has the documents index (%s)", (expected) => {
    expect(documentIndexes.map(signature)).toContain(expected);
  });

  it("declares each documents index once, with collection scope", () => {
    const signatures = documentIndexes.map(signature);
    expect(new Set(signatures).size).toBe(signatures.length);
    for (const index of documentIndexes) {
      expect(index.queryScope).toBe("COLLECTION");
    }
  });
});
