import {beforeEach, describe, expect, it} from "vitest";
import {FirestoreMembershipRepository} from "../../../../../src/membership/infrastructure/firestore/firestore-membership-repository.js";
import {buildMember} from "../../../../../src/player/application/testing/fixtures.js";
import {
  api,
  auditEntries,
  db,
  historyEntries,
  players,
  resetWorld,
  TENANT_PATH,
  type Caller,
  type Method,
  type World,
} from "../../../../../src/player/infrastructure/http/testing/seed.js";

// Every route answers the same way to a caller without a token, to a user of
// another organization, to a role that may not use it and to a malformed
// request (spec 06, acceptance criteria).

let world: World;

beforeEach(async () => {
  world = await resetWorld();
});

const P = `${TENANT_PATH}/players`;
const G = `${TENANT_PATH}/guardians`;

const enrollBody = () => ({
  firstNames: "Luis",
  lastNames: "Rojas",
  birthDate: "2013-02-03",
  groupId: "group-1",
  emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
  guardians: [
    {
      guardian: {
        firstNames: "Ana",
        lastNames: "Rojas",
        document: {type: "CC", number: "555"},
        phone: "300",
        preferredContact: "phone",
      },
      relationship: "madre",
      isPaymentResponsible: true,
    },
  ],
});

const personalBody = () => ({
  firstNames: "Juan",
  lastNames: "Perez",
  birthDate: "2014-05-01",
  emergencyContact: {name: "Ana", phone: "300", relationship: "madre"},
});

const guardianBody = () => ({
  firstNames: "Ana",
  lastNames: "Perez",
  document: {type: "CC", number: "1020304"},
  phone: "3001112233",
  preferredContact: "whatsapp",
});

const WRITERS_DENIED: Caller[] = [
  "teacher",
  "teacherOther",
  "guardian",
  "adultPlayer",
  "coordinatorOther",
];
const READERS_DENIED: Caller[] = ["guardian", "adultPlayer"];
const RECORD_READERS_DENIED: Caller[] = [
  "guardian",
  "adultPlayer",
  "coordinatorOther",
  "teacherOther",
];

type Route = {
  name: string;
  method: Method;
  path: string;
  body?: () => unknown;
  denied: Caller[];
  // Requests the schema or the use case must refuse with 400.
  invalid: [string, string, unknown?][];
};

