import {describe, expect, it} from "vitest";
import {
  assertCanAccessPlayerDocuments,
  canAccessPlayerDocuments,
  assertCanReadDocument,
  assertCanWriteDocument,
  visibleTypesFor,
} from "../../../../src/document/domain/document-visibility.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

function denied(fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("permission_denied");
    return;
  }
  throw new Error("expected permission_denied");
}

function member(
  role: Role,
  scope: Partial<Membership["scope"]> = {},
): Membership {
  return {
    uid: "u1",
    tenantId: "t1",
    role,
    status: "active",
    scope: {venueIds: [], groupIds: [], playerIds: [], ...scope},
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const where = {venueId: "v1", groupId: "g1"};

describe("assertCanReadDocument", () => {
  it("lets owner and accountant read every type", () => {
    for (const role of ["owner", "accountant"] as const) {
      for (const type of [
        "identity",
        "policy",
        "dataAuthorization",
        "medicalCertificate",
        "photo",
      ] as const) {
        expect(() =>
          assertCanReadDocument(member(role), {...where, type}),
        ).not.toThrow();
      }
    }
  });

  it("limits the coordinator to their venues", () => {
    const coordinator = member("coordinator", {venueIds: ["v1"]});
    expect(() =>
      assertCanReadDocument(coordinator, {...where, type: "identity"}),
    ).not.toThrow();
    denied(() =>
      assertCanReadDocument(coordinator, {
        venueId: "v2",
        groupId: "g1",
        type: "identity",
      }),
    );
  });

  it("lets a teacher read photo and policy of their groups only", () => {
    const teacher = member("teacher", {groupIds: ["g1"]});
    expect(() =>
      assertCanReadDocument(teacher, {...where, type: "photo"}),
    ).not.toThrow();
    expect(() =>
      assertCanReadDocument(teacher, {...where, type: "policy"}),
    ).not.toThrow();
    for (const type of [
      "identity",
      "medicalCertificate",
      "dataAuthorization",
    ] as const) {
      denied(() => assertCanReadDocument(teacher, {...where, type}));
    }
    denied(() =>
      assertCanReadDocument(teacher, {
        venueId: "v1",
        groupId: "g2",
        type: "photo",
      }),
    );
  });
});

describe("visibleTypesFor", () => {
  it("gives staff every type and a teacher photo and policy", () => {
    expect(visibleTypesFor(member("owner"))).toHaveLength(5);
    expect(visibleTypesFor(member("coordinator"))).toHaveLength(5);
    expect([...visibleTypesFor(member("teacher"))].sort()).toEqual([
      "photo",
      "policy",
    ]);
  });
});

describe("assertCanWriteDocument", () => {
  it("lets owner, accountant and coordinator (in venue) write", () => {
    expect(() => assertCanWriteDocument(member("owner"), "v1")).not.toThrow();
    expect(() =>
      assertCanWriteDocument(member("accountant"), "v1"),
    ).not.toThrow();
    expect(() =>
      assertCanWriteDocument(member("coordinator", {venueIds: ["v1"]}), "v1"),
    ).not.toThrow();
  });

  it("denies a coordinator outside their venues and any teacher", () => {
    denied(() =>
      assertCanWriteDocument(member("coordinator", {venueIds: ["v2"]}), "v1"),
    );
    denied(() =>
      assertCanWriteDocument(member("teacher", {groupIds: ["g1"]}), "v1"),
    );
  });
});

describe("assertCanAccessPlayerDocuments", () => {
  it("applies only the scope, whatever the document type", () => {
    const teacher = member("teacher", {groupIds: ["g1"]});
    expect(() => assertCanAccessPlayerDocuments(teacher, where)).not.toThrow();
    denied(() =>
      assertCanAccessPlayerDocuments(teacher, {venueId: "v1", groupId: "g2"}),
    );
    denied(() =>
      assertCanAccessPlayerDocuments(
        member("coordinator", {venueIds: ["v2"]}),
        where,
      ),
    );
  });

  it("canAccessPlayerDocuments is the boolean form", () => {
    expect(canAccessPlayerDocuments(member("owner"), where)).toBe(true);
    expect(
      canAccessPlayerDocuments(
        member("coordinator", {venueIds: ["v2"]}),
        where,
      ),
    ).toBe(false);
  });
});
