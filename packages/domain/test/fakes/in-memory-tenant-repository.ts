import type {Tenant} from "../../src/tenant/tenant.js";
import type {TenantRepository} from "../../src/ports/tenant-repository.js";

export class InMemoryTenantRepository implements TenantRepository {
  private items = new Map<string, Tenant>();

  async get(tenantId: string): Promise<Tenant | null> {
    const found = this.items.get(tenantId);
    return found ? structuredClone(found) : null;
  }

  async save(tenant: Tenant): Promise<void> {
    this.items.set(tenant.id, structuredClone(tenant));
  }

  snapshot(): Map<string, Tenant> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, Tenant>): void {
    this.items = structuredClone(snapshot);
  }
}
