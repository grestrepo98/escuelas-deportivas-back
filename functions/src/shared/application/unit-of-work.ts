import type {AuditLogWriter} from "../../audit/application/audit-log-writer.js";
import type {MembershipRepository} from "../../membership/application/membership-repository.js";
import type {TenantRepository} from "../../tenant/application/tenant-repository.js";
import type {DocumentRepository} from "../../document/application/document-repository.js";
import type {GuardianRepository} from "../../player/application/guardian-repository.js";
import type {PlayerHistoryWriter} from "../../player/application/player-history-writer.js";
import type {PlayerRepository} from "../../player/application/player-repository.js";
import type {
  CategoryRepository,
  GroupRepository,
  VenueRepository,
} from "../../structure/application/structure-repository.js";

// Repositories bound to the running transaction.
export type TransactionContext = {
  players: PlayerRepository;
  guardians: GuardianRepository;
  playerHistory: PlayerHistoryWriter;
  memberships: MembershipRepository;
  auditLog: AuditLogWriter;
  tenants: TenantRepository;
  venues: VenueRepository;
  categories: CategoryRepository;
  groups: GroupRepository;
  documents: DocumentRepository;
};

// Runs `work` atomically: if it throws, none of its writes persist.
export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
