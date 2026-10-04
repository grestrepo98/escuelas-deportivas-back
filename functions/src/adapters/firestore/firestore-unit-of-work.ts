import type {TransactionContext, UnitOfWork} from "@escuelas/domain";
import type {Firestore} from "firebase-admin/firestore";
import {FirestoreAuditLogWriter} from "./firestore-audit-log-writer.js";
import {
  FirestoreMembershipRepository,
} from "./firestore-membership-repository.js";

// Runs the work inside one Firestore transaction. Firestore requires every
// read to happen before the first write, and may retry the whole function,
// so `work` must be free of side effects outside the transaction context.
export class FirestoreUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Firestore) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.db.runTransaction((tx) => work({
      memberships: new FirestoreMembershipRepository(this.db, tx),
      auditLog: new FirestoreAuditLogWriter(this.db, tx),
    }));
  }
}
