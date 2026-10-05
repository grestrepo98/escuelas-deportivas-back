import type {Membership} from "../domain/membership.js";
import type {Role} from "../domain/role.js";

export interface MembershipRepository {
  get(uid: string, tenantId: string): Promise<Membership | null>;
  save(membership: Membership): Promise<void>;
  countActiveByRole(tenantId: string, role: Role): Promise<number>;
  // Every membership of the tenant, active or not. A tenant holds tens of
  // members, so callers filter in memory.
  listByTenant(tenantId: string): Promise<Membership[]>;
}
