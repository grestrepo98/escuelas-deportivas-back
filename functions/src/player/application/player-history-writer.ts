import type {PlayerHistoryEntry} from "../domain/player.js";

// Create-only, like the audit log. The adapter assigns `id` and `at`.
export interface PlayerHistoryWriter {
  append(
    tenantId: string,
    playerId: string,
    entry: Omit<PlayerHistoryEntry, "id" | "at">,
  ): Promise<void>;
}
