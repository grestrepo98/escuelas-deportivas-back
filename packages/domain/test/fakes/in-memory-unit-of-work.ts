import type {
  TransactionContext,
  UnitOfWork,
} from "../../src/ports/unit-of-work.js";
import type {InMemoryAuditLogWriter} from "./in-memory-audit-log-writer.js";
import type {
  InMemoryMembershipRepository,
} from "./in-memory-membership-repository.js";

// Snapshot-and-restore transaction: all-or-nothing, like the real adapter.
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(
    private readonly memberships: InMemoryMembershipRepository,
    private readonly auditLog: InMemoryAuditLogWriter,
  ) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const memberships = this.memberships.snapshot();
    const entries = this.auditLog.snapshot();
    try {
      return await work({
        memberships: this.memberships,
        auditLog: this.auditLog,
      });
    } catch (error) {
      this.memberships.restore(memberships);
      this.auditLog.restore(entries);
      throw error;
    }
  }
}
