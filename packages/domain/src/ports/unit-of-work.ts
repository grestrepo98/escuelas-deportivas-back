import type {AuditLogWriter} from "./audit-log-writer.js";
import type {MembershipRepository} from "./membership-repository.js";
import type {TenantRepository} from "./tenant-repository.js";
import type {
  CategoryRepository,
  GroupRepository,
  VenueRepository,
} from "./structure-repository.js";

// Repositories bound to the running transaction.
export type TransactionContext = {
  memberships: MembershipRepository;
  auditLog: AuditLogWriter;
  tenants: TenantRepository;
  venues: VenueRepository;
  categories: CategoryRepository;
  groups: GroupRepository;
};

// Runs `work` atomically: if it throws, none of its writes persist.
export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
