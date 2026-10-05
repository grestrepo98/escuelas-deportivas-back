import {describe, expect, it} from "vitest";
import {
  assertCanListPlayers,
  assertCanReadPlayer,
  canReadPlayer,
  canSeeGuardian,
  assertCanWriteInVenue,
  playerViewFor,
} from "../../../../src/player/domain/player-visibility.js";
import type {Player} from "../../../../src/player/domain/player.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";

function failsWith(code: string, fn: () => unknown): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected DomainError ${code}`);
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

const player: Player = {
  id: "p1",
  tenantId: "t1",
  firstNames: "Juan",
  lastNames: "Perez",
  nameKey: "perez juan",
  document: {type: "TI", number: "123"},
  documentKey: "TI:123",
  birthDate: "2014-05-01",
  groupId: "g1",
  venueId: "v1",
  categoryId: "c1",
  status: "activo",
  statusReason: null,
  joinedAt: new Date("2026-02-01T00:00:00Z"),
  emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
  medical: {allergies: "ninguna"},
  guardians: [
    {
      guardianId: "a1",
      fullName: "Ana Perez",
      relationship: "madre",
      isPaymentResponsible: true,
    },
  ],
  guardianIds: ["a1"],
  dataConsent: {
    guardianId: "a1",
    recordedBy: "u1",
    at: new Date("2026-02-01T00:00:00Z"),
  },
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
};

describe("assertCanReadPlayer", () => {
  it.each(["owner", "accountant"] as const)("%s reads any player", (role) => {
    expect(() => assertCanReadPlayer(member(role), player)).not.toThrow();
  });

  it("lets a coordinator read a player of their venues", () => {
    expect(() =>
      assertCanReadPlayer(member("coordinator", {venueIds: ["v1"]}), player),
    ).not.toThrow();
  });

  it("denies a coordinator a player of another venue", () => {
    failsWith("permission_denied", () =>
      assertCanReadPlayer(member("coordinator", {venueIds: ["v2"]}), player),
    );
  });

  it("denies a coordinator with an empty scope", () => {
    failsWith("permission_denied", () =>
      assertCanReadPlayer(member("coordinator"), player),
    );
  });

  it("lets a teacher read a player of their groups", () => {
    expect(() =>
      assertCanReadPlayer(member("teacher", {groupIds: ["g1"]}), player),
    ).not.toThrow();
  });

  it("denies a teacher a player of another group", () => {
    failsWith("permission_denied", () =>
      assertCanReadPlayer(member("teacher", {groupIds: ["g2"]}), player),
    );
  });

  it("denies a teacher with an empty scope", () => {
    failsWith("permission_denied", () =>
      assertCanReadPlayer(member("teacher"), player),
    );
  });

  it.each(["guardian", "adultPlayer"] as const)("denies %s", (role) => {
    failsWith("permission_denied", () =>
      assertCanReadPlayer(member(role, {playerIds: ["p1"]}), player),
    );
  });
});

describe("assertCanWriteInVenue", () => {
  it.each(["owner", "accountant"] as const)("%s writes anywhere", (role) => {
    expect(() => assertCanWriteInVenue(member(role), "v9")).not.toThrow();
  });

  it("lets a coordinator write in their venues only", () => {
    const coordinator = member("coordinator", {venueIds: ["v1"]});
    expect(() => assertCanWriteInVenue(coordinator, "v1")).not.toThrow();
    failsWith("permission_denied", () =>
      assertCanWriteInVenue(coordinator, "v2"),
    );
  });

  it("denies a coordinator with an empty scope", () => {
    failsWith("permission_denied", () =>
      assertCanWriteInVenue(member("coordinator"), "v1"),
    );
  });

  it.each(["teacher", "guardian", "adultPlayer"] as const)(
    "denies %s",
    (role) => {
      failsWith("permission_denied", () =>
        assertCanWriteInVenue(member(role, {groupIds: ["g1"]}), "v1"),
      );
    },
  );
});

describe("playerViewFor", () => {
  it("returns the full record for the owner", () => {
    expect(playerViewFor(member("owner"), player)).toEqual(player);
  });

  it("returns the full record for a coordinator of the venue", () => {
    const view = playerViewFor(
      member("coordinator", {venueIds: ["v1"]}),
      player,
    );
    expect(view).toEqual(player);
  });

  it("strips document, guardians and consent for a teacher", () => {
    const view = playerViewFor(member("teacher", {groupIds: ["g1"]}), player);
    expect(view).not.toHaveProperty("document");
    expect(view).not.toHaveProperty("documentKey");
    expect(view).not.toHaveProperty("guardians");
    expect(view).not.toHaveProperty("guardianIds");
    expect(view).not.toHaveProperty("dataConsent");
    expect(view).toMatchObject({
      id: "p1",
      firstNames: "Juan",
      groupId: "g1",
      status: "activo",
      emergencyContact: player.emergencyContact,
      medical: player.medical,
    });
  });

  it("denies a record outside the scope", () => {
    failsWith("permission_denied", () =>
      playerViewFor(member("teacher", {groupIds: ["g2"]}), player),
    );
  });
});

describe("canSeeGuardian", () => {
  const linked = [{venueId: "v1"}, {venueId: "v3"}];

  it.each(["owner", "accountant"] as const)(
    "lets %s see any guardian, linked or not",
    (role) => {
      expect(canSeeGuardian(member(role), linked)).toBe(true);
      expect(canSeeGuardian(member(role), [])).toBe(true);
    },
  );

  it("lets a coordinator see a guardian linked to a player of their venues", () => {
    expect(
      canSeeGuardian(member("coordinator", {venueIds: ["v1"]}), linked),
    ).toBe(true);
  });

  it("hides from a coordinator a guardian with no player in their venues", () => {
    expect(
      canSeeGuardian(member("coordinator", {venueIds: ["v2"]}), linked),
    ).toBe(false);
    expect(canSeeGuardian(member("coordinator", {venueIds: ["v1"]}), [])).toBe(
      false,
    );
  });

  it.each(["teacher", "guardian", "adultPlayer"] as const)(
    "hides guardians from %s",
    (role) => {
      expect(canSeeGuardian(member(role, {venueIds: ["v1"]}), linked)).toBe(
        false,
      );
    },
  );
});

describe("canReadPlayer", () => {
  it("is the boolean form of assertCanReadPlayer", () => {
    expect(canReadPlayer(member("owner"), player)).toBe(true);
    expect(
      canReadPlayer(member("coordinator", {venueIds: ["v1"]}), player),
    ).toBe(true);
    expect(
      canReadPlayer(member("coordinator", {venueIds: ["v2"]}), player),
    ).toBe(false);
    expect(canReadPlayer(member("teacher", {groupIds: ["g1"]}), player)).toBe(
      true,
    );
    expect(canReadPlayer(member("teacher", {groupIds: ["g2"]}), player)).toBe(
      false,
    );
    expect(canReadPlayer(member("guardian", {playerIds: ["p1"]}), player)).toBe(
      false,
    );
  });
});

describe("assertCanListPlayers", () => {
  it.each(["owner", "accountant", "coordinator", "teacher"] as const)(
    "lets %s list players",
    (role) => {
      expect(() => assertCanListPlayers(member(role))).not.toThrow();
    },
  );

  it.each(["guardian", "adultPlayer"] as const)("denies %s", (role) => {
    failsWith("permission_denied", () => assertCanListPlayers(member(role)));
  });
});
