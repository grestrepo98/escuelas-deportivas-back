import type {Category, Group, Venue} from "../structure/structure.js";

// Shared shape of the per-tenant structure collections. Uniqueness and
// "has active children" checks filter `listByTenant` in memory: a tenant
// holds tens of documents, so no compound indexes are needed.
export interface StructureRepository<T extends {id: string}> {
  newId(): string;
  get(tenantId: string, id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  listByTenant(tenantId: string): Promise<T[]>;
}

export type VenueRepository = StructureRepository<Venue>;
export type CategoryRepository = StructureRepository<Category>;
export type GroupRepository = StructureRepository<Group>;
