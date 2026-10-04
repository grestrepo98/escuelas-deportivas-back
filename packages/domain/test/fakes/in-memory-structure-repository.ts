import type {
  StructureRepository,
} from "../../src/ports/structure-repository.js";

type Stored = {id: string; tenantId: string};

// One generic fake serves venues, categories and groups.
export class InMemoryStructureRepository<T extends Stored>
implements StructureRepository<T> {
  private items = new Map<string, T>();
  private sequence = 0;

  constructor(private readonly prefix: string) {}

  newId(): string {
    this.sequence += 1;
    return `${this.prefix}-${this.sequence}`;
  }

  async get(tenantId: string, id: string): Promise<T | null> {
    const found = this.items.get(this.key(tenantId, id));
    return found ? structuredClone(found) : null;
  }

  async save(entity: T): Promise<void> {
    this.items.set(
      this.key(entity.tenantId, entity.id),
      structuredClone(entity),
    );
  }

  async listByTenant(tenantId: string): Promise<T[]> {
    return [...this.items.values()]
      .filter((item) => item.tenantId === tenantId)
      .map((item) => structuredClone(item));
  }

  snapshot(): Map<string, T> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, T>): void {
    this.items = structuredClone(snapshot);
  }

  private key(tenantId: string, id: string): string {
    return `${tenantId}/${id}`;
  }
}
