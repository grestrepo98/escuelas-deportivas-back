import type {DocumentType, PlayerDocument} from "../../domain/document.js";
import type {DocumentRepository} from "../document-repository.js";

export class InMemoryDocumentRepository implements DocumentRepository {
  private items = new Map<string, PlayerDocument>();
  private sequence = 0;

  newId(): string {
    this.sequence += 1;
    return `generated-document-${this.sequence}`;
  }

  async get(tenantId: string, id: string): Promise<PlayerDocument | null> {
    const found = this.items.get(this.key(tenantId, id));
    return found ? structuredClone(found) : null;
  }

  async save(document: PlayerDocument): Promise<void> {
    this.items.set(
      this.key(document.tenantId, document.id),
      structuredClone(document),
    );
  }

  async findCurrent(
    tenantId: string,
    playerId: string,
    type: DocumentType,
  ): Promise<PlayerDocument | null> {
    const found = this.inTenant(tenantId).find(
      (document) =>
        document.playerId === playerId &&
        document.type === type &&
        document.status === "current",
    );
    return found ? structuredClone(found) : null;
  }

  async listByPlayer(
    tenantId: string,
    playerId: string,
    options: {includeSuperseded: boolean},
  ): Promise<PlayerDocument[]> {
    return this.inTenant(tenantId)
      .filter(
        (document) =>
          document.playerId === playerId &&
          (options.includeSuperseded || document.status === "current"),
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((document) => structuredClone(document));
  }

  async listCurrentPolicies(
    tenantId: string,
    playerIds: string[],
  ): Promise<PlayerDocument[]> {
    return this.inTenant(tenantId)
      .filter(
        (document) =>
          document.type === "policy" &&
          document.status === "current" &&
          playerIds.includes(document.playerId),
      )
      .map((document) => structuredClone(document));
  }

  snapshot(): Map<string, PlayerDocument> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, PlayerDocument>): void {
    this.items = structuredClone(snapshot);
  }

  private inTenant(tenantId: string): PlayerDocument[] {
    return [...this.items.values()].filter(
      (document) => document.tenantId === tenantId,
    );
  }

  private key(tenantId: string, id: string): string {
    return `${tenantId}/${id}`;
  }
}
