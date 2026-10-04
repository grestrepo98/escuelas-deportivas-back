import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {parseSeedArgs, SEED_USERS, type SeedUser} from "./seed-lib.js";

// End-to-end smoke test of the deployed callables (spec 01, step 15).
// It signs in as seeded users and calls the real functions over HTTPS.
//
//   SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev
//   npm run smoke:emulator            (verifies this script itself, locally)
//
// Run `seed` against the same target first.

type CallResult = {status: number; body: any}; // eslint-disable-line

const userOf = (role: SeedUser["role"], tenantId: string): SeedUser => {
  const user = SEED_USERS.find(
    (u) => u.role === role && u.tenantId === tenantId);
  if (!user) throw new Error(`No seed user for ${role} in ${tenantId}`);
  return user;
};

async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2), process.env);
  const isEmulator = args.target === "emulator";

  const apiKey = isEmulator ? "fake" : process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("--target dev needs FIREBASE_API_KEY (the dev project's " +
      "Web API key, used only to sign in the seed users)");
  }
  const authBase = isEmulator ?
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com` :
    "https://identitytoolkit.googleapis.com";
  const functionUrl = (name: string) => isEmulator ?
    `http://127.0.0.1:5001/${args.projectId}/us-central1/${name}` :
    `https://us-central1-${args.projectId}.cloudfunctions.net/${name}`;

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
        "Was the seed run against this target with this password?");
    }
    return ((await response.json()) as {idToken: string}).idToken;
  };

  const call = async (
    name: string, data: unknown, token?: string,
  ): Promise<CallResult> => {
    const response = await fetch(functionUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && {Authorization: `Bearer ${token}`}),
      },
      body: JSON.stringify({data}),
    });
    return {status: response.status, body: await response.json()};
  };

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
      throw new Error(`${what}: expected ${JSON.stringify(expected)}, ` +
        `got ${JSON.stringify(actual)}`);
    }
  };

  console.log(`Smoke test on "${args.target}" (project ${args.projectId})\n`);

  await check("a call without a session is rejected as UNAUTHENTICATED",
    async () => {
      const {status, body} = await call("listMyMemberships", {});
      expectEqual([status, body.error?.status], [401, "UNAUTHENTICATED"],
        "status");
    });

  await check("listMyMemberships answers for a seed user", async () => {
    const {status, body} = await call("listMyMemberships", {}, tokenA);
    expectEqual(status, 200, "status");
    const mine = body.result.memberships.find(
      (m: {tenantId: string}) => m.tenantId === "tenant-a");
    expectEqual([mine?.role, mine?.tenantName], ["owner", "Escuela A (seed)"],
      "tenant-a membership");
  });

  await check("a tenant-b user does not see tenant-a", async () => {
    const {body} = await call("listMyMemberships", {}, tokenB);
    expectEqual(
      body.result.memberships.map((m: {tenantId: string}) => m.tenantId),
      ["tenant-b"], "visible tenants");
  });

  await check("a tenant-b owner cannot change roles in tenant-a", async () => {
    const {status, body} = await call("changeMembershipRole", {
      tenantId: "tenant-a",
      targetUid: coordinatorA.uid,
      newRole: "teacher",
    }, tokenB);
    expectEqual([status, body.error?.status], [403, "PERMISSION_DENIED"],
      "status");
  });

  await check("a role change leaves its entry in the audit log", async () => {
    const membershipRef =
      db.doc(`memberships/${coordinatorA.uid}_tenant-a`);
    const before = (await membershipRef.get()).data()?.role;
    expectEqual(before, "coordinator",
      "baseline role (run the seed to restore it)");

    const reason = `smoke-${Date.now()}`;
    try {
      const {status, body} = await call("changeMembershipRole", {
        tenantId: "tenant-a",
        targetUid: coordinatorA.uid,
        newRole: "teacher",
        reason,
      }, tokenA);
      expectEqual([status, body.result?.role], [200, "teacher"], "response");

      const entries = await db.collection("tenants/tenant-a/auditLog")
        .where("reason", "==", reason).get();
      expectEqual(entries.size, 1, "audit entries for this change");
      const entry = entries.docs[0].data();
      expectEqual(
        [entry.before?.role, entry.after?.role, entry.actorUid,
          entry.at !== undefined],
        ["coordinator", "teacher", ownerA.uid, true],
        "audit entry",
      );
    } finally {
      // Put the baseline back (this adds a second, honest audit entry).
      await call("changeMembershipRole", {
        tenantId: "tenant-a",
        targetUid: coordinatorA.uid,
        newRole: "coordinator",
        reason: `${reason}-restore`,
      }, tokenA);
    }
    expectEqual((await membershipRef.get()).data()?.role, "coordinator",
      "role after restore");
  });

  console.log(failures === 0 ? "\nAll smoke checks passed." :
    `\n${failures} smoke check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
