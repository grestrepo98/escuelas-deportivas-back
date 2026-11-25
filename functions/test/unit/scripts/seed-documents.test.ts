import {describe, expect, it} from "vitest";
import {
  buildSeedDocuments,
  seedFileBytes,
} from "../../../src/scripts/seed-documents.js";
import {policyStatus} from "../../../src/document/domain/policy-status.js";
import {SEED_PLAYERS} from "../../../src/scripts/seed-lib.js";
import {assertUploadAllowed} from "../../../src/document/domain/document-limits.js";
import {validatePolicyData} from "../../../src/document/domain/policy-validation.js";

const NOW = new Date("2026-10-08T17:00:00Z");
const docs = buildSeedDocuments(NOW, "owner-uid");

describe("buildSeedDocuments", () => {
  it("uses fixed ids and belongs to seeded players of tenant-a", () => {
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    for (const doc of docs) {
      expect(doc.id.startsWith("seed-doc-")).toBe(true);
      expect(doc.tenantId).toBe("tenant-a");
      expect(SEED_PLAYERS.some((p) => p.id === doc.playerId)).toBe(true);
    }
  });

  it("leaves the policy of the seeded players in every status", () => {
    const current = docs.filter(
      (d) => d.type === "policy" && d.status === "current",
    );
    const statuses = SEED_PLAYERS.map((player) => {
      const policy = current.find((d) => d.playerId === player.id)?.policy;
      return policyStatus(policy, NOW, 30);
    });
    expect(new Set(statuses)).toEqual(
      new Set(["valid", "expiring", "expired", "missing"]),
    );
  });

  it("keeps the policy states stable whatever day the seed runs", () => {
    const later = buildSeedDocuments(new Date("2027-03-01T12:00:00Z"), "o");
    const policies = (list: typeof docs) =>
      list
        .filter((d) => d.type === "policy" && d.status === "current")
        .map((d) =>
          policyStatus(d.policy, new Date("2027-03-01T12:00:00Z"), 30),
        );
    expect(policies(later).sort()).toEqual(
      docs
        .filter((d) => d.type === "policy" && d.status === "current")
        .map((d) => policyStatus(d.policy, NOW, 30))
        .sort(),
    );
  });

  it("includes a superseded version that points to its replacement", () => {
    const old = docs.find((d) => d.status === "superseded")!;
    expect(old.supersededBy).toBeDefined();
    const replacement = docs.find((d) => d.id === old.supersededBy)!;
    expect(replacement).toMatchObject({
      playerId: old.playerId,
      type: old.type,
      status: "current",
    });
  });

  it("has one current document per player and type", () => {
    const keys = docs
      .filter((d) => d.status === "current")
      .map((d) => `${d.playerId}/${d.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mixes policies with and without a file, all valid", () => {
    const policies = docs.filter((d) => d.type === "policy");
    expect(policies.some((d) => d.file === undefined)).toBe(true);
    expect(policies.some((d) => d.file !== undefined)).toBe(true);
    for (const doc of policies) {
      expect(() => validatePolicyData(doc.policy!)).not.toThrow();
    }
    for (const doc of docs.filter((d) => d.type !== "policy")) {
      expect(doc.file).toBeDefined();
    }
  });

  it("describes files that match the limits and the stored bytes", () => {
    for (const doc of docs.filter((d) => d.file)) {
      const bytes = seedFileBytes(doc.file!.contentType);
      expect(doc.file!.size).toBe(bytes.length);
      expect(() =>
        assertUploadAllowed({
          type: doc.type,
          contentType: doc.file!.contentType,
          size: doc.file!.size,
        }),
      ).not.toThrow();
      expect(doc.file!.path).toBe(
        `tenants/tenant-a/players/${doc.playerId}/documents/${doc.id}`,
      );
    }
  });
});
