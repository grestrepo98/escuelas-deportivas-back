import type {AuditLogWriter} from "./audit-log-writer.js";
import type {MembershipRepository} from "./membership-repository.js";

// Repositories bound to the running transaction.
export type TransactionContext = {
  memberships: MembershipRepository;
  auditLog: AuditLogWriter;
};

// Runs `work` atomically: if it throws, none of its writes persist.
export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
