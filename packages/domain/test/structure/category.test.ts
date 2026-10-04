import {beforeEach, describe, expect, it} from "vitest";
import {SaveCategory} from "../../src/structure/save-category.js";
import {
  SetCategoryStatus,
} from "../../src/structure/set-category-status.js";
import {DomainError} from "../../src/errors.js";
import type {Membership} from "../../src/membership/membership.js";
import type {Role} from "../../src/membership/role.js";
import type {Category, Group} from "../../src/structure/structure.js";
import {
  FakeClock,
  InMemoryAuditLogWriter,
  InMemoryMembershipRepository,
  InMemoryUnitOfWork,
} from "../fakes/index.js";

const T0 = new Date("2026-10-01T00:00:00Z");
const NOW = new Date("2026-10-03T12:00:00Z");

const member = (
  uid: string,
  role: Role,
  overrides: Partial<Membership> = {},
): Membership => ({
  uid,
  tenantId: "tenant-a",
  role,
  status: "active",
  scope: {venueIds: [], groupIds: [], playerIds: []},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: "cat-x",
  tenantId: "tenant-a",
  name: "Sub-10",
  birthYears: [2016],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-x",
  tenantId: "tenant-a",
  venueId: "venue-1",
  categoryId: "cat-x",
  name: "Grupo A",
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let uow: InMemoryUnitOfWork;
let saveCategory: SaveCategory;
let setStatus: SetCategoryStatus;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  saveCategory = new SaveCategory(uow, clock);
  setStatus = new SetCategoryStatus(uow, clock);
  await memberships.save(member("owner-1", "owner"));
});

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error("expected the use case to be rejected");
};

const create = (overrides = {}) => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  name: "Sub-10",
  birthYears: [2016],
  ...overrides,
});

describe("SaveCategory — create", () => {
  it("creates an active category and one audit entry", async () => {
    const {categoryId} = await saveCategory.execute(
      create({birthYears: [2015, 2016]}),
    );
    const saved = (await uow.categories.get("tenant-a", categoryId))!;
    expect(saved).toMatchObject({
      name: "Sub-10",
      birthYears: [2015, 2016],
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      actorRole: "owner",
      action: "category.created",
      target: {type: "category", id: categoryId},
      before: {},
      after: {name: "Sub-10", birthYears: [2015, 2016], status: "active"},
    });
  });

  it("accepts a level-based category with no birth years", async () => {
    const {categoryId} = await saveCategory.execute(
      create({name: "Avanzados", birthYears: []}),
    );
    expect((await uow.categories.get("tenant-a", categoryId))!.birthYears)
      .toEqual([]);
  });

  it.each<Role>(["coordinator", "accountant", "teacher", "guardian",
    "adultPlayer"])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(
      saveCategory.execute(create({actorUid: "u-1"})),
    );
    expect(code).toBe("permission_denied");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const code = await rejection(
      saveCategory.execute(create({actorUid: "owner-b"})),
    );
    expect(code).toBe("permission_denied");
  });

  it("rejects a blank name and non-integer birth years", async () => {
    expect(await rejection(saveCategory.execute(create({name: " "}))))
      .toBe("invalid_argument");
    expect(await rejection(
      saveCategory.execute(create({birthYears: [2016.5]})),
    )).toBe("invalid_argument");
  });

  it("rejects a name used by an active category, ignoring case", async () => {
    await uow.categories.save(category());
    const code = await rejection(
      saveCategory.execute(create({name: " sub-10 "})),
    );
    expect(code).toBe("failed_precondition");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("allows reusing a closed name and the same name in another tenant",
    async () => {
      await uow.categories.save(category({status: "closed"}));
      await uow.categories.save(category({id: "c-b", tenantId: "tenant-b"}));
      await expect(saveCategory.execute(create())).resolves.toBeDefined();
    });
});

