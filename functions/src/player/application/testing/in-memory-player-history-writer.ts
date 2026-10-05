import type {PlayerHistoryEntry} from "../../domain/player.js";
import type {Clock} from "../../../shared/domain/clock.js";
import type {PlayerHistoryWriter} from "../player-history-writer.js";

export type StoredHistoryEntry = PlayerHistoryEntry & {
  tenantId: string;
  playerId: string;
};

export class InMemoryPlayerHistoryWriter implements PlayerHistoryWriter {
  entries: StoredHistoryEntry[] = [];
  // Set to simulate a failing history write.
  failWith: Error | null = null;
  private sequence = 0;

  constructor(private readonly clock: Clock) {}

  async append(
    tenantId: string,
    playerId: string,
    entry: Omit<PlayerHistoryEntry, "id" | "at">,
  ): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sequence += 1;
    this.entries.push({
      ...structuredClone(entry),
      id: `history-${this.sequence}`,
      at: this.clock.now(),
      tenantId,
      playerId,
    });
  }

  entriesOf(tenantId: string, playerId: string): StoredHistoryEntry[] {
    return this.entries.filter(
      (entry) => entry.tenantId === tenantId && entry.playerId === playerId,
    );
  }

  snapshot(): StoredHistoryEntry[] {
    return structuredClone(this.entries);
  }

  restore(snapshot: StoredHistoryEntry[]): void {
    this.entries = structuredClone(snapshot);
  }
}
