import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {
  GROUP_NORTE_SUB10,
  GROUP_NORTE_SUB12,
  GROUP_SUR_SUB10,
  parseSeedArgs,
  SEED_CATEGORIES,
  SEED_GROUPS,
  SEED_PLAYERS,
  SEED_USERS,
  SEED_VENUES,
  type SeedUser,
} from "./seed-lib.js";

// End-to-end smoke test of the deployed module APIs (specs 01, 02, 04, 05 and
// 06).
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
  // `api` is the function name (membershipApi, tenantApi, structureApi, playerApi).
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
    scope?: {venueIds?: string[]; groupIds?: string[]},
  ) =>
    call(
      "membershipApi",
      "PATCH",
      `/tenants/tenant-a/memberships/${uid}/role`,
      {newRole, reason, scope},
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

    // A teacher needs a group and a coordinator a venue (spec 05).
    const group = SEED_GROUPS.find((g) => g.tenantId === "tenant-a")!;
    const reason = `smoke-${Date.now()}`;
    try {
      const {status, body} = await changeRole(
        tokenA,
        coordinatorA.uid,
        "teacher",
        reason,
        {groupIds: [group.id]},
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
          entry.after?.scope?.groupIds,
          entry.actorUid,
          entry.at !== undefined,
        ],
        ["coordinator", "teacher", [group.id], ownerA.uid, true],
        "audit entry",
      );
    } finally {
      // Put the baseline back (this adds a second, honest audit entry).
      await changeRole(
        tokenA,
        coordinatorA.uid,
        "coordinator",
        `${reason}-restore`,
        {venueIds: coordinatorA.scope.venueIds},
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

  // Spec 05: users and scope. Everything it creates is removed at the end
  // (the memberships and the account it made), so a rerun starts clean.
  const membersPath = "/tenants/tenant-a/memberships";
  const membershipCall = (
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    token: string,
    data?: unknown,
  ) => call("membershipApi", method, `${membersPath}${path}`, data, token);
  const venuesA = SEED_VENUES.filter((v) => v.tenantId === "tenant-a").map(
    (v) => v.id,
  );
  const otherVenue = venuesA.find((id) => id !== coordinatorVenueId)!;
  const adminAuth = getAuth(app);
  const invitedEmail = `smoke-${Date.now()}@example.com`;
  const rejectedEmail = `smoke-rejected-${Date.now()}@example.com`;
  type Member = {uid: string; email: string; role: string; status: string};
  const membersOf = async (token: string): Promise<Member[]> => {
    const {status, body} = await membershipCall("GET", "", token);
    expectEqual(status, 200, "list status");
    return body.memberships;
  };
  const accountExists = (email: string) =>
    adminAuth.getUserByEmail(email).then(
      () => true,
      () => false,
    );
  const toClean: string[] = []; // uids whose tenant-a membership to remove
  let invitedUid = "";

  try {
    await check(
      "the owner invites a coordinator and gets a reset link",
      async () => {
        const {status, body} = await membershipCall("POST", "", tokenA, {
          email: invitedEmail,
          role: "coordinator",
          scope: {venueIds: [coordinatorVenueId]},
        });
        expectEqual(
          [status, body.role, typeof body.passwordResetLink],
          [201, "coordinator", "string"],
          "invite response",
        );
        invitedUid = body.uid;
        toClean.push(invitedUid);

        const entries = await db
          .collection("tenants/tenant-a/auditLog")
          .where("target.id", "==", `${invitedUid}_tenant-a`)
          .get();
        expectEqual(
          entries.docs.map((d) => d.data().action),
          ["membership.invited"],
          "audit actions",
        );
      },
    );

    await check("inviting the same person again is a conflict", async () => {
      const {status, body} = await membershipCall("POST", "", tokenA, {
        email: invitedEmail,
        role: "teacher",
        scope: {groupIds: [teacherGroup.id]},
      });
      expectEqual(
        [status, body.error?.code],
        [409, "failed_precondition"],
        "status",
      );
    });

    await check(
      "an invalid scope is rejected and creates no account",
      async () => {
        const {status, body} = await membershipCall("POST", "", tokenA, {
          email: rejectedEmail,
          role: "coordinator",
        });
        expectEqual(
          [status, body.error?.code],
          [400, "invalid_argument"],
          "status",
        );
        expectEqual(await accountExists(rejectedEmail), false, "account");
      },
    );

    await check(
      "the owner lists the members, the invited one too",
      async () => {
        const invited = (await membersOf(tokenA)).find(
          (m) => m.email === invitedEmail,
        );
        expectEqual(
          [invited?.uid, invited?.role, invited?.status],
          [invitedUid, "coordinator", "active"],
          "invited member",
        );
      },
    );

    await check(
      "a coordinator lists only the members of their venue",
      async () => {
        const token = await signIn(coordinatorA);
        const visible = await membersOf(token);
        expectEqual(
          visible.some((m) => m.email === invitedEmail),
          true,
          "sees the coordinator invited to their venue",
        );
        expectEqual(
          visible.some((m) => m.uid === ownerA.uid),
          false,
          "does not see the owner",
        );
        expectEqual(
          visible.every((m) => ["coordinator", "teacher"].includes(m.role)),
          true,
          "only coordinators and teachers",
        );
      },
    );

    await check("a teacher cannot list the members", async () => {
      const token = await signIn(teacherA);
      const {status, body} = await membershipCall("GET", "", token);
      expectEqual(
        [status, body.error?.code],
        [403, "permission_denied"],
        "status",
      );
    });

    await check(
      "the owner moves the invited coordinator to a venue",
      async () => {
        const {status, body} = await membershipCall(
          "PUT",
          `/${invitedUid}/scope`,
          tokenA,
          {scope: {venueIds: [otherVenue]}},
        );
        expectEqual(
          [status, body.scope?.venueIds],
          [200, [otherVenue]],
          "scope response",
        );
        const empty = await membershipCall(
          "PUT",
          `/${invitedUid}/scope`,
          tokenA,
          {scope: {}},
        );
        expectEqual(empty.status, 400, "a coordinator needs a venue");
      },
    );

    await check(
      "a deactivated user is cut off with the same token, until reactivated",
      async () => {
        const token = await signIn(coordinatorA);
        expectEqual(
          (await membershipCall("GET", "", token)).status,
          200,
          "before",
        );
        try {
          const off = await membershipCall(
            "PATCH",
            `/${coordinatorA.uid}/status`,
            tokenA,
            {status: "inactive", reason: "smoke"},
          );
          expectEqual([off.status, off.body.status], [200, "inactive"], "off");

          for (const [api, path] of [
            ["membershipApi", membersPath],
            ["structureApi", "/tenants/tenant-a/structure"],
          ]) {
            const {status, body} = await call(
              api,
              "GET",
              path,
              undefined,
              token,
            );
            expectEqual(
              [status, body.error?.code],
              [403, "permission_denied"],
              `${api} after deactivation`,
            );
          }
        } finally {
          await membershipCall("PATCH", `/${coordinatorA.uid}/status`, tokenA, {
            status: "active",
            reason: "smoke-restore",
          });
        }
        expectEqual(
          (await membershipCall("GET", "", token)).status,
          200,
          "after reactivation",
        );
      },
    );

    await check("the last active owner cannot be deactivated", async () => {
      const owners = (await membersOf(tokenA)).filter(
        (m) => m.role === "owner" && m.status === "active",
      );
      if (owners.length !== 1) {
        console.log("      skipped: tenant-a has more than one active owner");
        return;
      }
      const {status, body} = await membershipCall(
        "PATCH",
        `/${ownerA.uid}/status`,
        tokenA,
        {status: "inactive"},
      );
      if (status === 200) {
        // The guard failed and the only owner is now inactive, so no API call
        // can undo it (an inactive owner is denied): put it back directly.
        await db
          .doc(`memberships/${ownerA.uid}_tenant-a`)
          .update({status: "active"});
      }
      expectEqual(
        [status, body.error?.code],
        [409, "failed_precondition"],
        "status",
      );
    });

    await check(
      "an account that already signed in is reused, with no link",
      async () => {
        const {status, body} = await membershipCall("POST", "", tokenA, {
          email: ownerB.email,
          role: "accountant",
        });
        toClean.push(ownerB.uid);
        expectEqual(
          [status, body.uid, "passwordResetLink" in body],
          [201, ownerB.uid, false],
          "invite response",
        );
        const mine = await call(
          "membershipApi",
          "GET",
          "/me/memberships",
          undefined,
          tokenB,
        );
        expectEqual(
          mine.body.memberships
            .map((m: {tenantId: string}) => m.tenantId)
            .sort(),
          ["tenant-a", "tenant-b"],
          "the same user now belongs to both",
        );
      },
    );

    await check(
      "the owner deactivates the invited member for good",
      async () => {
        const {status, body} = await membershipCall(
          "PATCH",
          `/${invitedUid}/status`,
          tokenA,
          {status: "inactive"},
        );
        expectEqual([status, body.status], [200, "inactive"], "response");
        const member = (await membersOf(tokenA)).find(
          (m) => m.uid === invitedUid,
        );
        expectEqual(member?.status, "inactive", "listed as inactive");
      },
    );
  } finally {
    for (const uid of toClean) {
      await db.doc(`memberships/${uid}_tenant-a`).delete();
    }
    if (invitedUid) {
      await adminAuth.deleteUser(invitedUid).catch(() => undefined);
    }
  }

  // Spec 06: players and guardians. The player it enrolls and its guardian
  // are deleted at the end, so a rerun starts clean and `dev` keeps only the
  // seeded players. The audit log keeps its entries, as it must.
  const playersPath = "/tenants/tenant-a/players";
  const playerCall = (
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    token: string,
    data?: unknown,
  ) => call("playerApi", method, `${playersPath}${path}`, data, token);
  const smokeNumber = String(Date.now()).slice(-9);
  const smokeTi = `7${smokeNumber}`;
  const smokeCc = `8${smokeNumber}`;
  const seedPlayerIds = SEED_PLAYERS.map((p) => p.id);
  const norteSeedIds = SEED_PLAYERS.filter(
    (p) => p.groupId !== GROUP_SUR_SUB10,
  ).map((p) => p.id);
  let smokePlayerId = "";

  type ListedPlayer = {id: string};
  const listAll = async (token: string, query = ""): Promise<string[]> => {
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 50; page++) {
      const suffix: string = `${query}${query ? "&" : "?"}limit=3${
        cursor ? `&cursor=${cursor}` : ""
      }`;
      const {status, body} = await playerCall("GET", suffix, token);
      expectEqual(status, 200, "list status");
      ids.push(...body.players.map((p: ListedPlayer) => p.id));
      cursor = body.nextCursor;
      if (cursor === null) return ids;
    }
    throw new Error("the list did not end after 50 pages");
  };

  try {
    await check(
      "the owner enrolls a player with a new guardian in one call",
      async () => {
        const {status, body} = await playerCall("POST", "", tokenA, {
          firstNames: "Smoke",
          lastNames: `Prueba ${smokeNumber}`,
          document: {type: "TI", number: smokeTi},
          birthDate: "2015-05-05",
          groupId: GROUP_NORTE_SUB10,
          emergencyContact: {
            name: "Smoke Acudiente",
            phone: "3000000000",
            relationship: "madre",
          },
          guardians: [
            {
              guardian: {
                firstNames: "Smoke",
                lastNames: `Acudiente ${smokeNumber}`,
                document: {type: "CC", number: smokeCc},
                phone: "3000000000",
                preferredContact: "phone",
              },
              relationship: "madre",
              isPaymentResponsible: true,
            },
          ],
        });
        expectEqual(
          [status, body.status, body.createdGuardianIds?.length],
          [201, "preinscrito", 1],
          "enroll response",
        );
        smokePlayerId = body.playerId;

        const entries = await db
          .collection("tenants/tenant-a/auditLog")
          .where("target.id", "==", smokePlayerId)
          .get();
        expectEqual(
          entries.docs.map((d) => d.data().action),
          ["player.created"],
          "audit actions",
        );
      },
    );

    await check(
      "enrolling the same document again is a conflict that names the player",
      async () => {
        const {status, body} = await playerCall("POST", "", tokenA, {
          firstNames: "Otro",
          lastNames: "Nombre",
          document: {type: "TI", number: smokeTi},
          birthDate: "2015-05-06",
          groupId: GROUP_NORTE_SUB10,
          emergencyContact: {name: "A", phone: "3", relationship: "madre"},
          guardians: [],
        });
        expectEqual(
          [status, body.error?.details?.playerId],
          [409, smokePlayerId],
          "conflict",
        );
      },
    );

    await check("a teacher cannot enroll or write", async () => {
      const token = await signIn(teacherA);
      const enroll = await playerCall("POST", "", token, {
        firstNames: "X",
        lastNames: "Y",
        birthDate: "2015-01-01",
        groupId: GROUP_NORTE_SUB10,
        emergencyContact: {name: "A", phone: "3", relationship: "madre"},
        guardians: [],
      });
      const write = await playerCall(
        "PATCH",
        `/${seedPlayerIds[0]}/status`,
        token,
        {status: "pausado", reason: "smoke"},
      );
      expectEqual([enroll.status, write.status], [403, 403], "statuses");
    });

    await check(
      "activating needs the consent; a coordinator records it and activates",
      async () => {
        const token = await signIn(coordinatorA);
        const refused = await playerCall(
          "PATCH",
          `/${smokePlayerId}/status`,
          token,
          {status: "activo"},
        );
        expectEqual(refused.status, 409, "without the consent");

        const player = await playerCall("GET", `/${smokePlayerId}`, token);
        const guardianId = player.body.guardians[0].guardianId;
        const consent = await playerCall(
          "PUT",
          `/${smokePlayerId}/consent`,
          token,
          {guardianId},
        );
        expectEqual(consent.status, 200, "consent");

        const activated = await playerCall(
          "PATCH",
          `/${smokePlayerId}/status`,
          token,
          {status: "activo"},
        );
        expectEqual(
          [activated.status, activated.body.status],
          [200, "activo"],
          "activation",
        );
      },
    );

    await check(
      "a coordinator moves the player inside their venue, not to another",
      async () => {
        const token = await signIn(coordinatorA);
        const moved = await playerCall(
          "PUT",
          `/${smokePlayerId}/placement`,
          token,
          {groupId: GROUP_NORTE_SUB12, reason: "smoke"},
        );
        expectEqual(
          [moved.status, moved.body.groupId],
          [200, GROUP_NORTE_SUB12],
          "move",
        );
        const denied = await playerCall(
          "PUT",
          `/${smokePlayerId}/placement`,
          token,
          {groupId: GROUP_SUR_SUB10},
        );
        expectEqual(denied.status, 403, "to another venue");
      },
    );

    await check("the history lists the changes, newest first", async () => {
      const {status, body} = await playerCall(
        "GET",
        `/${smokePlayerId}/history`,
        tokenA,
      );
      expectEqual(status, 200, "status");
      expectEqual(
        body.entries.map((e: {type: string}) => e.type),
        ["placement", "status"],
        "entry types",
      );
    });

    await check(
      "the list pages by cursor without repeating or skipping anyone",
      async () => {
        const ids = await listAll(tokenA);
        expectEqual(new Set(ids).size, ids.length, "no repeated player");
        for (const id of [...seedPlayerIds, smokePlayerId]) {
          expectEqual(ids.includes(id), true, `lists ${id}`);
        }
      },
    );

    await check(
      "the list filters by status and by venue (the composite indexes)",
      async () => {
        const active = await listAll(tokenA, "?status=activo");
        const activeSeed = SEED_PLAYERS.filter((p) => p.status === "activo");
        for (const p of SEED_PLAYERS) {
          expectEqual(
            active.includes(p.id),
            p.status === "activo",
            `${p.id} in the active list`,
          );
        }
        expectEqual(active.includes(smokePlayerId), true, "smoke player");
        expectEqual(active.length >= activeSeed.length + 1, true, "count");

        const norteActive = await listAll(
          tokenA,
          `?venueId=${coordinatorVenueId}&status=activo`,
        );
        expectEqual(
          norteActive.includes(seedPlayerIds[0]) &&
            !norteActive.includes(seedPlayerIds[6]),
          true,
          "active players of the north venue only",
        );
        const byGroup = await listAll(tokenA, `?groupId=${GROUP_NORTE_SUB12}`);
        expectEqual(byGroup.includes(smokePlayerId), true, "by group");
        const two = await playerCall(
          "GET",
          `?venueId=${coordinatorVenueId}&groupId=${GROUP_NORTE_SUB12}`,
          tokenA,
        );
        expectEqual(two.status, 400, "two location filters");
      },
    );

    await check(
      "a coordinator lists only the players of their venue",
      async () => {
        const ids = await listAll(await signIn(coordinatorA));
        for (const id of norteSeedIds) {
          expectEqual(ids.includes(id), true, `lists ${id}`);
        }
        expectEqual(ids.includes(smokePlayerId), true, "smoke player");
        expectEqual(
          SEED_PLAYERS.filter((p) => p.groupId === GROUP_SUR_SUB10).some((p) =>
            ids.includes(p.id),
          ),
          false,
          "no player of the south venue",
        );
      },
    );

    await check(
      "the search index has documents for the staff and not for a teacher",
      async () => {
        const staff = await playerCall("GET", "/search-index", tokenA);
        const entry = staff.body.entries.find(
          (e: {id: string}) => e.id === smokePlayerId,
        );
        expectEqual(
          [entry?.documentNumber, entry?.guardianNames],
          [smokeTi, [`Smoke Acudiente ${smokeNumber}`]],
          "staff entry",
        );

        const teacher = await playerCall(
          "GET",
          "/search-index",
          await signIn(teacherA),
        );
        expectEqual(teacher.status, 200, "teacher status");
        expectEqual(
          teacher.body.entries.every(
            (e: object) => !("documentNumber" in e || "guardianNames" in e),
          ),
          true,
          "no document or guardian names",
        );
      },
    );

    await check(
      "a teacher sees only their group, without document or guardians",
      async () => {
        const token = await signIn(teacherA);
        const ids = await listAll(token);
        expectEqual(
          sorted(ids),
          sorted(
            SEED_PLAYERS.filter((p) => p.groupId === GROUP_NORTE_SUB10).map(
              (p) => p.id,
            ),
          ),
          "the teacher's players",
        );

        const own = await playerCall("GET", `/${seedPlayerIds[0]}`, token);
        expectEqual(own.status, 200, "own group");
        expectEqual(
          ["document", "guardians", "dataConsent"].some((k) => k in own.body),
          false,
          "restricted fields",
        );
        const other = await playerCall("GET", `/${seedPlayerIds[3]}`, token);
        expectEqual(other.status, 403, "another group");
      },
    );

    await check(
      "renaming a guardian updates the copy in the player",
      async () => {
        const player = await playerCall("GET", `/${smokePlayerId}`, tokenA);
        const guardianId = player.body.guardians[0].guardianId;
        const renamed = await call(
          "playerApi",
          "PUT",
          `/tenants/tenant-a/guardians/${guardianId}`,
          {
            firstNames: "Smoke Renombrado",
            lastNames: `Acudiente ${smokeNumber}`,
            document: {type: "CC", number: smokeCc},
            phone: "3000000000",
            preferredContact: "phone",
          },
          tokenA,
        );
        expectEqual(renamed.status, 200, "update");
        const after = await playerCall("GET", `/${smokePlayerId}`, tokenA);
        expectEqual(
          after.body.guardians[0].fullName,
          `Smoke Renombrado Acudiente ${smokeNumber}`,
          "copied name",
        );

        const found = await call(
          "playerApi",
          "GET",
          `/tenants/tenant-a/guardians?documentType=CC&documentNumber=${smokeCc}`,
          undefined,
          tokenA,
        );
        expectEqual(
          [found.status, found.body.guardian?.id],
          [200, guardianId],
          "found by document",
        );
      },
    );

    await check("a tenant-b owner cannot read tenant-a players", async () => {
      const list = await playerCall("GET", "", tokenB);
      const one = await playerCall("GET", `/${seedPlayerIds[0]}`, tokenB);
      expectEqual([list.status, one.status], [403, 403], "statuses");
    });
  } finally {
    const players = db.collection("tenants/tenant-a/players");
    const guardians = db.collection("tenants/tenant-a/guardians");
    for (const doc of (
      await players.where("documentKey", "==", `TI:${smokeTi}`).get()
    ).docs) {
      await db.recursiveDelete(doc.ref);
    }
    for (const doc of (
      await guardians.where("documentKey", "==", `CC:${smokeCc}`).get()
    ).docs) {
      await doc.ref.delete();
    }
  }

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
