import type {Player} from "../domain/player.js";

export interface PlayerRepository {
  newId(): string;
  get(tenantId: string, id: string): Promise<Player | null>;
  save(player: Player): Promise<void>;
  findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Player | null>;
  findByNameAndBirthDate(
    tenantId: string,
    nameKey: string,
    birthDate: string,
  ): Promise<Player[]>;
  listByGuardian(tenantId: string, guardianId: string): Promise<Player[]>;
}
