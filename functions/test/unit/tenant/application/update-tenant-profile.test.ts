import {beforeEach, describe, expect, it} from "vitest";
import {UpdateTenantProfile} from "../../../../src/tenant/application/update-tenant-profile.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import type {Tenant} from "../../../../src/tenant/domain/tenant.js";
import {FakeClock} from "../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../../../src/shared/application/testing/in-memory-unit-of-work.js";

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

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: "tenant-a",
  name: "Argentinos Juniors",
  status: "active",
  contact: {email: "old@aj.co"},
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let uow: InMemoryUnitOfWork;
let useCase: UpdateTenantProfile;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  useCase = new UpdateTenantProfile(uow, clock);
  await memberships.save(member("owner-1", "owner"));
  await uow.tenants.save(tenant());
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

const input = (overrides = {}) => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  name: "Argentinos Juniors Cali",
  idrdRegistration: "IDRD-123",
  contact: {email: "info@aj.co", phone: "3001234567"},
  ...overrides,
});

describe("UpdateTenantProfile", () => {
  it("updates the profile, keeps status and createdAt, and audits it", async () => {
    const result = await useCase.execute(input());
    expect(result).toEqual({tenantId: "tenant-a"});
    const saved = (await uow.tenants.get("tenant-a"))!;
    expect(saved).toMatchObject({
      name: "Argentinos Juniors Cali",
      idrdRegistration: "IDRD-123",
      contact: {email: "info@aj.co", phone: "3001234567"},
      status: "active",
      createdAt: T0,
      updatedAt: NOW,
    });
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "tenant.updated",
      target: {type: "tenant", id: "tenant-a"},
      before: {name: "Argentinos Juniors", contact: {email: "old@aj.co"}},
      after: {name: "Argentinos Juniors Cali", idrdRegistration: "IDRD-123"},
    });
  });

  it("drops optional fields that are blank or absent", async () => {
    await uow.tenants.save(tenant({idrdRegistration: "OLD"}));
    await useCase.execute(
      input({idrdRegistration: " ", contact: {email: "", phone: undefined}}),
    );
    const saved = (await uow.tenants.get("tenant-a"))!;
    expect("idrdRegistration" in saved).toBe(false);
    expect(saved.contact).toEqual({});
  });

  it.each<Role>([
    "coordinator",
    "accountant",
    "teacher",
    "guardian",
    "adultPlayer",
  ])("rejects %s", async (role) => {
    await memberships.save(member("u-1", role));
    const code = await rejection(useCase.execute(input({actorUid: "u-1"})));
    expect(code).toBe("permission_denied");
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rejects an owner of another tenant", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const code = await rejection(useCase.execute(input({actorUid: "owner-b"})));
    expect(code).toBe("permission_denied");
  });

  it("rejects a blank name", async () => {
    expect(await rejection(useCase.execute(input({name: "  "})))).toBe(
      "invalid_argument",
    );
    expect((await uow.tenants.get("tenant-a"))!.name).toBe(
      "Argentinos Juniors",
    );
  });

  it("rejects a tenant document that does not exist", async () => {
    await memberships.save(member("owner-c", "owner", {tenantId: "tenant-c"}));
    const code = await rejection(
      useCase.execute(input({tenantId: "tenant-c", actorUid: "owner-c"})),
    );
    expect(code).toBe("not_found");
  });
});
