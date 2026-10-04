import type {Tenant} from "../domain/tenant.js";

export interface TenantRepository {
  get(tenantId: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
}
