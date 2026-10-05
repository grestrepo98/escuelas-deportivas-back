import {beforeEach, describe, expect, it} from "vitest";
import {assertScopeReferences} from "./scope-references.js";
import {DomainError} from "../../shared/domain/errors.js";
import type {Group, Venue} from "../../structure/domain/structure.js";
import {InMemoryStructureRepository} from "../../structure/application/testing/in-memory-structure-repository.js";

const T0 = new Date("2026-10-01T00:00:00Z");

const venue = (overrides: Partial<Venue> = {}): Venue => ({
  id: "venue-1",
  tenantId: "tenant-a",
  name: "Sede Norte",
  address: "Calle 1",
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-1",
  tenantId: "tenant-a",
  venueId: "venue-1",
  categoryId: "cat-1",
  name: "Sub-10",
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const scope = (venueIds: string[], groupIds: string[]) => ({
  venueIds,
  groupIds,
  playerIds: [],
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error("expected a DomainError");
}

describe("assertScopeReferences", () => {
  let venues: InMemoryStructureRepository<Venue>;
  let groups: InMemoryStructureRepository<Group>;

  beforeEach(async () => {
    venues = new InMemoryStructureRepository<Venue>("venue");
    groups = new InMemoryStructureRepository<Group>("group");
    await venues.save(venue());
    await venues.save(venue({id: "venue-2", name: "Sede Sur"}));
    await venues.save(venue({id: "venue-closed", status: "closed"}));
    await venues.save(venue({id: "venue-b", tenantId: "tenant-b"}));
    await groups.save(group());
    await groups.save(group({id: "group-2"}));
    await groups.save(group({id: "group-closed", status: "closed"}));
    await groups.save(group({id: "group-b", tenantId: "tenant-b"}));
  });

  const run = (s: ReturnType<typeof scope>) =>
    assertScopeReferences({venues, groups}, "tenant-a", s);

  it("accepts an empty scope", async () => {
    await expect(run(scope([], []))).resolves.toBeUndefined();
  });

  it("accepts active venues of the organization", async () => {
    await expect(
      run(scope(["venue-1", "venue-2"], [])),
    ).resolves.toBeUndefined();
  });

  it("accepts active groups of the organization", async () => {
    await expect(
      run(scope([], ["group-1", "group-2"])),
    ).resolves.toBeUndefined();
  });

  it("rejects a venue that does not exist with invalid_argument", async () => {
    expect(await codeOf(run(scope(["venue-9"], [])))).toBe("invalid_argument");
  });

  it("rejects a venue of another organization with invalid_argument", async () => {
    expect(await codeOf(run(scope(["venue-b"], [])))).toBe("invalid_argument");
  });

  it("rejects a closed venue with failed_precondition", async () => {
    expect(await codeOf(run(scope(["venue-closed"], [])))).toBe(
      "failed_precondition",
    );
  });

  it("rejects a group that does not exist with invalid_argument", async () => {
    expect(await codeOf(run(scope([], ["group-9"])))).toBe("invalid_argument");
  });

  it("rejects a group of another organization with invalid_argument", async () => {
    expect(await codeOf(run(scope([], ["group-b"])))).toBe("invalid_argument");
  });

  it("rejects a closed group with failed_precondition", async () => {
    expect(await codeOf(run(scope([], ["group-closed"])))).toBe(
      "failed_precondition",
    );
  });

  it("rejects the whole scope when only one reference is bad", async () => {
    expect(await codeOf(run(scope(["venue-1", "venue-closed"], [])))).toBe(
      "failed_precondition",
    );
  });
});
