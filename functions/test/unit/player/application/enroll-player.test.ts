import {beforeEach, describe, expect, it} from "vitest";
import {
  EnrollPlayer,
  type EnrollPlayerInput,
} from "../../../../src/player/application/enroll-player.js";
import {DomainError} from "../../../../src/shared/domain/errors.js";
import type {Membership} from "../../../../src/membership/domain/membership.js";
import type {Role} from "../../../../src/membership/domain/role.js";
import type {Group} from "../../../../src/structure/domain/structure.js";
import {FakeClock} from "../../../../src/shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../../src/audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../../../src/membership/application/testing/in-memory-membership-repository.js";
import {InMemoryUnitOfWork} from "../../../../src/shared/application/testing/in-memory-unit-of-work.js";
import {
  buildGuardian,
  buildPlayer,
} from "../../../../src/player/application/testing/fixtures.js";

const T0 = new Date("2026-10-01T00:00:00Z");
const NOW = new Date("2026-10-04T12:00:00Z");

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

const group = (overrides: Partial<Group> = {}): Group => ({
  id: "group-1",
  tenantId: "tenant-a",
  venueId: "venue-1",
  categoryId: "category-1",
  name: "Grupo A",
  schedule: [],
  status: "active",
  createdAt: T0,
  updatedAt: T0,
  ...overrides,
});

const baseInput = (
  overrides: Partial<EnrollPlayerInput> = {},
): EnrollPlayerInput => ({
  tenantId: "tenant-a",
  actorUid: "owner-1",
  firstNames: "Juan Camilo",
  lastNames: "Pérez Gómez",
  birthDate: "2014-05-01",
  groupId: "group-1",
  emergencyContact: {
    name: "Ana Gómez",
    phone: "3001112233",
    relationship: "madre",
  },
  guardians: [],
  ...overrides,
});

const newGuardian = {
  firstNames: "Ana",
  lastNames: "Gómez",
  document: {type: "CC" as const, number: "1.020.304"},
  phone: "3001112233",
  email: "ana@example.com",
  preferredContact: "whatsapp" as const,
};

let memberships: InMemoryMembershipRepository;
let auditLog: InMemoryAuditLogWriter;
let uow: InMemoryUnitOfWork;
let enroll: EnrollPlayer;

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }
  throw new Error("expected the use case to fail");
}

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  memberships = new InMemoryMembershipRepository();
  auditLog = new InMemoryAuditLogWriter(clock);
  uow = new InMemoryUnitOfWork(memberships, auditLog);
  enroll = new EnrollPlayer(uow, clock);
  await memberships.save(member("owner-1", "owner"));
  await uow.groups.save(group());
});

describe("EnrollPlayer — happy path", () => {
  it("creates a pre-enrolled player with the venue and category of the group", async () => {
    const result = await enroll.execute(baseInput());

    expect(result.status).toBe("preinscrito");
    expect(result.createdGuardianIds).toEqual([]);
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved).toMatchObject({
      tenantId: "tenant-a",
      firstNames: "Juan Camilo",
      lastNames: "Pérez Gómez",
      nameKey: "perez gomez juan camilo",
      document: null,
      documentKey: null,
      birthDate: "2014-05-01",
      groupId: "group-1",
      venueId: "venue-1",
      categoryId: "category-1",
      status: "preinscrito",
      statusReason: null,
      joinedAt: NOW,
      guardians: [],
      guardianIds: [],
      dataConsent: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(saved!.medical).toEqual({});
  });

  it("stores the document and its key", async () => {
    const result = await enroll.execute(
      baseInput({document: {type: "TI", number: "0012.345"}}),
    );
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved!.document).toEqual({type: "TI", number: "0012.345"});
    expect(saved!.documentKey).toBe("TI:12345");
  });

  it("stores the medical data", async () => {
    const result = await enroll.execute(
      baseInput({medical: {bloodType: "O+", allergies: "penicilina"}}),
    );
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved!.medical).toEqual({
      bloodType: "O+",
      allergies: "penicilina",
    });
  });

  it("trims the names", async () => {
    const result = await enroll.execute(
      baseInput({firstNames: "  Juan ", lastNames: " Pérez  "}),
    );
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved).toMatchObject({firstNames: "Juan", lastNames: "Pérez"});
  });

  it("records player.created in the audit log without sensitive data", async () => {
    const result = await enroll.execute(
      baseInput({
        document: {type: "TI", number: "123"},
        medical: {allergies: "penicilina"},
        device: {userAgent: "test"},
      }),
    );
    expect(auditLog.entries).toHaveLength(1);
    const [entry] = auditLog.entries;
    expect(entry).toMatchObject({
      tenantId: "tenant-a",
      actorUid: "owner-1",
      actorRole: "owner",
      action: "player.created",
      target: {type: "player", id: result.playerId},
      before: {},
      device: {userAgent: "test"},
    });
    expect(entry.after).toMatchObject({
      groupId: "group-1",
      venueId: "venue-1",
      categoryId: "category-1",
      status: "preinscrito",
    });
    expect(JSON.stringify(entry)).not.toContain("penicilina");
    expect(JSON.stringify(entry)).not.toContain("TI:123");
  });
});

