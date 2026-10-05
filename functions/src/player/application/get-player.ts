import {DomainError} from "../../shared/domain/errors.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {isActiveMembershipOf} from "../../membership/domain/membership.js";
import type {Player} from "../domain/player.js";
import {
  playerViewFor,
  type TeacherPlayerView,
} from "../domain/player-visibility.js";

export type GetPlayerInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
};

export type GetPlayerResult = {player: Player | TeacherPlayerView};

// Staff read the full record in their scope; a teacher reads their groups
// without the document, guardians or consent. The families do not read
// players through this route yet.
const READER_ROLES = ["owner", "accountant", "coordinator", "teacher"];

export class GetPlayer {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  execute(input: GetPlayerInput): Promise<GetPlayerResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, players}) => {
      const actor = await memberships.get(actorUid, tenantId);
      if (
        !isActiveMembershipOf(actor, tenantId) ||
        actor == null ||
        !READER_ROLES.includes(actor.role)
      ) {
        throw new DomainError(
          "permission_denied",
          "This role cannot read players",
        );
      }

      const player = await players.get(tenantId, input.playerId);
      if (!player) {
        throw new DomainError("not_found", "Player not found");
      }
      return {player: playerViewFor(actor, player)};
    });
  }
}
