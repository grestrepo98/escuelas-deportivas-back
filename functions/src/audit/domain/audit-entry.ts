import type {Role} from "../../membership/domain/role.js";

export type AuditAction =
  | "membership.role_changed"
  | "membership.invited"
  | "membership.status_changed"
  | "membership.scope_changed"
  | "tenant.updated"
  | "venue.created"
  | "venue.updated"
  | "venue.closed"
  | "venue.reopened"
  | "category.created"
  | "category.updated"
  | "category.closed"
  | "category.reopened"
  | "group.created"
  | "group.updated"
  | "group.closed"
  | "group.reopened"
  | "player.created"
  | "player.updated"
  | "player.placement_changed"
  | "player.status_changed"
  | "player.guardians_changed"
  | "player.consent_recorded"
  | "guardian.created"
  | "guardian.updated"
  | "document.uploaded"
  | "document.recorded"
  | "document.superseded"; // extended by future specs

export type AuditTargetType =
  | "membership"
  | "tenant"
  | "venue"
  | "category"
  | "group"
  | "player"
  | "guardian"
  | "document";

// The writer assigns the timestamp (server time, UTC), so it is not part
// of the entry the domain builds.
export type AuditEntry = {
  tenantId: string;
  actorUid: string;
  actorRole: Role;
  action: AuditAction;
  target: {type: AuditTargetType; id: string};
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason?: string;
  device: {userAgent?: string};
};
