import {beforeEach, describe, expect, it} from "vitest";
import {
  buildGuardian,
  buildPlayer,
} from "../../application/testing/fixtures.js";
import {
  api,
  auditEntries,
  guardians,
  historyEntries,
  players,
  resetWorld,
  TENANT_PATH,
  type World,
} from "./testing/seed.js";

let world: World;

beforeEach(async () => {
  world = await resetWorld();
});

const P = `${TENANT_PATH}/players`;
const G = `${TENANT_PATH}/guardians`;

const newGuardianLink = (number = "555") => ({
  guardian: {
    firstNames: "Ana",
    lastNames: "Rojas",
    document: {type: "CC", number},
    phone: "300",
    email: "ana@example.com",
    preferredContact: "phone",
  },
  relationship: "madre",
  isPaymentResponsible: true,
});

const enrollBody = (overrides: Record<string, unknown> = {}) => ({
  firstNames: "Luis",
  lastNames: "Rojas",
  birthDate: "2013-02-03",
  groupId: "group-1",
  emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
  guardians: [newGuardianLink()],
  ...overrides,
});

describe("POST /players", () => {
  it("enrolls a pre-enrolled player and creates the guardian in one call", async () => {
    const {status, body} = await api("POST", P, world.owner, enrollBody());
    expect(status).toBe(201);
    expect(body).toMatchObject({status: "preinscrito"});
    expect(body.createdGuardianIds).toHaveLength(1);

    const player = await players.get("tenant-a", body.playerId);
    expect(player).toMatchObject({
      status: "preinscrito",
      groupId: "group-1",
      venueId: "venue-1",
      categoryId: "category-1",
      guardianIds: body.createdGuardianIds,
    });
    expect(
      await guardians.get("tenant-a", body.createdGuardianIds[0]),
    ).toMatchObject({
      documentKey: "CC:555",
    });
    const actions = (await auditEntries()).map((e) => e.action).sort();
    expect(actions).toEqual(["guardian.created", "player.created"]);
  });

  it("links an existing guardian by id", async () => {
    const {status, body} = await api(
      "POST",
      P,
      world.coordinator,
      enrollBody({
        document: {type: "TI", number: "99"},
        guardians: [
          {
            guardianId: "guardian-1",
            relationship: "tía",
            isPaymentResponsible: false,
          },
        ],
      }),
    );
    expect(status).toBe(201);
    expect(body.createdGuardianIds).toEqual([]);
    const player = await players.get("tenant-a", body.playerId);
    expect(player!.guardians[0]).toMatchObject({fullName: "Ana Perez"});
  });

  it("answers 409 with the player id for a repeated document", async () => {
    await players.save(
      buildPlayer({
        id: "player-7",
        document: {type: "TI", number: "99"},
        documentKey: "TI:99",
      }),
    );
    const {status, body} = await api(
      "POST",
      P,
      world.owner,
      enrollBody({
        document: {type: "TI", number: "0.99"},
        confirmDuplicate: true,
      }),
    );
    expect(status).toBe(409);
    expect(body.error.details).toEqual({playerId: "player-7"});
  });

  it("answers 409 with candidates for the same name and birth date, and accepts confirmDuplicate", async () => {
    await players.save(
      buildPlayer({
        id: "player-8",
        nameKey: "rojas luis",
        birthDate: "2013-02-03",
      }),
    );
    const refused = await api("POST", P, world.owner, enrollBody());
    expect(refused.status).toBe(409);
    expect(refused.body.error.details.duplicateCandidates).toEqual([
      expect.objectContaining({playerId: "player-8", birthDate: "2013-02-03"}),
    ]);
    const accepted = await api(
      "POST",
      P,
      world.owner,
      enrollBody({confirmDuplicate: true}),
    );
    expect(accepted.status).toBe(201);
  });

  it("answers 409 with the guardian id when a new guardian's document exists", async () => {
    const {status, body} = await api(
      "POST",
      P,
      world.owner,
      enrollBody({guardians: [newGuardianLink("1020304")]}),
    );
    expect(status).toBe(409);
    expect(body.error.details).toEqual({guardianId: "guardian-1"});
    expect(
      await players.findByNameAndBirthDate(
        "tenant-a",
        "rojas luis",
        "2013-02-03",
      ),
    ).toEqual([]);
  });

  it("leaves nothing behind when the group does not exist", async () => {
    const {status} = await api(
      "POST",
      P,
      world.owner,
      enrollBody({groupId: "missing"}),
    );
    expect(status).toBe(404);
    expect(await guardians.findByDocumentKey("tenant-a", "CC:555")).toBeNull();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("denies a coordinator a group of another venue", async () => {
    const {status} = await api(
      "POST",
      P,
      world.coordinator,
      enrollBody({groupId: "group-9"}),
    );
    expect(status).toBe(403);
    expect(await auditEntries()).toHaveLength(0);
  });
});

describe("status, consent and history", () => {
  const status = (caller: keyof World, body: unknown) =>
    api("PATCH", `${P}/player-1/status`, world[caller], body);

  it("refuses to activate without the consent, then activates after it", async () => {
    const refused = await status("coordinator", {status: "activo"});
    expect(refused.status).toBe(409);

    const consent = await api(
      "PUT",
      `${P}/player-1/consent`,
      world.coordinator,
      {
        guardianId: "guardian-1",
      },
    );
    expect(consent.status).toBe(200);
    expect(consent.body.dataConsent).toMatchObject({
      guardianId: "guardian-1",
      recordedBy: world.coordinator.uid,
    });

    const activated = await status("coordinator", {status: "activo"});
    expect(activated).toMatchObject({status: 200, body: {status: "activo"}});
  });

  it("refuses to activate without a payment responsible", async () => {
    await players.save(
      buildPlayer({
        guardians: [
          {
            guardianId: "guardian-1",
            fullName: "Ana Perez",
            relationship: "madre",
            isPaymentResponsible: false,
          },
        ],
        guardianIds: ["guardian-1"],
        dataConsent: {
          guardianId: "guardian-1",
          recordedBy: "x",
          at: new Date(),
        },
      }),
    );
    expect((await status("owner", {status: "activo"})).status).toBe(409);
  });

  it("answers 409 for a transition that is not allowed and for no change", async () => {
    expect(
      (await status("owner", {status: "pausado", reason: "x"})).status,
    ).toBe(409);
    expect((await status("owner", {status: "preinscrito"})).status).toBe(409);
  });

  it("answers 409 when the consent guardian is not linked", async () => {
    const {status: code} = await api(
      "PUT",
      `${P}/player-1/consent`,
      world.owner,
      {
        guardianId: "someone-else",
      },
    );
    expect(code).toBe(409);
  });

  it("keeps the history across a withdrawal and a re-entry, newest first", async () => {
    await api("PUT", `${P}/player-1/consent`, world.owner, {
      guardianId: "guardian-1",
    });
    await status("owner", {status: "activo"});
    await status("owner", {status: "retirado", reason: "mudanza"});
    await status("owner", {status: "activo"});

    const {status: code, body} = await api(
      "GET",
      `${P}/player-1/history`,
      world.owner,
    );
    expect(code).toBe(200);
    expect(
      body.entries.map((e: {after: {status: string}}) => e.after.status),
    ).toEqual(["activo", "retirado", "activo"]);
    expect(body.entries[1].reason).toBe("mudanza");
    expect(typeof body.entries[0].at).toBe("string");
    const player = await players.get("tenant-a", "player-1");
    expect(player).toMatchObject({status: "activo", id: "player-1"});
  });

  it("writes the history and the audit log together", async () => {
    await api("PUT", `${P}/player-1/consent`, world.owner, {
      guardianId: "guardian-1",
    });
    await status("owner", {status: "activo"});
    expect(await historyEntries()).toHaveLength(1);
    expect((await auditEntries()).map((e) => e.action).sort()).toEqual([
      "player.consent_recorded",
      "player.status_changed",
    ]);
  });

  it("lets a teacher of the group read the history but not write", async () => {
    await status("owner", {status: "retirado", reason: "x"});
    const read = await api("GET", `${P}/player-1/history`, world.teacher);
    expect(read.status).toBe(200);
    expect((await status("teacher", {status: "preinscrito"})).status).toBe(403);
  });
});

describe("PUT placement", () => {
  const move = (caller: keyof World, groupId: string) =>
    api("PUT", `${P}/player-1/placement`, world[caller], {
      groupId,
      reason: "sube",
    });

  it("moves the player and copies the venue and category", async () => {
    const {status, body} = await move("coordinator", "group-2");
    expect(status).toBe(200);
    expect(body).toEqual({
      playerId: "player-1",
      groupId: "group-2",
      venueId: "venue-1",
      categoryId: "category-2",
    });
    const [entry] = await historyEntries();
    expect(entry).toMatchObject({type: "placement", reason: "sube"});
    expect((await auditEntries()).map((e) => e.action)).toEqual([
      "player.placement_changed",
    ]);
  });

  it("denies a coordinator a destination in another venue, without changes", async () => {
    expect((await move("coordinator", "group-9")).status).toBe(403);
    expect((await players.get("tenant-a", "player-1"))!.groupId).toBe(
      "group-1",
    );
    expect(await historyEntries()).toHaveLength(0);
  });

  it("lets the owner move a player to another venue", async () => {
    const {body} = await move("owner", "group-9");
    expect(body.venueId).toBe("venue-2");
  });

  it("answers 409 for the same group and 404 for an unknown one", async () => {
    expect((await move("owner", "group-1")).status).toBe(409);
    expect((await move("owner", "missing")).status).toBe(404);
  });
});

describe("PUT player and guardians", () => {
  it("updates the personal data", async () => {
    const {status, body} = await api("PUT", `${P}/player-1`, world.accountant, {
      firstNames: "Juan Camilo",
      lastNames: "Perez",
      birthDate: "2014-05-01",
      document: {type: "TI", number: "1.234"},
      emergencyContact: {name: "Luis", phone: "311", relationship: "padre"},
      medical: {allergies: "penicilina"},
    });
    expect(status).toBe(200);
    expect(body).toEqual({playerId: "player-1"});
    expect(await players.get("tenant-a", "player-1")).toMatchObject({
      firstNames: "Juan Camilo",
      documentKey: "TI:1234",
      medical: {allergies: "penicilina"},
    });
  });

  it("replaces the guardians and answers 409 if it leaves an active player without a responsible", async () => {
    await players.save(
      buildPlayer({
        status: "activo",
        guardians: [
          {
            guardianId: "guardian-1",
            fullName: "Ana Perez",
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
        guardianIds: ["guardian-1"],
      }),
    );
    const refused = await api("PUT", `${P}/player-1/guardians`, world.owner, {
      guardians: [
        {
          guardianId: "guardian-1",
          relationship: "madre",
          isPaymentResponsible: false,
        },
      ],
    });
    expect(refused.status).toBe(409);

    const accepted = await api("PUT", `${P}/player-1/guardians`, world.owner, {
      guardians: [
        {
          guardianId: "guardian-1",
          relationship: "madre",
          isPaymentResponsible: false,
        },
        newGuardianLink("777"),
      ],
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.createdGuardianIds).toHaveLength(1);
  });

  it("propagates a guardian's new name to every linked player", async () => {
    await players.save(
      buildPlayer({
        id: "player-2",
        venueId: "venue-2",
        groupId: "group-9",
        guardians: [
          {
            guardianId: "guardian-1",
            fullName: "Ana Perez",
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
        guardianIds: ["guardian-1"],
      }),
    );
    const {status} = await api("PUT", `${G}/guardian-1`, world.owner, {
      firstNames: "Ana María",
      lastNames: "Perez",
      document: {type: "CC", number: "1020304"},
      phone: "3001112233",
      preferredContact: "email",
      email: "ana@example.com",
    });
    expect(status).toBe(200);
    for (const id of ["player-1", "player-2"]) {
      const player = await players.get("tenant-a", id);
      expect(player!.guardians[0].fullName).toBe("Ana María Perez");
    }
    expect((await auditEntries()).map((e) => e.action)).toEqual([
      "guardian.updated",
    ]);
  });

  it("answers 409 with the guardian id for a document that another guardian has", async () => {
    await guardians.save(
      buildGuardian({id: "guardian-2", documentKey: "CC:7"}),
    );
    const {status, body} = await api("PUT", `${G}/guardian-1`, world.owner, {
      firstNames: "Ana",
      lastNames: "Perez",
      document: {type: "CC", number: "7"},
      phone: "3",
      preferredContact: "phone",
    });
    expect(status).toBe(409);
    expect(body.error.details).toEqual({guardianId: "guardian-2"});
  });
});

describe("GET /guardians", () => {
  const find = (caller: keyof World, number = "1.020.304") =>
    api("GET", `${G}?documentType=CC&documentNumber=${number}`, world[caller]);

  it("finds a guardian by document and never exposes the internal key", async () => {
    const {status, body} = await find("owner");
    expect(status).toBe(200);
    expect(body.guardian).toMatchObject({
      id: "guardian-1",
      firstNames: "Ana",
      document: {type: "CC", number: "1020304"},
      phone: "3001112233",
      preferredContact: "whatsapp",
    });
    expect(body.guardian).not.toHaveProperty("documentKey");
  });

  it("answers null when no guardian has that document", async () => {
    expect((await find("owner", "999")).body).toEqual({guardian: null});
  });

  it("answers null to a coordinator without a player of the guardian", async () => {
    expect((await find("coordinatorOther")).body).toEqual({guardian: null});
    expect((await find("coordinator")).body.guardian.id).toBe("guardian-1");
  });
});

describe("GET /players and /players/search-index", () => {
  beforeEach(async () => {
    for (const [n, venueId, groupId] of [
      [2, "venue-1", "group-1"],
      [3, "venue-1", "group-2"],
      [4, "venue-2", "group-9"],
      [5, "venue-1", "group-1"],
    ] as const) {
      await players.save(
        buildPlayer({
          id: `player-${n}`,
          nameKey: `apellido ${n} nombre`,
          lastNames: `Apellido ${n}`,
          venueId,
          groupId,
          document: {type: "TI", number: `${n}00`},
          documentKey: `TI:${n}00`,
        }),
      );
    }
  });

  const ids = (body: {players: {id: string}[]}) =>
    body.players.map((p) => p.id);

  it("pages by cursor in name order, without repeats or gaps", async () => {
    const first = await api("GET", `${P}?limit=2`, world.owner);
    expect(first.status).toBe(200);
    expect(ids(first.body)).toEqual(["player-2", "player-3"]);
    const second = await api(
      "GET",
      `${P}?limit=2&cursor=${first.body.nextCursor}`,
      world.owner,
    );
    expect(ids(second.body)).toEqual(["player-4", "player-5"]);
    const third = await api(
      "GET",
      `${P}?limit=2&cursor=${second.body.nextCursor}`,
      world.owner,
    );
    expect(ids(third.body)).toEqual(["player-1"]);
    expect(third.body.nextCursor).toBeNull();
  });

  it("filters by one location and by status", async () => {
    const byVenue = await api("GET", `${P}?venueId=venue-2`, world.owner);
    expect(ids(byVenue.body)).toEqual(["player-4"]);
    const byGroup = await api(
      "GET",
      `${P}?groupId=group-1&status=preinscrito`,
      world.owner,
    );
    expect(ids(byGroup.body)).toEqual(["player-2", "player-5", "player-1"]);
  });

  it("limits a coordinator to their venues and denies a filter outside them", async () => {
    const mine = await api("GET", P, world.coordinator);
    expect(ids(mine.body)).toEqual([
      "player-2",
      "player-3",
      "player-5",
      "player-1",
    ]);
    expect(
      (await api("GET", `${P}?venueId=venue-2`, world.coordinator)).status,
    ).toBe(403);
  });

  it("limits a teacher to their groups and returns no document", async () => {
    const {status, body} = await api("GET", P, world.teacher);
    expect(status).toBe(200);
    expect(ids(body)).toEqual(["player-2", "player-5", "player-1"]);
    for (const summary of body.players) {
      expect(summary).not.toHaveProperty("document");
      expect(summary).not.toHaveProperty("documentKey");
      expect(summary).not.toHaveProperty("guardians");
    }
    expect(
      (await api("GET", `${P}?groupId=group-2`, world.teacher)).status,
    ).toBe(403);
  });

  it("returns the light index of every visible player", async () => {
    const {status, body} = await api("GET", `${P}/search-index`, world.owner);
    expect(status).toBe(200);
    expect(body.entries).toHaveLength(5);
    expect(body.entries.find((e: {id: string}) => e.id === "player-1")).toEqual(
      {
        id: "player-1",
        fullName: "Juan Perez",
        guardianNames: ["Ana Perez"],
        status: "preinscrito",
        groupId: "group-1",
      },
    );
    expect(
      body.entries.find((e: {id: string}) => e.id === "player-2"),
    ).toMatchObject({
      documentNumber: "200",
    });
  });

  it("gives a teacher the index without document or guardian names", async () => {
    const {body} = await api("GET", `${P}/search-index`, world.teacher);
    expect(body.entries.map((e: {id: string}) => e.id)).toEqual([
      "player-2",
      "player-5",
      "player-1",
    ]);
    for (const entry of body.entries) {
      expect(entry).not.toHaveProperty("documentNumber");
      expect(entry).not.toHaveProperty("guardianNames");
    }
  });
});

describe("GET /players/:playerId", () => {
  beforeEach(async () => {
    await players.save(
      buildPlayer({
        document: {type: "TI", number: "123"},
        documentKey: "TI:123",
        medical: {allergies: "penicilina"},
        guardians: [
          {
            guardianId: "guardian-1",
            fullName: "Ana Perez",
            relationship: "madre",
            isPaymentResponsible: true,
          },
        ],
        guardianIds: ["guardian-1"],
        dataConsent: {
          guardianId: "guardian-1",
          recordedBy: "staff",
          at: new Date("2026-10-04T12:00:00Z"),
        },
      }),
    );
  });

  it("returns the full record to the staff, with ISO dates and no internal keys", async () => {
    const {status, body} = await api("GET", `${P}/player-1`, world.coordinator);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: "player-1",
      firstNames: "Juan",
      document: {type: "TI", number: "123"},
      birthDate: "2014-05-01",
      groupId: "group-1",
      venueId: "venue-1",
      categoryId: "category-1",
      status: "preinscrito",
      medical: {allergies: "penicilina"},
      guardians: [
        {
          guardianId: "guardian-1",
          fullName: "Ana Perez",
          relationship: "madre",
          isPaymentResponsible: true,
        },
      ],
      dataConsent: {
        guardianId: "guardian-1",
        recordedBy: "staff",
        at: "2026-10-04T12:00:00.000Z",
      },
    });
    expect(body).not.toHaveProperty("nameKey");
    expect(body).not.toHaveProperty("documentKey");
    expect(body).not.toHaveProperty("guardianIds");
    expect(body).not.toHaveProperty("tenantId");
  });

  it("returns the teacher a record without document, guardians or consent", async () => {
    const {status, body} = await api("GET", `${P}/player-1`, world.teacher);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: "player-1",
      medical: {allergies: "penicilina"},
    });
    expect(body).not.toHaveProperty("document");
    expect(body).not.toHaveProperty("guardians");
    expect(body).not.toHaveProperty("dataConsent");
  });

  it("answers 403 to a teacher of another group and 404 for a missing player", async () => {
    expect((await api("GET", `${P}/player-1`, world.teacherOther)).status).toBe(
      403,
    );
    expect((await api("GET", `${P}/missing`, world.owner)).status).toBe(404);
  });
});
