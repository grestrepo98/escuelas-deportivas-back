import type {Membership} from "../domain/membership.js";
import type {Role} from "../domain/role.js";

export interface MembershipRepository {
  get(uid: string, tenantId: string): Promise<Membership | null>;
  save(membership: Membership): Promise<void>;
  countActiveByRole(tenantId: string, role: Role): Promise<number>;
}
