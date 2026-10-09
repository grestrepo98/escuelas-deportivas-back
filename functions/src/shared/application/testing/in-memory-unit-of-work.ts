import type {
  Category,
  Group,
  Venue,
} from "../../../structure/domain/structure.js";
import type {TransactionContext, UnitOfWork} from "../unit-of-work.js";
import type {InMemoryAuditLogWriter} from "../../../audit/application/testing/in-memory-audit-log-writer.js";
import type {InMemoryMembershipRepository} from "../../../membership/application/testing/in-memory-membership-repository.js";
import {InMemoryDocumentRepository} from "../../../document/application/testing/in-memory-document-repository.js";
import {FakeClock} from "./fake-clock.js";
import {InMemoryGuardianRepository} from "../../../player/application/testing/in-memory-guardian-repository.js";
import {InMemoryPlayerHistoryWriter} from "../../../player/application/testing/in-memory-player-history-writer.js";
import {InMemoryPlayerRepository} from "../../../player/application/testing/in-memory-player-repository.js";
import {InMemoryStructureRepository} from "../../../structure/application/testing/in-memory-structure-repository.js";
import {InMemoryTenantRepository} from "../../../tenant/application/testing/in-memory-tenant-repository.js";

type OptionalRepositories = {
  tenants: InMemoryTenantRepository;
  venues: InMemoryStructureRepository<Venue>;
  categories: InMemoryStructureRepository<Category>;
  groups: InMemoryStructureRepository<Group>;
  players: InMemoryPlayerRepository;
  guardians: InMemoryGuardianRepository;
  playerHistory: InMemoryPlayerHistoryWriter;
  documents: InMemoryDocumentRepository;
};

// Snapshot-and-restore transaction: all-or-nothing, like the real adapter.
export class InMemoryUnitOfWork implements UnitOfWork {
  readonly tenants: InMemoryTenantRepository;
  readonly venues: InMemoryStructureRepository<Venue>;
  readonly categories: InMemoryStructureRepository<Category>;
  readonly groups: InMemoryStructureRepository<Group>;
  readonly players: InMemoryPlayerRepository;
  readonly guardians: InMemoryGuardianRepository;
  readonly playerHistory: InMemoryPlayerHistoryWriter;
  readonly documents: InMemoryDocumentRepository;

  constructor(
    private readonly memberships: InMemoryMembershipRepository,
    private readonly auditLog: InMemoryAuditLogWriter,
    repositories: Partial<OptionalRepositories> = {},
  ) {
    this.tenants = repositories.tenants ?? new InMemoryTenantRepository();
    this.venues =
      repositories.venues ?? new InMemoryStructureRepository<Venue>("venue");
    this.categories =
      repositories.categories ??
      new InMemoryStructureRepository<Category>("category");
    this.groups =
      repositories.groups ?? new InMemoryStructureRepository<Group>("group");
    this.players = repositories.players ?? new InMemoryPlayerRepository();
    this.guardians = repositories.guardians ?? new InMemoryGuardianRepository();
    this.documents = repositories.documents ?? new InMemoryDocumentRepository();
    this.playerHistory =
      repositories.playerHistory ??
      new InMemoryPlayerHistoryWriter(
        new FakeClock(new Date("2026-10-04T12:00:00Z")),
      );
  }

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const snapshots = {
      memberships: this.memberships.snapshot(),
      entries: this.auditLog.snapshot(),
      tenants: this.tenants.snapshot(),
      venues: this.venues.snapshot(),
      categories: this.categories.snapshot(),
      groups: this.groups.snapshot(),
      players: this.players.snapshot(),
      guardians: this.guardians.snapshot(),
      history: this.playerHistory.snapshot(),
      documents: this.documents.snapshot(),
    };
    try {
      return await work({
        memberships: this.memberships,
        auditLog: this.auditLog,
        tenants: this.tenants,
        venues: this.venues,
        categories: this.categories,
        groups: this.groups,
        players: this.players,
        guardians: this.guardians,
        playerHistory: this.playerHistory,
        documents: this.documents,
      });
    } catch (error) {
      this.memberships.restore(snapshots.memberships);
      this.auditLog.restore(snapshots.entries);
      this.tenants.restore(snapshots.tenants);
      this.venues.restore(snapshots.venues);
      this.categories.restore(snapshots.categories);
      this.groups.restore(snapshots.groups);
      this.players.restore(snapshots.players);
      this.guardians.restore(snapshots.guardians);
      this.playerHistory.restore(snapshots.history);
      this.documents.restore(snapshots.documents);
      throw error;
    }
  }
}
