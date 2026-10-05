import {DomainError} from "../../shared/domain/errors.js";
import type {Membership} from "../../membership/domain/membership.js";
import type {Player} from "../domain/player.js";
import {assertCanWriteInVenue} from "../domain/player-visibility.js";
import type {PlayerRepository} from "./player-repository.js";

// Loads a player of the tenant and proves the actor may write in its venue.
export async function loadWritablePlayer(
  players: PlayerRepository,
  actor: Membership,
  tenantId: string,
  playerId: string,
): Promise<Player> {
  const player = await players.get(tenantId, playerId);
  if (!player) {
    throw new DomainError("not_found", "Player not found");
  }
  assertCanWriteInVenue(actor, player.venueId);
  return player;
}
