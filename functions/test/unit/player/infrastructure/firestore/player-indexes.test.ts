import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

// The emulator does not enforce composite indexes, so this test is what keeps
// the list query and `firestore.indexes.json` from drifting apart.
const file = resolve(__dirname, "../../../../../../firestore.indexes.json");

type IndexDefinition = {
  collectionGroup: string;
  queryScope: string;
  fields: {fieldPath: string; order: string}[];
};

const indexes: IndexDefinition[] = JSON.parse(
  readFileSync(file, "utf8"),
).indexes;

const playerIndexes = indexes
  .filter((index) => index.collectionGroup === "players")
  .map((index) => index.fields.map((field) => field.fieldPath).join(","));

describe("firestore.indexes.json", () => {
  it.each([
    "venueId,nameKey",
    "categoryId,nameKey",
    "groupId,nameKey",
    "status,nameKey",
    "venueId,status,nameKey",
    "categoryId,status,nameKey",
    "groupId,status,nameKey",
  ])("has the players index (%s)", (fields) => {
    expect(playerIndexes).toContain(fields);
  });

  it("declares each players index once, ascending, with collection scope", () => {
    const players = indexes.filter((i) => i.collectionGroup === "players");
    expect(new Set(playerIndexes).size).toBe(playerIndexes.length);
    for (const index of players) {
      expect(index.queryScope).toBe("COLLECTION");
      for (const field of index.fields) {
        expect(field.order).toBe("ASCENDING");
      }
    }
  });
});