const ROUTES: Route[] = [
  {
    name: "POST /players",
    method: "POST",
    path: P,
    body: enrollBody,
    denied: [
      "teacher",
      "teacherOther",
      "guardian",
      "adultPlayer",
      "coordinatorOther",
    ],
    invalid: [
      ["missing birthDate", P, {...enrollBody(), birthDate: undefined}],
      ["non-string firstNames", P, {...enrollBody(), firstNames: 7}],
      [
        "document type out of range",
        P,
        {...enrollBody(), document: {type: "XX", number: "1"}},
      ],
      [
        "name over the length limit",
        P,
        {...enrollBody(), lastNames: "x".repeat(101)},
      ],
      [
        "more guardians than allowed",
        P,
        {
          ...enrollBody(),
          guardians: Array.from({length: 11}, () => enrollBody().guardians[0]),
        },
      ],
      [
        "a link with both guardianId and guardian",
        P,
        {
          ...enrollBody(),
          guardians: [{guardianId: "g", ...enrollBody().guardians[0]}],
        },
      ],
      ["unexpected field", P, {...enrollBody(), status: "activo"}],
      [
        "birthDate that does not exist",
        P,
        {...enrollBody(), birthDate: "2013-02-30"},
      ],
    ],
  },
  {
    name: "GET /players",
    method: "GET",
    path: P,
    denied: READERS_DENIED,
    invalid: [
      ["limit that is not a number", `${P}?limit=abc`],
      ["limit out of range", `${P}?limit=101`],
      ["limit of zero", `${P}?limit=0`],
      ["status out of range", `${P}?status=en%20mora`],
      ["an invalid cursor", `${P}?cursor=garbage`],
      ["two location filters", `${P}?venueId=venue-1&groupId=group-1`],
      ["an unexpected parameter", `${P}?foo=1`],
      ["a repeated parameter", `${P}?status=activo&status=pausado`],
    ],
  },
  {
    name: "GET /players/search-index",
    method: "GET",
    path: `${P}/search-index`,
    denied: READERS_DENIED,
    invalid: [["an unexpected parameter", `${P}/search-index?foo=1`]],
  },
  {
    name: "GET /players/:playerId",
    method: "GET",
    path: `${P}/player-1`,
    denied: RECORD_READERS_DENIED,
    invalid: [["an unexpected parameter", `${P}/player-1?foo=1`]],
  },
  {
    name: "PUT /players/:playerId",
    method: "PUT",
    path: `${P}/player-1`,
    body: personalBody,
    denied: WRITERS_DENIED,
    invalid: [
      [
        "missing lastNames",
        `${P}/player-1`,
        {...personalBody(), lastNames: undefined},
      ],
      [
        "emergency phone missing",
        `${P}/player-1`,
        {...personalBody(), emergencyContact: {name: "A", relationship: "x"}},
      ],
      [
        "a medical field over the limit",
        `${P}/player-1`,
        {...personalBody(), medical: {notes: "x".repeat(501)}},
      ],
      [
        "an unexpected medical field",
        `${P}/player-1`,
        {...personalBody(), medical: {height: "180"}},
      ],
      [
        "unexpected field",
        `${P}/player-1`,
        {...personalBody(), groupId: "group-2"},
      ],
    ],
  },
  {
    name: "PUT /players/:playerId/placement",
    method: "PUT",
    path: `${P}/player-1/placement`,
    body: () => ({groupId: "group-2"}),
    denied: WRITERS_DENIED,
    invalid: [
      ["missing groupId", `${P}/player-1/placement`, {}],
      ["empty groupId", `${P}/player-1/placement`, {groupId: ""}],
      [
        "non-string reason",
        `${P}/player-1/placement`,
        {groupId: "group-2", reason: 7},
      ],
      [
        "reason over the limit",
        `${P}/player-1/placement`,
        {groupId: "group-2", reason: "x".repeat(501)},
      ],
      [
        "unexpected field",
        `${P}/player-1/placement`,
        {groupId: "group-2", venueId: "venue-1"},
      ],
    ],
  },
  {
    name: "PATCH /players/:playerId/status",
    method: "PATCH",
    path: `${P}/player-1/status`,
    body: () => ({status: "retirado", reason: "mudanza"}),
    denied: WRITERS_DENIED,
    invalid: [
      ["missing status", `${P}/player-1/status`, {}],
      ["status out of range", `${P}/player-1/status`, {status: "en mora"}],
      [
        "non-string reason",
        `${P}/player-1/status`,
        {status: "pausado", reason: 7},
      ],
      [
        "a reason required and missing",
        `${P}/player-1/status`,
        {status: "retirado"},
      ],
      [
        "unexpected field",
        `${P}/player-1/status`,
        {status: "activo", playerId: "x"},
      ],
    ],
  },
  {
    name: "PUT /players/:playerId/guardians",
    method: "PUT",
    path: `${P}/player-1/guardians`,
    body: () => ({
      guardians: [
        {
          guardianId: "guardian-1",
          relationship: "madre",
          isPaymentResponsible: true,
        },
      ],
    }),
    denied: WRITERS_DENIED,
    invalid: [
      ["missing guardians", `${P}/player-1/guardians`, {}],
      [
        "guardians that is not a list",
        `${P}/player-1/guardians`,
        {guardians: "g"},
      ],
      [
        "a link without relationship",
        `${P}/player-1/guardians`,
        {guardians: [{guardianId: "g", isPaymentResponsible: true}]},
      ],
      [
        "more guardians than allowed",
        `${P}/player-1/guardians`,
        {
          guardians: Array.from({length: 11}, (_, n) => ({
            guardianId: `g${n}`,
            relationship: "x",
            isPaymentResponsible: false,
          })),
        },
      ],
      [
        "unexpected field",
        `${P}/player-1/guardians`,
        {guardians: [], extra: 1},
      ],
    ],
  },
  {
    name: "PUT /players/:playerId/consent",
    method: "PUT",
    path: `${P}/player-1/consent`,
    body: () => ({guardianId: "guardian-1"}),
    denied: WRITERS_DENIED,
    invalid: [
      ["missing guardianId", `${P}/player-1/consent`, {}],
      ["empty guardianId", `${P}/player-1/consent`, {guardianId: ""}],
      [
        "unexpected field",
        `${P}/player-1/consent`,
        {guardianId: "guardian-1", at: "now"},
      ],
    ],
  },
  {
    name: "GET /players/:playerId/history",
    method: "GET",
    path: `${P}/player-1/history`,
    denied: RECORD_READERS_DENIED,
    invalid: [["an unexpected parameter", `${P}/player-1/history?foo=1`]],
  },
  {
    name: "GET /guardians",
    method: "GET",
    path: `${G}?documentType=CC&documentNumber=1020304`,
    denied: ["teacher", "teacherOther", "guardian", "adultPlayer"],
    invalid: [
      ["missing documentNumber", `${G}?documentType=CC`],
      ["missing documentType", `${G}?documentNumber=1`],
      ["document type out of range", `${G}?documentType=XX&documentNumber=1`],
      ["empty documentNumber", `${G}?documentType=CC&documentNumber=`],
      [
        "an unexpected parameter",
        `${G}?documentType=CC&documentNumber=1&foo=1`,
      ],
    ],
  },
  {
    name: "PUT /guardians/:guardianId",
    method: "PUT",
    path: `${G}/guardian-1`,
    body: guardianBody,
    denied: [
      "teacher",
      "teacherOther",
      "guardian",
      "adultPlayer",
      "coordinatorOther",
    ],
    invalid: [
      [
        "missing phone",
        `${G}/guardian-1`,
        {...guardianBody(), phone: undefined},
      ],
      [
        "an invalid email",
        `${G}/guardian-1`,
        {...guardianBody(), email: "not-an-email"},
      ],
      [
        "contact preference out of range",
        `${G}/guardian-1`,
        {...guardianBody(), preferredContact: "pigeon"},
      ],
      [
        "document type out of range",
        `${G}/guardian-1`,
        {...guardianBody(), document: {type: "XX", number: "1"}},
      ],
      ["unexpected field", `${G}/guardian-1`, {...guardianBody(), id: "x"}],
    ],
  },
];

