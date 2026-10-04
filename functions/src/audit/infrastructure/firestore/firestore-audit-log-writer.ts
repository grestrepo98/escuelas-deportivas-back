import type {AuditEntry} from "../../domain/audit-entry.js";
import type {AuditLogWriter} from "../../application/audit-log-writer.js";
import {
  FieldValue,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";

// tenants/{tenantId}/auditLog/{auditId}. Create-only: it always uses
// `create` on a fresh id, so an existing entry can never be overwritten.
export class FirestoreAuditLogWriter implements AuditLogWriter {
  constructor(
    private readonly db: Firestore,
    private readonly tx?: Transaction,
  ) {}

  async append(entry: AuditEntry): Promise<void> {
    const ref = this.db.collection(`tenants/${entry.tenantId}/auditLog`).doc();
    const {reason, ...rest} = entry;
    const data = {
      ...rest,
      ...(reason !== undefined && {reason}),
      at: FieldValue.serverTimestamp(),
    };
    if (this.tx) {
      this.tx.create(ref, data);
    } else {
      await ref.create(data);
    }
  }
}
