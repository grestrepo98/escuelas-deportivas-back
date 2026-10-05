import {describe, expect, it} from "vitest";
import {visibleStructure} from "./visible-structure.js";
import {DomainError} from "../../shared/domain/errors.js";
import type {Membership, Scope} from "../../membership/domain/membership.js";
import type {Role} from "../../membership/domain/role.js";
import type {Category, Group, Venue} from "./structure.js";

const T0 = new Date("2026-10-01T00:00:00Z");

const venue = (id: string): Venue => ({
  id,
  tenantId: "tenant-a",
  name: id,
  address: "Calle 1",
  status: "active",
  createdAt: T0,
  updatedAt: T0,
});

const category = (id: string): Category => ({
  id,
  tenantId: "tenant-a",
  name: id,
  birthYears: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
});

const group = (id: string, venueId: string, categoryId: string): Group => ({
  id,
  tenantId: "tenant-a",
  venueId,
  categoryId,
  name: id,
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
});

const structure = {
  venues: [venue("v1"), venue("v2")],
  categories: [category("c1"), category("c2"), category("c3")],
  groups: [
    group("g1", "v1", "c1"),
    group("g2", "v1", "c2"),
    group("g3", "v2", "c1"),
  ],
};

const member = (role: Role, scope: Partial<Scope> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: [], ...scope},
  createdAt: T0,
  updatedAt: T0,
});

const ids = (items: {id: string}[]) => items.map((i) => i.id).sort();

describe("visibleStructure", () => {
  it.each<Role>(["owner", "accountant"])("shows everything to %s", (role) => {
    expect(visibleStructure(member(role), structure)).toEqual(structure);
  });

  it("ignores scope for owner and accountant", () => {
    const result = visibleStructure(
      member("owner", {venueIds: ["v1"]}),
      structure,
    );
    expect(result).toEqual(structure);
  });

  it("shows a coordinator their venues, those groups and all categories", () => {
    const result = visibleStructure(
      member("coordinator", {venueIds: ["v1"]}),
      structure,
    );
    expect(ids(result.venues)).toEqual(["v1"]);
    expect(ids(result.groups)).toEqual(["g1", "g2"]);
    expect(ids(result.categories)).toEqual(["c1", "c2", "c3"]);
  });

  it("shows a teacher their groups, those venues and those categories", () => {
    const result = visibleStructure(
      member("teacher", {groupIds: ["g1", "g3"]}),
      structure,
    );
    expect(ids(result.groups)).toEqual(["g1", "g3"]);
    expect(ids(result.venues)).toEqual(["v1", "v2"]);
    expect(ids(result.categories)).toEqual(["c1"]);
  });

  it("ignores venueIds for a teacher and groupIds for a coordinator", () => {
    const teacher = visibleStructure(
      member("teacher", {venueIds: ["v1"], groupIds: ["g3"]}),
      structure,
    );
    expect(ids(teacher.groups)).toEqual(["g3"]);
    expect(ids(teacher.venues)).toEqual(["v2"]);

    const coordinator = visibleStructure(
      member("coordinator", {venueIds: ["v2"], groupIds: ["g1"]}),
      structure,
    );
    expect(ids(coordinator.groups)).toEqual(["g3"]);
  });

  it.each<Role>(["coordinator", "teacher"])(
    "shows nothing to a %s with an empty scope",
    (role) => {
      expect(visibleStructure(member(role), structure)).toEqual({
        venues: [],
        categories: [],
        groups: [],
      });
    },
  );

  it("skips scope entries that point to missing documents", () => {
    const result = visibleStructure(
      member("coordinator", {venueIds: ["ghost"]}),
      structure,
    );
    expect(result.venues).toEqual([]);
    expect(result.groups).toEqual([]);
  });

  it.each<Role>(["guardian", "adultPlayer"])("denies %s", (role) => {
    try {
      visibleStructure(member(role), structure);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("permission_denied");
      return;
    }
    throw new Error("expected permission_denied");
  });
});