describe("EnrollPlayer — permissions", () => {
  it("lets an accountant enroll in any venue", async () => {
    await memberships.save(member("acc-1", "accountant"));
    await expect(
      enroll.execute(baseInput({actorUid: "acc-1"})),
    ).resolves.toMatchObject({status: "preinscrito"});
  });

  it("lets a coordinator enroll in their venue", async () => {
    await memberships.save(
      member("coord-1", "coordinator", {
        scope: {venueIds: ["venue-1"], groupIds: [], playerIds: []},
      }),
    );
    await expect(
      enroll.execute(baseInput({actorUid: "coord-1"})),
    ).resolves.toMatchObject({status: "preinscrito"});
  });

  it("denies a coordinator a group of another venue", async () => {
    await memberships.save(
      member("coord-1", "coordinator", {
        scope: {venueIds: ["venue-2"], groupIds: [], playerIds: []},
      }),
    );
    const error = await failure(
      enroll.execute(baseInput({actorUid: "coord-1"})),
    );
    expect(error.code).toBe("permission_denied");
    expect(await uow.players.listByGuardian("tenant-a", "x")).toEqual([]);
  });

  it("denies a coordinator with an empty scope", async () => {
    await memberships.save(member("coord-1", "coordinator"));
    const error = await failure(
      enroll.execute(baseInput({actorUid: "coord-1"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it.each(["teacher", "guardian", "adultPlayer"] as const)(
    "denies the %s role",
    async (role) => {
      await memberships.save(
        member("u-1", role, {
          scope: {venueIds: ["venue-1"], groupIds: ["group-1"], playerIds: []},
        }),
      );
      const error = await failure(enroll.execute(baseInput({actorUid: "u-1"})));
      expect(error.code).toBe("permission_denied");
    },
  );

  it("denies an inactive member", async () => {
    await memberships.save(member("owner-2", "owner", {status: "inactive"}));
    const error = await failure(
      enroll.execute(baseInput({actorUid: "owner-2"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("denies a user with no membership in the tenant", async () => {
    const error = await failure(
      enroll.execute(baseInput({actorUid: "nobody"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("denies the owner of another organization", async () => {
    await memberships.save(member("owner-b", "owner", {tenantId: "tenant-b"}));
    const error = await failure(
      enroll.execute(baseInput({actorUid: "owner-b"})),
    );
    expect(error.code).toBe("permission_denied");
  });

  it("makes no changes when permission is denied", async () => {
    await memberships.save(member("u-1", "teacher"));
    await failure(enroll.execute(baseInput({actorUid: "u-1"})));
    expect(auditLog.entries).toHaveLength(0);
  });
});

describe("EnrollPlayer — group", () => {
  it("fails with not_found when the group does not exist", async () => {
    const error = await failure(
      enroll.execute(baseInput({groupId: "missing"})),
    );
    expect(error.code).toBe("not_found");
  });

  it("fails with not_found for a group of another organization", async () => {
    await uow.groups.save(group({id: "group-b", tenantId: "tenant-b"}));
    const error = await failure(
      enroll.execute(baseInput({groupId: "group-b"})),
    );
    expect(error.code).toBe("not_found");
  });

  it("fails with a precondition error when the group is closed", async () => {
    await uow.groups.save(group({status: "closed"}));
    const error = await failure(enroll.execute(baseInput()));
    expect(error.code).toBe("failed_precondition");
  });
});

describe("EnrollPlayer — guardians", () => {
  it("links an existing guardian and copies their full name", async () => {
    await uow.guardians.save(buildGuardian());
    const result = await enroll.execute(
      baseInput({
        guardians: [
          {
            guardianId: "guardian-1",
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
      }),
    );
    expect(result.createdGuardianIds).toEqual([]);
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved!.guardians).toEqual([
      {
        guardianId: "guardian-1",
        fullName: "Ana Perez",
        relationship: "madre",
        isPaymentResponsible: true,
      },
    ]);
    expect(saved!.guardianIds).toEqual(["guardian-1"]);
  });

  it("creates a new guardian in the same call and links them", async () => {
    const result = await enroll.execute(
      baseInput({
        guardians: [
          {
            guardian: newGuardian,
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
      }),
    );
    expect(result.createdGuardianIds).toHaveLength(1);
    const [guardianId] = result.createdGuardianIds;
    const guardian = await uow.guardians.get("tenant-a", guardianId);
    expect(guardian).toMatchObject({
      tenantId: "tenant-a",
      firstNames: "Ana",
      lastNames: "Gómez",
      document: {type: "CC", number: "1.020.304"},
      documentKey: "CC:1020304",
      phone: "3001112233",
      email: "ana@example.com",
      preferredContact: "whatsapp",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved!.guardianIds).toEqual([guardianId]);
    expect(saved!.guardians[0].fullName).toBe("Ana Gómez");
  });

  it("stores a missing email as null", async () => {
    const withoutEmail = {...newGuardian, email: undefined};
    const result = await enroll.execute(
      baseInput({
        guardians: [
          {
            guardian: withoutEmail,
            relationship: "madre",
            isPaymentResponsible: false,
          },
        ],
      }),
    );
    const guardian = await uow.guardians.get(
      "tenant-a",
      result.createdGuardianIds[0],
    );
    expect(guardian!.email).toBeNull();
  });

  it("mixes an existing and a new guardian", async () => {
    await uow.guardians.save(buildGuardian({id: "guardian-9"}));
    const result = await enroll.execute(
      baseInput({
        guardians: [
          {
            guardianId: "guardian-9",
            relationship: "padre",
            isPaymentResponsible: false,
          },
          {
            guardian: {...newGuardian, document: {type: "CC", number: "555"}},
            relationship: "abuela",
            isPaymentResponsible: true,
          },
        ],
      }),
    );
    const saved = await uow.players.get("tenant-a", result.playerId);
    expect(saved!.guardians).toHaveLength(2);
    expect(result.createdGuardianIds).toHaveLength(1);
  });

  it("records guardian.created for each new guardian", async () => {
    const result = await enroll.execute(
      baseInput({
        guardians: [
          {
            guardian: newGuardian,
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
      }),
    );
    const actions = auditLog.entries.map((entry) => entry.action).sort();
    expect(actions).toEqual(["guardian.created", "player.created"]);
    const created = auditLog.entries.find(
      (entry) => entry.action === "guardian.created",
    );
    expect(created!.target).toEqual({
      type: "guardian",
      id: result.createdGuardianIds[0],
    });
    expect(JSON.stringify(created)).not.toContain("1020304");
  });

  it("fails with not_found for an unknown guardian id", async () => {
    const error = await failure(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardianId: "missing",
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe("not_found");
  });

  it("fails with not_found for a guardian of another organization", async () => {
    await uow.guardians.save(
      buildGuardian({id: "guardian-b", tenantId: "tenant-b"}),
    );
    const error = await failure(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardianId: "guardian-b",
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe("not_found");
  });

  it("answers 409 with the guardian id when a new guardian's document exists", async () => {
    await uow.guardians.save(buildGuardian({id: "guardian-7"}));
    const error = await failure(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardian: {
                ...newGuardian,
                document: {type: "CC", number: "1020304"},
              },
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe("failed_precondition");
    expect(error.details).toEqual({guardianId: "guardian-7"});
  });

  it("rejects two new guardians with the same document", async () => {
    const error = await failure(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardian: newGuardian,
              relationship: "madre",
              isPaymentResponsible: true,
            },
            {
              guardian: {
                ...newGuardian,
                document: {type: "CC", number: "1020304"},
              },
              relationship: "tía",
              isPaymentResponsible: false,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("rejects the same existing guardian twice", async () => {
    await uow.guardians.save(buildGuardian());
    const link = {
      guardianId: "guardian-1",
      relationship: "madre",
      isPaymentResponsible: false,
    };
    const error = await failure(
      enroll.execute(baseInput({guardians: [link, link]})),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("rejects more than one payment responsible", async () => {
    await uow.guardians.save(buildGuardian());
    await uow.guardians.save(
      buildGuardian({id: "guardian-2", documentKey: "CC:2"}),
    );
    const error = await failure(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardianId: "guardian-1",
              relationship: "madre",
              isPaymentResponsible: true,
            },
            {
              guardianId: "guardian-2",
              relationship: "padre",
              isPaymentResponsible: true,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe("invalid_argument");
  });

  it("leaves no guardian behind when the transaction fails", async () => {
    auditLog.failWith = new Error("audit down");
    await expect(
      enroll.execute(
        baseInput({
          guardians: [
            {
              guardian: newGuardian,
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        }),
      ),
    ).rejects.toThrow("audit down");
    expect(
      await uow.guardians.findByDocumentKey("tenant-a", "CC:1020304"),
    ).toBeNull();
    expect(
      await uow.players.findByNameAndBirthDate(
        "tenant-a",
        "perez gomez juan camilo",
        "2014-05-01",
      ),
    ).toEqual([]);
  });
});

describe("EnrollPlayer — duplicates", () => {
  const withDocument = (number = "123") =>
    baseInput({document: {type: "TI", number}});

  it("answers 409 with the existing player id for a repeated document", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        document: {type: "TI", number: "123"},
        documentKey: "TI:123",
      }),
    );
    const error = await failure(enroll.execute(withDocument("0123")));
    expect(error.code).toBe("failed_precondition");
    expect(error.details).toEqual({playerId: "player-5"});
  });

  it("blocks a repeated document even with confirmDuplicate", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        document: {type: "TI", number: "123"},
        documentKey: "TI:123",
      }),
    );
    const error = await failure(
      enroll.execute({...withDocument(), confirmDuplicate: true}),
    );
    expect(error.details).toEqual({playerId: "player-5"});
  });

  it("does not clash with a document of another organization", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-b",
        tenantId: "tenant-b",
        document: {type: "TI", number: "123"},
        documentKey: "TI:123",
      }),
    );
    await expect(enroll.execute(withDocument())).resolves.toMatchObject({
      status: "preinscrito",
    });
  });

  it("does not clash with the same number of another document type", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        document: {type: "CC", number: "123"},
        documentKey: "CC:123",
      }),
    );
    await expect(enroll.execute(withDocument())).resolves.toMatchObject({
      status: "preinscrito",
    });
  });

  it("answers 409 with candidates for the same name and birth date", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        firstNames: "JUAN CAMILO",
        lastNames: "PEREZ GOMEZ",
        nameKey: "perez gomez juan camilo",
        birthDate: "2014-05-01",
        status: "activo",
      }),
    );
    const error = await failure(enroll.execute(baseInput()));
    expect(error.code).toBe("failed_precondition");
    expect(error.details).toEqual({
      duplicateCandidates: [
        {
          playerId: "player-5",
          firstNames: "JUAN CAMILO",
          lastNames: "PEREZ GOMEZ",
          birthDate: "2014-05-01",
          status: "activo",
        },
      ],
    });
    expect(auditLog.entries).toHaveLength(0);
  });

  it("creates the player when confirmDuplicate is true", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        nameKey: "perez gomez juan camilo",
        birthDate: "2014-05-01",
      }),
    );
    const result = await enroll.execute({
      ...baseInput(),
      confirmDuplicate: true,
    });
    expect(result.playerId).not.toBe("player-5");
    expect(await uow.players.get("tenant-a", result.playerId)).not.toBeNull();
  });

  it("does not warn when the birth date differs", async () => {
    await uow.players.save(
      buildPlayer({
        id: "player-5",
        nameKey: "perez gomez juan camilo",
        birthDate: "2013-05-01",
      }),
    );
    await expect(enroll.execute(baseInput())).resolves.toMatchObject({
      status: "preinscrito",
    });
  });
});

describe("EnrollPlayer — validation", () => {
  it.each([
    ["firstNames", {firstNames: "  "}],
    ["lastNames", {lastNames: ""}],
    ["birthDate", {birthDate: "2014-02-30"}],
    ["a future birthDate", {birthDate: "2026-10-05"}],
    [
      "emergencyContact.name",
      {emergencyContact: {name: " ", phone: "1", relationship: "x"}},
    ],
    [
      "emergencyContact.phone",
      {emergencyContact: {name: "A", phone: "", relationship: "x"}},
    ],
    [
      "a blank document number",
      {document: {type: "TI" as const, number: " . "}},
    ],
  ])("rejects %s", async (_label, overrides) => {
    const error = await failure(enroll.execute(baseInput(overrides)));
    expect(error.code).toBe("invalid_argument");
    expect(auditLog.entries).toHaveLength(0);
  });
});
