import type {PlayerReader, PlayerRef} from "../player-reader.js";

export class InMemoryPlayerReader implements PlayerReader {
  private items = new Map<string, PlayerRef>();

  add(tenantId: string, player: PlayerRef): void {
    this.items.set(`${tenantId}/${player.id}`, structuredClone(player));
  }

  async get(tenantId: string, playerId: string): Promise<PlayerRef | null> {
    const found = this.items.get(`${tenantId}/${playerId}`);
    return found ? structuredClone(found) : null;
  }

  async listByCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<PlayerRef[]> {
    return [...this.items.entries()]
      .filter(
        ([key, player]) =>
          key.startsWith(`${tenantId}/`) && player.categoryId === categoryId,
      )
      .map(([, player]) => structuredClone(player));
  }
}
