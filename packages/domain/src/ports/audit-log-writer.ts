import type {AuditEntry} from "../audit/audit-entry.js";

// Create-only: there is deliberately no update or delete.
export interface AuditLogWriter {
  append(entry: AuditEntry): Promise<void>;
}
