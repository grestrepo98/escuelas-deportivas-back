import type {AuditEntry} from "../domain/audit-entry.js";

// Create-only: there is deliberately no update or delete.
export interface AuditLogWriter {
  append(entry: AuditEntry): Promise<void>;
}
