import type {Structure} from "../../domain/visible-structure.js";
import type {Firestore} from "firebase-admin/firestore";
import {
  FirestoreStructureRepository,
} from "./firestore-structure-repository.js";
import {categoryMapper, groupMapper, venueMapper} from "./structure-mapper.js";

// Read model for the whole structure of one tenant: three collection reads
// of tens of documents each, filtered in memory afterwards (no indexes).
export async function readStructure(
  db: Firestore,
  tenantId: string,
): Promise<Structure> {
  const [venues, categories, groups] = await Promise.all([
    new FirestoreStructureRepository(db, "venues", venueMapper)
      .listByTenant(tenantId),
    new FirestoreStructureRepository(db, "categories", categoryMapper)
      .listByTenant(tenantId),
    new FirestoreStructureRepository(db, "groups", groupMapper)
      .listByTenant(tenantId),
  ]);
  return {venues, categories, groups};
}
