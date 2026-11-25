import {createWorld, NOW} from "../../../player/application/testing/world.js";
import type {PlayerRef} from "../player-reader.js";
import {InMemoryFileStorage} from "./in-memory-file-storage.js";
import {InMemoryPlayerReader} from "./in-memory-player-reader.js";

export {NOW, failure} from "../../../player/application/testing/world.js";

export const TENANT = "tenant-a";

const T0 = new Date("2026-10-01T00:00:00Z");

export const player = (overrides: Partial<PlayerRef> = {}): PlayerRef => ({
  id: "player-1",
  fullName: "Perez Juan",
  venueId: "venue-1",
  groupId: "group-1",
  categoryId: "category-1",
  ...overrides,
});

// The player world plus the tenant, a category and three players:
// player-1 and player-3 (venue-1, group-1, category-1) and player-2
// (venue-2, group-2, category-2).
export async function createDocumentWorld() {
  const world = await createWorld();
  await world.uow.tenants.save({
    id: TENANT,
    name: "Argentinos Juniors",
    status: "active",
    contact: {},
    policyWarningDays: 30,
    createdAt: T0,
    updatedAt: T0,
  });
  await world.uow.categories.save({
    id: "category-1",
    tenantId: TENANT,
    name: "Sub 10",
    birthYears: [2016],
    status: "active",
    createdAt: T0,
    updatedAt: T0,
  });
  const players = new InMemoryPlayerReader();
  players.add(TENANT, player());
  players.add(
    TENANT,
    player({
      id: "player-2",
      fullName: "Gomez Ana",
      venueId: "venue-2",
      groupId: "group-2",
      categoryId: "category-2",
    }),
  );
  players.add(TENANT, player({id: "player-3", fullName: "Abad Luis"}));
  const storage = new InMemoryFileStorage();
  return {...world, players, storage, now: NOW};
}

export type DocumentWorld = Awaited<ReturnType<typeof createDocumentWorld>>;

// What the client does after receiving an upload URL: put the object.
export function clientUploads(
  world: DocumentWorld,
  uploadId: string,
  file: {contentType: string; size: number; createdAt?: Date},
): void {
  world.storage.put(`uploads/${TENANT}/${uploadId}`, {
    createdAt: world.now,
    ...file,
  });
}
