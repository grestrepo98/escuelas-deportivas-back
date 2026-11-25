import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";
import {
  documentPath,
  uploadPath,
} from "../../../../../src/document/domain/document-paths.js";

// The bucket lifecycle rule is applied by hand with gcloud (it does not ship
// with `firebase deploy`), so this test keeps the versioned file in line with
// the paths the code uses.
const file = resolve(__dirname, "../../../../../../storage.lifecycle.json");

type Rule = {
  action: {type: string};
  condition: {age?: number; matchesPrefix?: string[]};
};
const rules: Rule[] = JSON.parse(readFileSync(file, "utf8")).rule;

// matchesPrefix is a literal prefix of the object name, with no wildcards.
const matches = (rule: Rule, objectName: string): boolean =>
  (rule.condition.matchesPrefix ?? []).some((prefix) =>
    objectName.startsWith(prefix),
  );

describe("storage.lifecycle.json", () => {
  it("deletes pending uploads of every tenant after one day", () => {
    const pending = rules.filter((rule) =>
      matches(rule, uploadPath("any-tenant", "any-upload")),
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].action.type).toBe("Delete");
    expect(pending[0].condition.age).toBe(1);
    expect(matches(pending[0], uploadPath("another-tenant", "x"))).toBe(true);
  });

  it("never touches confirmed documents", () => {
    for (const rule of rules) {
      expect(matches(rule, documentPath("t1", "p1", "d1"))).toBe(false);
    }
  });

  it("only has rules scoped by a prefix", () => {
    for (const rule of rules) {
      expect(rule.condition.matchesPrefix?.length).toBeGreaterThan(0);
    }
  });
});
