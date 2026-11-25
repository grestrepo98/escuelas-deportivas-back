import type {DocumentType, PlayerDocument} from "../domain/document.js";

export interface DocumentRepository {
  newId(): string;
  get(tenantId: string, id: string): Promise<PlayerDocument | null>;
  save(document: PlayerDocument): Promise<void>;
  findCurrent(
    tenantId: string,
    playerId: string,
    type: DocumentType,
  ): Promise<PlayerDocument | null>;
  // Newest first.
  listByPlayer(
    tenantId: string,
    playerId: string,
    options: {includeSuperseded: boolean},
  ): Promise<PlayerDocument[]>;
  listCurrentPolicies(
    tenantId: string,
    playerIds: string[],
  ): Promise<PlayerDocument[]>;
}
