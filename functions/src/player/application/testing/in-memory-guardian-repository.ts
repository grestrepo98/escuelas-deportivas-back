import type {Guardian} from "../../domain/guardian.js";
import type {GuardianRepository} from "../guardian-repository.js";

export class InMemoryGuardianRepository implements GuardianRepository {
  private items = new Map<string, Guardian>();
  private sequence = 0;

  newId(): string {
    this.sequence += 1;
    return `generated-guardian-${this.sequence}`;
  }

  async get(tenantId: string, id: string): Promise<Guardian | null> {
    const found = this.items.get(this.key(tenantId, id));
    return found ? structuredClone(found) : null;
  }

  async save(guardian: Guardian): Promise<void> {
    this.items.set(
      this.key(guardian.tenantId, guardian.id),
      structuredClone(guardian),
    );
  }

  async findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Guardian | null> {
    const found = [...this.items.values()].find(
      (guardian) =>
        guardian.tenantId === tenantId && guardian.documentKey === documentKey,
    );
    return found ? structuredClone(found) : null;
  }

  snapshot(): Map<string, Guardian> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, Guardian>): void {
    this.items = structuredClone(snapshot);
  }

  private key(tenantId: string, id: string): string {
    return `${tenantId}/${id}`;
  }
}
