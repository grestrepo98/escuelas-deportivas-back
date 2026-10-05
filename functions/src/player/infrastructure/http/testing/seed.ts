import type {Role} from "../../../../membership/domain/role.js";
import {FirestoreMembershipRepository} from "../../../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreStructureRepository} from "../../../../structure/infrastructure/firestore/firestore-structure-repository.js";
import {groupMapper} from "../../../../structure/infrastructure/firestore/structure-mapper.js";
import {
  callApi,
  clearAuth,
  createUser,
  type TestUser,
} from "../../../../shared/infrastructure/testing/emulator-helpers.js";
import {
  clearFirestore,
  testDb,
} from "../../../../shared/infrastructure/testing/helpers.js";
import {
  buildGroup,
  buildGuardian,
  buildMember,
  buildPlayer,
} from "../../../application/testing/fixtures.js";
import {FirestoreGuardianRepository} from "../../firestore/firestore-guardian-repository.js";
import {FirestorePlayerRepository} from "../../firestore/firestore-player-repository.js";

export const db = testDb();
export const players = new FirestorePlayerRepository(db);
export const guardians = new FirestoreGuardianRepository(db);
const memberships = new FirestoreMembershipRepository(db);

// Everyone who calls the API in the player tests. Venue ids and group ids
// match the fixtures: group-1 and group-2 are in venue-1, group-9 in venue-2.
export type Caller =
  | "owner"
  | "ownerB"
  | "accountant"
  | "coordinator" // venue-1
  | "coordinatorOther" // venue-2
  | "teacher" // group-1
  | "teacherOther" // group-9
  | "guardian"
  | "adultPlayer";

export type World = Record<Caller, TestUser>;

const SCOPES: Record<Caller, [string, Role, string, object]> = {
  owner: ["owner@example.com", "owner", "tenant-a", {}],
  ownerB: ["owner-b@example.com", "owner", "tenant-b", {}],
  accountant: ["accountant@example.com", "accountant", "tenant-a", {}],
  coordinator: [
    "coordinator@example.com",
    "coordinator",
    "tenant-a",
    {venueIds: ["venue-1"]},
  ],
  coordinatorOther: [
    "coordinator-other@example.com",
    "coordinator",
    "tenant-a",
    {venueIds: ["venue-2"]},
  ],
  teacher: [
    "teacher@example.com",
    "teacher",
    "tenant-a",
    {groupIds: ["group-1"]},
  ],
  teacherOther: [
    "teacher-other@example.com",
    "teacher",
    "tenant-a",
    {groupIds: ["group-9"]},
  ],
  guardian: [
    "guardian@example.com",
    "guardian",
    "tenant-a",
    {playerIds: ["player-1"]},
  ],
  adultPlayer: [
    "adult@example.com",
    "adultPlayer",
    "tenant-a",
    {playerIds: ["player-1"]},
  ],
};

// Resets Firestore and Auth, then creates the callers, the structure and one
// player (player-1, preinscrito, group-1) with one guardian (guardian-1).
export async function resetWorld(): Promise<World> {
  await clearFirestore();
  await clearAuth();

  const world = {} as World;
  for (const [caller, [email, role, tenantId, scope]] of Object.entries(
    SCOPES,
  ) as [Caller, (typeof SCOPES)[Caller]][]) {
    const user = await createUser(email);
    world[caller] = user;
    await memberships.save(buildMember(user.uid, role, scope, {tenantId}));
  }

  const groups = new FirestoreStructureRepository(db, "groups", groupMapper);
  await groups.save(buildGroup({id: "group-1"}));
  await groups.save(buildGroup({id: "group-2", categoryId: "category-2"}));
  await groups.save(
    buildGroup({id: "group-9", venueId: "venue-2", categoryId: "category-2"}),
  );

  await guardians.save(buildGuardian());
  await players.save(
    buildPlayer({
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
  return world;
}

export const TENANT_PATH = "/tenants/tenant-a";

export type Method = "GET" | "POST" | "PUT" | "PATCH";

export const api = (
  method: Method,
  path: string,
  caller: TestUser | undefined,
  body?: unknown,
) => callApi("playerApi", method, path, body, caller?.idToken);

export const auditEntries = async () =>
  (await db.collection("tenants/tenant-a/auditLog").get()).docs.map((d) =>
    d.data(),
  );

export const historyEntries = async (playerId = "player-1") =>
  (
    await db.collection(`tenants/tenant-a/players/${playerId}/history`).get()
  ).docs.map((d) => d.data());
