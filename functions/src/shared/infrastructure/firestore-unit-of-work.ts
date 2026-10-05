import type {
  TransactionContext,
  UnitOfWork,
} from "../application/unit-of-work.js";
import type {Firestore} from "firebase-admin/firestore";
import {FirestoreAuditLogWriter} from "../../audit/infrastructure/firestore/firestore-audit-log-writer.js";
import {FirestoreMembershipRepository} from "../../membership/infrastructure/firestore/firestore-membership-repository.js";
import {FirestoreGuardianRepository} from "../../player/infrastructure/firestore/firestore-guardian-repository.js";
import {FirestorePlayerHistoryWriter} from "../../player/infrastructure/firestore/firestore-player-history-writer.js";
import {FirestorePlayerRepository} from "../../player/infrastructure/firestore/firestore-player-repository.js";
import {FirestoreStructureRepository} from "../../structure/infrastructure/firestore/firestore-structure-repository.js";
import {FirestoreTenantRepository} from "../../tenant/infrastructure/firestore/firestore-tenant-repository.js";
import {
  categoryMapper,
  groupMapper,
  venueMapper,
} from "../../structure/infrastructure/firestore/structure-mapper.js";

// Runs the work inside one Firestore transaction. Firestore requires every
// read to happen before the first write, and may retry the whole function,
// so `work` must be free of side effects outside the transaction context.
export class FirestoreUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Firestore) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.db.runTransaction((tx) =>
      work({
        memberships: new FirestoreMembershipRepository(this.db, tx),
        auditLog: new FirestoreAuditLogWriter(this.db, tx),
        tenants: new FirestoreTenantRepository(this.db, tx),
        venues: new FirestoreStructureRepository(
          this.db,
          "venues",
          venueMapper,
          tx,
        ),
        categories: new FirestoreStructureRepository(
          this.db,
          "categories",
          categoryMapper,
          tx,
        ),
        groups: new FirestoreStructureRepository(
          this.db,
          "groups",
          groupMapper,
          tx,
        ),
        players: new FirestorePlayerRepository(this.db, tx),
        guardians: new FirestoreGuardianRepository(this.db, tx),
        playerHistory: new FirestorePlayerHistoryWriter(this.db, tx),
      }),
    );
  }
}