const noChanges = async () => {
  expect(await auditEntries()).toHaveLength(0);
  expect(await historyEntries()).toHaveLength(0);
  expect((await players.get("tenant-a", "player-1"))!.status).toBe(
    "preinscrito",
  );
};

for (const route of ROUTES) {
  describe(route.name, () => {
    it("rejects a caller without a token", async () => {
      const {status, body} = await api(
        route.method,
        route.path,
        undefined,
        route.body?.(),
      );
      expect(status).toBe(401);
      expect(body.error.code).toBe("unauthenticated");
      await noChanges();
    });

    it("rejects an invalid token", async () => {
      const {status} = await api(
        route.method,
        route.path,
        {
          uid: "x",
          idToken: "not-a-token",
        },
        route.body?.(),
      );
      expect(status).toBe(401);
    });

    it("denies an owner of another organization, without changes", async () => {
      const {status, body} = await api(
        route.method,
        route.path,
        world.ownerB,
        route.body?.(),
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe("permission_denied");
      await noChanges();
    });

    it.each(route.denied)("denies %s, without changes", async (caller) => {
      const {status, body} = await api(
        route.method,
        route.path,
        world[caller],
        route.body?.(),
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe("permission_denied");
      await noChanges();
    });

    it("denies an owner right after being deactivated, same token", async () => {
      await new FirestoreMembershipRepository(db).save(
        buildMember(world.owner.uid, "owner", {}, {status: "inactive"}),
      );
      const {status} = await api(
        route.method,
        route.path,
        world.owner,
        route.body?.(),
      );
      expect(status).toBe(403);
      await noChanges();
    });

    it.each(route.invalid)("answers 400 for %s", async (_label, path, body) => {
      const {status, body: response} = await api(
        route.method,
        path,
        world.owner,
        body,
      );
      expect(status).toBe(400);
      expect(response.error.code).toBe("invalid_argument");
      await noChanges();
    });
  });
}

describe("an unknown route", () => {
  it("answers 404", async () => {
    const {status} = await api("GET", `${TENANT_PATH}/nope`, world.owner);
    expect(status).toBe(404);
  });
});
