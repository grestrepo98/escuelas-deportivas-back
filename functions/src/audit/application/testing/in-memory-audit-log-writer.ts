import type {AuditEntry} from "../../domain/audit-entry.js";
import type {AuditLogWriter} from "../audit-log-writer.js";
import type {Clock} from "../../../shared/domain/clock.js";

export type StoredAuditEntry = AuditEntry & {at: Date};

export class InMemoryAuditLogWriter implements AuditLogWriter {
  entries: StoredAuditEntry[] = [];
  // Set to simulate a failing audit write.
  failWith: Error | null = null;

  constructor(private readonly clock: Clock) {}

  async append(entry: AuditEntry): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.entries.push({...structuredClone(entry), at: this.clock.now()});
  }

  snapshot(): StoredAuditEntry[] {
    return structuredClone(this.entries);
  }

  restore(snapshot: StoredAuditEntry[]): void {
    this.entries = structuredClone(snapshot);
  }
}
