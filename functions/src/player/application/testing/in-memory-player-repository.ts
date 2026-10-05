import type {Player} from "../../domain/player.js";
import type {PlayerRepository} from "../player-repository.js";

export class InMemoryPlayerRepository implements PlayerRepository {
  private items = new Map<string, Player>();
  private sequence = 0;

  newId(): string {
    this.sequence += 1;
    return `generated-player-${this.sequence}`;
  }

  async get(tenantId: string, id: string): Promise<Player | null> {
    const found = this.items.get(this.key(tenantId, id));
    return found ? structuredClone(found) : null;
  }

  async save(player: Player): Promise<void> {
    this.items.set(
      this.key(player.tenantId, player.id),
      structuredClone(player),
    );
  }

  async findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Player | null> {
    const found = this.inTenant(tenantId).find(
      (player) => player.documentKey === documentKey,
    );
    return found ? structuredClone(found) : null;
  }

  async findByNameAndBirthDate(
    tenantId: string,
    nameKey: string,
    birthDate: string,
  ): Promise<Player[]> {
    return this.inTenant(tenantId)
      .filter(
        (player) =>
          player.nameKey === nameKey && player.birthDate === birthDate,
      )
      .map((player) => structuredClone(player));
  }

  async listByGuardian(
    tenantId: string,
    guardianId: string,
  ): Promise<Player[]> {
    return this.inTenant(tenantId)
      .filter((player) => player.guardianIds.includes(guardianId))
      .map((player) => structuredClone(player));
  }

  snapshot(): Map<string, Player> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, Player>): void {
    this.items = structuredClone(snapshot);
  }

  private inTenant(tenantId: string): Player[] {
    return [...this.items.values()].filter(
      (player) => player.tenantId === tenantId,
    );
  }

  private key(tenantId: string, id: string): string {
    return `${tenantId}/${id}`;
  }
}
