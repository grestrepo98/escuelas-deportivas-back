import type {Tenant} from "../tenant/tenant.js";

export interface TenantRepository {
  get(tenantId: string): Promise<Tenant | null>;
  save(tenant: Tenant): Promise<void>;
}
