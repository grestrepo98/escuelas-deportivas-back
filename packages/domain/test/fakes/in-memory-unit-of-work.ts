import type {Category, Group, Venue} from "../../src/structure/structure.js";
import type {
  TransactionContext,
  UnitOfWork,
} from "../../src/ports/unit-of-work.js";
import type {InMemoryAuditLogWriter} from "./in-memory-audit-log-writer.js";
import type {
  InMemoryMembershipRepository,
} from "./in-memory-membership-repository.js";
import {
  InMemoryStructureRepository,
} from "./in-memory-structure-repository.js";
import {InMemoryTenantRepository} from "./in-memory-tenant-repository.js";

type StructureRepositories = {
  tenants: InMemoryTenantRepository;
  venues: InMemoryStructureRepository<Venue>;
  categories: InMemoryStructureRepository<Category>;
  groups: InMemoryStructureRepository<Group>;
};

// Snapshot-and-restore transaction: all-or-nothing, like the real adapter.
export class InMemoryUnitOfWork implements UnitOfWork {
  readonly tenants: InMemoryTenantRepository;
  readonly venues: InMemoryStructureRepository<Venue>;
  readonly categories: InMemoryStructureRepository<Category>;
  readonly groups: InMemoryStructureRepository<Group>;

  constructor(
    private readonly memberships: InMemoryMembershipRepository,
    private readonly auditLog: InMemoryAuditLogWriter,
    structure: Partial<StructureRepositories> = {},
  ) {
    this.tenants = structure.tenants ?? new InMemoryTenantRepository();
    this.venues = structure.venues ??
      new InMemoryStructureRepository<Venue>("venue");
    this.categories = structure.categories ??
      new InMemoryStructureRepository<Category>("category");
    this.groups = structure.groups ??
      new InMemoryStructureRepository<Group>("group");
  }

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const snapshots = {
      memberships: this.memberships.snapshot(),
      entries: this.auditLog.snapshot(),
      tenants: this.tenants.snapshot(),
      venues: this.venues.snapshot(),
      categories: this.categories.snapshot(),
      groups: this.groups.snapshot(),
    };
    try {
      return await work({
        memberships: this.memberships,
        auditLog: this.auditLog,
        tenants: this.tenants,
        venues: this.venues,
        categories: this.categories,
        groups: this.groups,
      });
    } catch (error) {
      this.memberships.restore(snapshots.memberships);
      this.auditLog.restore(snapshots.entries);
      this.tenants.restore(snapshots.tenants);
      this.venues.restore(snapshots.venues);
      this.categories.restore(snapshots.categories);
      this.groups.restore(snapshots.groups);
      throw error;
    }
  }
}
