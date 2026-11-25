// What the document module needs to know about a player: where they are, to
// apply the caller's scope, without importing the player module.
export type PlayerRef = {
  id: string;
  fullName: string;
  venueId: string;
  groupId: string;
  categoryId: string;
};

export interface PlayerReader {
  get(tenantId: string, playerId: string): Promise<PlayerRef | null>;
  listByCategory(tenantId: string, categoryId: string): Promise<PlayerRef[]>;
}
