import {describe, expect, it} from "vitest";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import {resolveScopeForRole} from "../../../../src/membership/domain/scope.js";

const empty = {venueIds: [], groupIds: [], playerIds: []};

function invalid(fn: () => unknown): void {
  expect(fn).toThrow(DomainError);
  try {
    fn();
  } catch (error) {
    expect((error as DomainError).code).toBe("invalid_argument");
  }
}

describe("resolveScopeForRole", () => {
  describe.each(["owner", "accountant"] as const)("%s", (role) => {
    it("keeps an empty scope when none is given", () => {
      expect(resolveScopeForRole(role, undefined)).toEqual(empty);
      expect(resolveScopeForRole(role, {})).toEqual(empty);
      expect(resolveScopeForRole(role, {venueIds: [], groupIds: []})).toEqual(
        empty,
      );
    });

    it("rejects a scope with venues", () => {
      invalid(() => resolveScopeForRole(role, {venueIds: ["v1"]}));
    });

    it("rejects a scope with groups", () => {
      invalid(() => resolveScopeForRole(role, {groupIds: ["g1"]}));
    });
  });

  describe("coordinator", () => {
    it("requires at least one venue", () => {
      invalid(() => resolveScopeForRole("coordinator", undefined));
      invalid(() => resolveScopeForRole("coordinator", {}));
      invalid(() => resolveScopeForRole("coordinator", {venueIds: []}));
    });

    it("accepts one or more venues", () => {
      expect(
        resolveScopeForRole("coordinator", {venueIds: ["v1", "v2"]}),
      ).toEqual({venueIds: ["v1", "v2"], groupIds: [], playerIds: []});
    });

    it("rejects groups, even next to venues", () => {
      invalid(() =>
        resolveScopeForRole("coordinator", {
          venueIds: ["v1"],
          groupIds: ["g1"],
        }),
      );
      invalid(() => resolveScopeForRole("coordinator", {groupIds: ["g1"]}));
    });

    it("drops duplicated venues keeping the first occurrence", () => {
      expect(
        resolveScopeForRole("coordinator", {venueIds: ["v2", "v1", "v2"]}),
      ).toEqual({venueIds: ["v2", "v1"], groupIds: [], playerIds: []});
    });
  });

  describe("teacher", () => {
    it("requires at least one group", () => {
      invalid(() => resolveScopeForRole("teacher", undefined));
      invalid(() => resolveScopeForRole("teacher", {}));
      invalid(() => resolveScopeForRole("teacher", {groupIds: []}));
    });

    it("accepts one or more groups", () => {
      expect(resolveScopeForRole("teacher", {groupIds: ["g1", "g2"]})).toEqual({
        venueIds: [],
        groupIds: ["g1", "g2"],
        playerIds: [],
      });
    });

    it("rejects venues, even next to groups", () => {
      invalid(() =>
        resolveScopeForRole("teacher", {venueIds: ["v1"], groupIds: ["g1"]}),
      );
      invalid(() => resolveScopeForRole("teacher", {venueIds: ["v1"]}));
    });

    it("drops duplicated groups keeping the first occurrence", () => {
      expect(
        resolveScopeForRole("teacher", {groupIds: ["g1", "g1", "g2"]}),
      ).toEqual({venueIds: [], groupIds: ["g1", "g2"], playerIds: []});
    });
  });

  it("rejects blank identifiers", () => {
    invalid(() => resolveScopeForRole("coordinator", {venueIds: [""]}));
    invalid(() => resolveScopeForRole("teacher", {groupIds: ["g1", "  "]}));
  });

  it.each(["guardian", "adultPlayer"] as const)(
    "does not validate the scope of %s here",
    (role) => {
      expect(resolveScopeForRole(role, undefined)).toEqual(empty);
      expect(resolveScopeForRole(role, {venueIds: ["v1"]})).toEqual({
        venueIds: ["v1"],
        groupIds: [],
        playerIds: [],
      });
    },
  );
});
