import {describe, expect, it} from "vitest";
import {DomainError} from "../../../../../src/shared/domain/errors.js";
import type {Membership} from "../../../../../src/membership/domain/membership.js";
import type {MembershipDeactivationGuard} from "../../../../../src/membership/application/membership-deactivation-guard.js";
import {AllowAllDeactivationGuard} from "../../../../../src/membership/application/testing/allow-all-deactivation-guard.js";
import {InMemoryIdentityProvider} from "../../../../../src/membership/application/testing/in-memory-identity-provider.js";
import {InMemoryMembershipRepository} from "../../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {RejectingDeactivationGuard} from "../../../../../src/membership/application/testing/rejecting-deactivation-guard.js";

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  uid: "u1",
  tenantId: "tenant-a",
  role: "coordinator",
  status: "active",
  scope: {venueIds: ["v1"], groupIds: [], playerIds: []},
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

describe("InMemoryMembershipRepository.listByTenant", () => {
  it("returns every membership of the tenant, active or not", async () => {
    const repo = new InMemoryMembershipRepository();
    await repo.save(membership({uid: "u1"}));
    await repo.save(membership({uid: "u2", status: "inactive"}));
    await repo.save(membership({uid: "u3", tenantId: "tenant-b"}));

    const found = await repo.listByTenant("tenant-a");

    expect(found.map((m) => m.uid).sort()).toEqual(["u1", "u2"]);
  });

  it("returns an empty list for a tenant without members", async () => {
    const repo = new InMemoryMembershipRepository();
    expect(await repo.listByTenant("tenant-x")).toEqual([]);
  });

  it("returns copies that do not alias the stored data", async () => {
    const repo = new InMemoryMembershipRepository();
    await repo.save(membership());
    const [found] = await repo.listByTenant("tenant-a");
    found.scope.venueIds.push("v2");
    expect((await repo.get("u1", "tenant-a"))?.scope.venueIds).toEqual(["v1"]);
  });
});

describe("InMemoryIdentityProvider", () => {
  it("finds nothing for an unknown email", async () => {
    const identity = new InMemoryIdentityProvider();
    expect(await identity.findByEmail("a@x.co")).toBeNull();
  });

  it("creates an account that has never signed in", async () => {
    const identity = new InMemoryIdentityProvider();
    const {uid} = await identity.create("a@x.co");

    expect(await identity.findByEmail("a@x.co")).toEqual({
      uid,
      hasSignedIn: false,
    });
  });

  it("gives each created account its own uid", async () => {
    const identity = new InMemoryIdentityProvider();
    const a = await identity.create("a@x.co");
    const b = await identity.create("b@x.co");
    expect(a.uid).not.toBe(b.uid);
  });

  it("matches emails ignoring case, like Firebase Auth", async () => {
    const identity = new InMemoryIdentityProvider();
    const {uid} = await identity.create("Ana@X.co");
    expect((await identity.findByEmail("ana@x.CO"))?.uid).toBe(uid);
  });

  it("refuses to create a second account for the same email", async () => {
    const identity = new InMemoryIdentityProvider();
    await identity.create("a@x.co");
    await expect(identity.create("A@x.co")).rejects.toThrow();
  });

  it("reports an account seeded as already signed in", async () => {
    const identity = new InMemoryIdentityProvider();
    const {uid} = identity.seed("a@x.co", {hasSignedIn: true});
    expect(await identity.findByEmail("a@x.co")).toEqual({
      uid,
      hasSignedIn: true,
    });
  });

  it("issues a password reset link only for an existing account", async () => {
    const identity = new InMemoryIdentityProvider();
    await identity.create("a@x.co");

    expect(await identity.createPasswordResetLink("a@x.co")).toContain(
      "a%40x.co",
    );
    await expect(
      identity.createPasswordResetLink("nobody@x.co"),
    ).rejects.toThrow();
  });

  it("maps uids to emails and skips unknown uids", async () => {
    const identity = new InMemoryIdentityProvider();
    const a = await identity.create("a@x.co");

    const emails = await identity.getEmails([a.uid, "ghost"]);

    expect(emails).toEqual(new Map([[a.uid, "a@x.co"]]));
  });
});

describe("deactivation guards", () => {
  it("AllowAllDeactivationGuard lets any membership be deactivated", async () => {
    const guard: MembershipDeactivationGuard = new AllowAllDeactivationGuard();
    await expect(
      guard.assertCanDeactivate(membership()),
    ).resolves.toBeUndefined();
  });

  it("RejectingDeactivationGuard fails with failed_precondition", async () => {
    const guard: MembershipDeactivationGuard = new RejectingDeactivationGuard(
      "Open cash register",
    );
    await expect(guard.assertCanDeactivate(membership())).rejects.toMatchObject(
      {
        code: "failed_precondition",
        message: "Open cash register",
      },
    );
    await expect(
      guard.assertCanDeactivate(membership()),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
