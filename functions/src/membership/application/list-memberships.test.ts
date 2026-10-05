import {beforeEach, describe, expect, it} from "vitest";
import {ListMemberships} from "./list-memberships.js";
import {DomainError} from "../../shared/domain/errors.js";
import type {Membership} from "../domain/membership.js";
import type {Role} from "../domain/role.js";
import type {Group} from "../../structure/domain/structure.js";
import {FakeClock} from "../../shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryIdentityProvider} from "./testing/in-memory-identity-provider.js";
import {InMemoryMembershipRepository} from "./testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../shared/application/testing/in-memory-unit-of-work.js";

const T0 = new Date("2026-10-01T00:00:00Z");

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

const scoped = (
  venueIds: string[],
  groupIds: string[] = [],
  playerIds: string[] = [],
) => ({venueIds, groupIds, playerIds});

const group = (id: string, venueId: string): Group => ({
  id,
  tenantId: "tenant-a",
  venueId,
  categoryId: "cat-1",
  name: id,
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
});

let memberships: InMemoryMembershipRepository;
let identity: InMemoryIdentityProvider;
let uow: InMemoryUnitOfWork;
let list: ListMemberships;
const uids: Record<string, string> = {};

// Creates the Auth account and the membership of one person.
const person = async (
  name: string,
  role: Role,
  overrides: Partial<Membership> = {},
  tenantId = "tenant-a",
) => {
  const {uid} = identity.seed(`${name}@club.co`, {hasSignedIn: true});
  uids[name] = uid;
  await memberships.save(member(uid, role, {...overrides, tenantId}));
};

beforeEach(async () => {
  const clock = new FakeClock(new Date("2026-10-04T12:00:00Z"));
  memberships = new InMemoryMembershipRepository();
  identity = new InMemoryIdentityProvider();
  uow = new InMemoryUnitOfWork(memberships, new InMemoryAuditLogWriter(clock));
  list = new ListMemberships(uow, identity);

  await uow.groups.save(group("g-norte", "v-norte"));
  await uow.groups.save(group("g-sur", "v-sur"));
  await uow.groups.save(group("g-este", "v-este"));

  await person("owner", "owner");
  await person("acc", "accountant");
  await person("coord-norte", "coordinator", {scope: scoped(["v-norte"])});
  await person("coord-sur", "coordinator", {scope: scoped(["v-sur"])});
  await person("coord-nortesur", "coordinator", {
    scope: scoped(["v-norte", "v-sur"]),
  });
  await person("teach-norte", "teacher", {scope: scoped([], ["g-norte"])});
  await person("teach-sur", "teacher", {scope: scoped([], ["g-sur"])});
  await person("teach-mix", "teacher", {
    scope: scoped([], ["g-este", "g-norte"]),
  });
  await person("guardian", "guardian", {scope: scoped([], [], ["p1"])});
  await person("old-teacher", "teacher", {
    status: "inactive",
    scope: scoped([], ["g-norte"]),
  });
  await person("other-tenant", "owner", {}, "tenant-b");
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

const visibleTo = async (actor: string): Promise<string[]> => {
  const {memberships: found} = await list.execute({
    tenantId: "tenant-a",
    actorUid: uids[actor],
  });
  const names = new Map(Object.entries(uids).map(([n, u]) => [u, n]));
  return found.map((m) => names.get(m.uid)!).sort();
};

const everyone = [
  "acc",
  "coord-norte",
  "coord-nortesur",
  "coord-sur",
  "guardian",
  "old-teacher",
  "owner",
  "teach-mix",
  "teach-norte",
  "teach-sur",
];

describe("ListMemberships — owner and accountant see everyone", () => {
  it.each(["owner", "acc"])(
    "%s sees every member of the organization, active or not",
    async (actor) => {
      expect(await visibleTo(actor)).toEqual(everyone);
    },
  );

  it("never shows members of another organization", async () => {
    expect(await visibleTo("owner")).not.toContain("other-tenant");
  });
});

describe("ListMemberships — a coordinator sees their venues", () => {
  it("sees coordinators who share a venue (themselves included)", async () => {
    expect(await visibleTo("coord-norte")).toEqual([
      "coord-norte",
      "coord-nortesur",
      "old-teacher",
      "teach-mix",
      "teach-norte",
    ]);
  });

  it("sees teachers with at least one group in their venues", async () => {
    expect(await visibleTo("coord-sur")).toEqual([
      "coord-nortesur",
      "coord-sur",
      "teach-sur",
    ]);
  });

  it("with several venues sees the union", async () => {
    expect(await visibleTo("coord-nortesur")).toEqual([
      "coord-norte",
      "coord-nortesur",
      "coord-sur",
      "old-teacher",
      "teach-mix",
      "teach-norte",
      "teach-sur",
    ]);
  });

  it("does not see owners, accountants or guardians", async () => {
    const seen = await visibleTo("coord-norte");
    for (const hidden of ["owner", "acc", "guardian"]) {
      expect(seen).not.toContain(hidden);
    }
  });

  it("does not see a teacher whose groups are in other venues", async () => {
    expect(await visibleTo("coord-norte")).not.toContain("teach-sur");
  });
});

describe("ListMemberships — who may list", () => {
  it.each(["teach-norte", "guardian"])(
    "rejects a %s with permission_denied",
    async (actor) => {
      expect(
        await rejection(
          list.execute({tenantId: "tenant-a", actorUid: uids[actor]}),
        ),
      ).toBe("permission_denied");
    },
  );

  it("rejects an inactive member, whatever the role", async () => {
    await person("coord-off", "coordinator", {
      status: "inactive",
      scope: scoped(["v-norte"]),
    });
    expect(
      await rejection(
        list.execute({tenantId: "tenant-a", actorUid: uids["coord-off"]}),
      ),
    ).toBe("permission_denied");
  });

  it("rejects someone from another organization", async () => {
    expect(
      await rejection(
        list.execute({tenantId: "tenant-a", actorUid: uids["other-tenant"]}),
      ),
    ).toBe("permission_denied");
  });

  it("rejects an unknown actor", async () => {
    expect(
      await rejection(list.execute({tenantId: "tenant-a", actorUid: "ghost"})),
    ).toBe("permission_denied");
  });
});

describe("ListMemberships — what is returned", () => {
  it("returns uid, email, role, status and scope", async () => {
    const {memberships: found} = await list.execute({
      tenantId: "tenant-a",
      actorUid: uids["owner"],
    });

    expect(found.find((m) => m.uid === uids["teach-mix"])).toEqual({
      uid: uids["teach-mix"],
      email: "teach-mix@club.co",
      role: "teacher",
      status: "active",
      scope: scoped([], ["g-este", "g-norte"]),
    });
    expect(found.find((m) => m.uid === uids["old-teacher"])?.status).toBe(
      "inactive",
    );
  });

  it("returns the members ordered by email", async () => {
    const {memberships: found} = await list.execute({
      tenantId: "tenant-a",
      actorUid: uids["owner"],
    });
    const emails = found.map((m) => m.email);
    expect(emails).toEqual([...emails].sort());
  });

  it("returns an empty email for a member without an account", async () => {
    await memberships.save(member("orphan", "accountant"));
    const {memberships: found} = await list.execute({
      tenantId: "tenant-a",
      actorUid: uids["owner"],
    });
    expect(found.find((m) => m.uid === "orphan")?.email).toBe("");
  });

  it("does not modify anything", async () => {
    const before = await memberships.listByTenant("tenant-a");
    await list.execute({tenantId: "tenant-a", actorUid: uids["owner"]});
    expect(await memberships.listByTenant("tenant-a")).toEqual(before);
  });
});