describe("SaveCategory — update", () => {
  beforeEach(async () => {
    await uow.categories.save(category());
  });

  it("updates fields, keeps createdAt and records before/after", async () => {
    const result = await saveCategory.execute(create({
      categoryId: "cat-x",
      name: "Sub-12",
      birthYears: [2014],
    }));
    expect(result).toEqual({categoryId: "cat-x"});
    const saved = (await uow.categories.get("tenant-a", "cat-x"))!;
    expect(saved).toMatchObject({
      name: "Sub-12",
      birthYears: [2014],
      createdAt: T0,
      updatedAt: NOW,
    });
    expect(auditLog.entries[0]).toMatchObject({
      action: "category.updated",
      before: {name: "Sub-10", birthYears: [2016]},
      after: {name: "Sub-12", birthYears: [2014]},
    });
  });

  it("allows keeping its own name", async () => {
    await expect(saveCategory.execute(
      create({categoryId: "cat-x", birthYears: [2015]}),
    )).resolves.toEqual({categoryId: "cat-x"});
  });

  it("rejects a name used by another active category", async () => {
    await uow.categories.save(category({id: "cat-y", name: "Sub-12"}));
    const code = await rejection(saveCategory.execute(
      create({categoryId: "cat-x", name: "sub-12"}),
    ));
    expect(code).toBe("failed_precondition");
  });

  it("rejects a category that does not exist or is of another tenant",
    async () => {
      await uow.categories.save(category({id: "c-b", tenantId: "tenant-b"}));
      expect(await rejection(
        saveCategory.execute(create({categoryId: "nope"})),
      )).toBe("not_found");
      expect(await rejection(
        saveCategory.execute(create({categoryId: "c-b"})),
      )).toBe("not_found");
    });

  it("rejects non-owners", async () => {
    await memberships.save(member("c1", "coordinator"));
    const code = await rejection(saveCategory.execute(
      create({categoryId: "cat-x", actorUid: "c1"}),
    ));
    expect(code).toBe("permission_denied");
  });
});

describe("SetCategoryStatus", () => {
  const close = (overrides = {}) => ({
    tenantId: "tenant-a",
    actorUid: "owner-1",
    categoryId: "cat-x",
    status: "closed" as const,
    ...overrides,
  });

  beforeEach(async () => {
    await uow.categories.save(category());
  });

  it("closes a category without active groups and audits it", async () => {
    await uow.groups.save(group({status: "closed"}));
    await uow.groups.save(group({id: "g-b", categoryId: "cat-y"}));
    const result = await setStatus.execute(close({reason: "Ya no se usa"}));
    expect(result).toEqual({categoryId: "cat-x", status: "closed"});
    const saved = (await uow.categories.get("tenant-a", "cat-x"))!;
    expect(saved.status).toBe("closed");
    expect(saved.updatedAt).toEqual(NOW);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      action: "category.closed",
      before: {status: "active"},
      after: {status: "closed"},
      reason: "Ya no se usa",
    });
  });

  it("rejects closing a category with active groups, changing nothing",
    async () => {
      await uow.groups.save(group());
      const code = await rejection(setStatus.execute(close()));
      expect(code).toBe("failed_precondition");
      expect((await uow.categories.get("tenant-a", "cat-x"))!.status)
        .toBe("active");
      expect(auditLog.entries).toHaveLength(0);
    });

  it("reopens a closed category and audits it", async () => {
    await uow.categories.save(category({status: "closed"}));
    const result = await setStatus.execute(close({status: "active"}));
    expect(result).toEqual({categoryId: "cat-x", status: "active"});
    expect(auditLog.entries[0]).toMatchObject({
      action: "category.reopened",
      before: {status: "closed"},
      after: {status: "active"},
    });
  });

  it("rejects reopening when an active category took the name", async () => {
    await uow.categories.save(category({status: "closed"}));
    await uow.categories.save(category({id: "cat-y"}));
    const code = await rejection(setStatus.execute(close({status: "active"})));
    expect(code).toBe("failed_precondition");
    expect((await uow.categories.get("tenant-a", "cat-x"))!.status)
      .toBe("closed");
  });

  it("rejects a status that is already set", async () => {
    const code = await rejection(setStatus.execute(close({status: "active"})));
    expect(code).toBe("failed_precondition");
  });

  it("rejects a category that does not exist", async () => {
    const code = await rejection(
      setStatus.execute(close({categoryId: "nope"})),
    );
    expect(code).toBe("not_found");
  });

  it.each<Role>(["coordinator", "accountant", "teacher", "guardian",
    "adultPlayer"])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(setStatus.execute(close({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
  });
});
