import type {Role} from "../membership/role.js";

export type AuditAction = "membership.role_changed"; // extended by future specs

// The writer assigns the timestamp (server time, UTC), so it is not part
// of the entry the domain builds.
export type AuditEntry = {
  tenantId: string;
  actorUid: string;
  actorRole: Role;
  action: AuditAction;
  target: {type: "membership"; id: string};
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason?: string;
  device: {userAgent?: string};
};
