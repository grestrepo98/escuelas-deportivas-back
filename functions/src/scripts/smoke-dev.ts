import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  parseSeedArgs,
  SEED_CATEGORIES,
  SEED_GROUPS,
  SEED_USERS,
  SEED_VENUES,
  type SeedUser,
} from "./seed-lib.js";

// End-to-end smoke test of the deployed module APIs (specs 01, 02 and 04).
// It signs in as seeded users and calls the real functions over HTTPS.
//
//   SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev
//   npm run smoke:emulator            (verifies this script itself, locally)
//
// Run `seed` against the same target first.

type CallResult = {status: number; body: any}; // eslint-disable-line

const userOf = (role: SeedUser["role"], tenantId: string): SeedUser => {
  const user = SEED_USERS.find(
    (u) => u.role === role && u.tenantId === tenantId,
  );
  if (!user) throw new Error(`No seed user for ${role} in ${tenantId}`);
  return user;
};

async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2), process.env);
  const isEmulator = args.target === "emulator";

  const apiKey = isEmulator ? "fake" : process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "--target dev needs FIREBASE_API_KEY (the dev project's " +
        "Web API key, used only to sign in the seed users)",
    );
  }
  const authBase = isEmulator
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";
  // `api` is the function name (membershipApi, tenantApi, structureApi).
  const apiUrl = (api: string, path: string) =>
    isEmulator
      ? `http://127.0.0.1:5001/${args.projectId}/us-central1/${api}${path}`
      : `https://us-central1-${args.projectId}.cloudfunctions.net/${api}${path}`;

  const signIn = async (user: SeedUser): Promise<string> => {
    const response = await fetch(
      `${authBase}/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          email: user.email,
          password: args.password,
          returnSecureToken: true,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Sign-in failed for ${user.email} (${response.status}). ` +
          "Was the seed run against this target with this password?",
      );
    }
    return ((await response.json()) as {idToken: string}).idToken;
  };

  const call = async (
    api: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    data?: unknown,
    token?: string,
  ): Promise<CallResult> => {
    const response = await fetch(apiUrl(api, path), {
      method,
      headers: {
        ...(data !== undefined && {"Content-Type": "application/json"}),
        ...(token && {Authorization: `Bearer ${token}`}),
      },
      ...(data !== undefined && {body: JSON.stringify(data)}),
    });
    return {status: response.status, body: await response.json()};
  };
  const changeRole = (
    token: string,
    uid: string,
    newRole: string,
    reason?: string,
  ) =>
    call(
      "membershipApi",
      "PATCH",
      `/tenants/tenant-a/memberships/${uid}/role`,
      {newRole, reason},
      token,
    );

  const app = initializeApp({projectId: args.projectId});
  const db = getFirestore(app);

  const ownerA = userOf("owner", "tenant-a");
  const coordinatorA = userOf("coordinator", "tenant-a");
  const ownerB = userOf("owner", "tenant-b");
  const [tokenA, tokenB] = await Promise.all([signIn(ownerA), signIn(ownerB)]);

  let failures = 0;
  const check = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      console.log(`PASS  ${name}`);
    } catch (error) {
      failures++;
      console.log(`FAIL  ${name}\n      ${(error as Error).message}`);
    }
  };
  const expectEqual = (actual: unknown, expected: unknown, what: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `${what}: expected ${JSON.stringify(expected)}, ` +
          `got ${JSON.stringify(actual)}`,
      );
    }
  };

  console.log(`Smoke test on "${args.target}" (project ${args.projectId})\n`);

  const listMine = (token?: string) =>
    call("membershipApi", "GET", "/me/memberships", undefined, token);

  await check(
    "a call without a token is rejected as unauthenticated",
    async () => {
      const {status, body} = await listMine();
      expectEqual(
        [status, body.error?.code],
        [401, "unauthenticated"],
        "status",
      );
    },
  );

  await check("GET /me/memberships answers for a seed user", async () => {
    const {status, body} = await listMine(tokenA);
    expectEqual(status, 200, "status");
    const mine = body.memberships.find(
      (m: {tenantId: string}) => m.tenantId === "tenant-a",
    );
    expectEqual(
      [mine?.role, mine?.tenantName],
      ["owner", "Escuela A (seed)"],
      "tenant-a membership",
    );
  });

  await check("a tenant-b user does not see tenant-a", async () => {
    const {body} = await listMine(tokenB);
    expectEqual(
      body.memberships.map((m: {tenantId: string}) => m.tenantId),
      ["tenant-b"],
      "visible tenants",
    );
  });

  await check("a tenant-b owner cannot change roles in tenant-a", async () => {
    const {status, body} = await changeRole(
      tokenB,
      coordinatorA.uid,
      "teacher",
    );
    expectEqual(
      [status, body.error?.code],
      [403, "permission_denied"],
      "status",
    );
  });

  await check("a role change leaves its entry in the audit log", async () => {
    const membershipRef = db.doc(`memberships/${coordinatorA.uid}_tenant-a`);
    const before = (await membershipRef.get()).data()?.role;
    expectEqual(
      before,
      "coordinator",
      "baseline role (run the seed to restore it)",
    );

    const reason = `smoke-${Date.now()}`;
    try {
      const {status, body} = await changeRole(
        tokenA,
        coordinatorA.uid,
        "teacher",
        reason,
      );
      expectEqual([status, body.role], [200, "teacher"], "response");

      const entries = await db
        .collection("tenants/tenant-a/auditLog")
        .where("reason", "==", reason)
        .get();
      expectEqual(entries.size, 1, "audit entries for this change");
      const entry = entries.docs[0].data();
      expectEqual(
        [
          entry.before?.role,
          entry.after?.role,
          entry.actorUid,
          entry.at !== undefined,
        ],
        ["coordinator", "teacher", ownerA.uid, true],
        "audit entry",
      );
    } finally {
      // Put the baseline back (this adds a second, honest audit entry).
      await changeRole(
        tokenA,
        coordinatorA.uid,
        "coordinator",
        `${reason}-restore`,
      );
    }
    expectEqual(
      (await membershipRef.get()).data()?.role,
      "coordinator",
      "role after restore",
    );
  });

  // Spec 02: organization structure.
  type Dto = {id: string};
  const idsOf = (items: Dto[]) => items.map((i) => i.id).sort();
  const sorted = (items: string[]) => [...items].sort();
  const structureOf = async (token: string, query = "") =>
    call(
      "structureApi",
      "GET",
      `/tenants/tenant-a/structure${query}`,
      undefined,
      token,
    );
  const saveVenue = (token: string, data: object) =>
    call("structureApi", "POST", "/tenants/tenant-a/venues", data, token);

  const teacherA = userOf("teacher", "tenant-a");
  const guardianA = userOf("guardian", "tenant-a");
  const coordinatorVenueId = coordinatorA.scope.venueIds[0];
  const teacherGroup = SEED_GROUPS.find(
    (g) => g.id === teacherA.scope.groupIds[0],
  )!;
  const seedIds = (items: {id: string; tenantId: string}[]) =>
    items.filter((i) => i.tenantId === "tenant-a").map((i) => i.id);

  await check("the owner sees the seeded structure of tenant-a", async () => {
    const {status, body} = await structureOf(tokenA);
    expectEqual(status, 200, "status");
    for (const [kind, expected] of [
      ["venues", seedIds(SEED_VENUES)],
      ["categories", seedIds(SEED_CATEGORIES)],
      ["groups", seedIds(SEED_GROUPS)],
    ] as const) {
      const got = idsOf(body[kind]);
      const missing = expected.filter((id) => !got.includes(id));
      expectEqual(missing, [], `seeded ${kind} missing from the owner view`);
    }
  });

  await check(
    "the seed coordinator sees only their venue and its groups",
    async () => {
      const token = await signIn(coordinatorA);
      const {status, body} = await structureOf(token);
      expectEqual(status, 200, "status");
      expectEqual(idsOf(body.venues), [coordinatorVenueId], "venues");
      const groups: {id: string; venueId: string}[] = body.groups;
      expectEqual(
        groups.every((g) => g.venueId === coordinatorVenueId),
        true,
        "every group belongs to the coordinator's venue",
      );
      const expected = SEED_GROUPS.filter(
        (g) => g.venueId === coordinatorVenueId,
      ).map((g) => g.id);
      expectEqual(
        expected.filter((id) => !idsOf(groups).includes(id)),
        [],
        "seeded groups of the coordinator's venue",
      );
      expectEqual(
        seedIds(SEED_CATEGORIES).filter(
          (id) => !idsOf(body.categories).includes(id),
        ),
        [],
        "seeded categories",
      );
    },
  );

  await check(
    "the seed teacher sees only their group, venue and category",
    async () => {
      const token = await signIn(teacherA);
      const {status, body} = await structureOf(token);
      expectEqual(status, 200, "status");
      expectEqual(idsOf(body.groups), [teacherGroup.id], "groups");
      expectEqual(idsOf(body.venues), [teacherGroup.venueId], "venues");
      expectEqual(
        idsOf(body.categories),
        [teacherGroup.categoryId],
        "categories",
      );
    },
  );

  await check("a guardian cannot read the structure", async () => {
    const token = await signIn(guardianA);
    const {status, body} = await structureOf(token);
    expectEqual(
      [status, body.error?.code],
      [403, "permission_denied"],
      "status",
    );
  });

  await check(
    "a tenant-b owner cannot read or write tenant-a structure",
    async () => {
      const read = await structureOf(tokenB);
      expectEqual(
        [read.status, read.body.error?.code],
        [403, "permission_denied"],
        "read",
      );
      const write = await saveVenue(tokenB, {name: "Intruso", address: "x"});
      expectEqual(
        [write.status, write.body.error?.code],
        [403, "permission_denied"],
        "write",
      );
    },
  );

  await check("a non-owner cannot write structure", async () => {
    const token = await signIn(coordinatorA);
    const {status, body} = await saveVenue(token, {
      name: "Sin permiso",
      address: "x",
    });
    expectEqual(
      [status, body.error?.code],
      [403, "permission_denied"],
      "status",
    );
  });

  await check(
    "the owner creates and closes a venue, leaving its audit trail",
    async () => {
      const name = `Smoke ${Date.now()}`;
      const created = await saveVenue(tokenA, {
        name,
        address: "Calle de prueba 1",
      });
      expectEqual(created.status, 201, "create status");
      const venueId: string = created.body.venueId;

      const closed = await call(
        "structureApi",
        "PATCH",
        `/tenants/tenant-a/venues/${venueId}/status`,
        {status: "closed", reason: "smoke"},
        tokenA,
      );
      expectEqual(
        [closed.status, closed.body.status],
        [200, "closed"],
        "close response",
      );

      const venue = await db.doc(`tenants/tenant-a/venues/${venueId}`).get();
      expectEqual(venue.data()?.status, "closed", "venue stays, closed");

      const entries = await db
        .collection("tenants/tenant-a/auditLog")
        .where("target.id", "==", venueId)
        .get();
      expectEqual(
        sorted(entries.docs.map((d) => d.data().action as string)),
        ["venue.closed", "venue.created"],
        "audit actions",
      );
      expectEqual(
        entries.docs.every((d) => d.data().actorUid === ownerA.uid),
        true,
        "audit actor",
      );

      const hidden = await structureOf(tokenA);
      expectEqual(
        idsOf(hidden.body.venues).includes(venueId),
        false,
        "closed venue hidden by default",
      );
      const shown = await structureOf(tokenA, "?includeClosed=true");
      expectEqual(
        idsOf(shown.body.venues).includes(venueId),
        true,
        "closed venue returned with includeClosed",
      );
    },
  );

  console.log(
    failures === 0
      ? "\nAll smoke checks passed."
      : `\n${failures} smoke check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
