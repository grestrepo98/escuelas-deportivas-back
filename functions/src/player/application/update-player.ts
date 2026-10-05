import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {documentKey, nameKey} from "../domain/normalize.js";
import type {PersonDocument, Player} from "../domain/player.js";
import {validateBirthDate, validateRequiredText} from "../domain/validation.js";
import {loadWritablePlayer} from "./load-writable-player.js";
import {requireStaff} from "./require-staff.js";

// A full replacement of the personal, emergency and medical data. Group,
// status and guardians have their own use cases.
export type UpdatePlayerInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  firstNames: string;
  lastNames: string;
  document?: PersonDocument | null;
  birthDate: string;
  emergencyContact: {name: string; phone: string; relationship: string};
  medical?: Player["medical"];
  device?: {userAgent?: string};
};

export type UpdatePlayerResult = {playerId: string};

const snapshot = (player: Player): Record<string, unknown> => ({
  firstNames: player.firstNames,
  lastNames: player.lastNames,
  birthDate: player.birthDate,
});

export class UpdatePlayer {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: UpdatePlayerInput): Promise<UpdatePlayerResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, players, auditLog}) => {
      const actor = await requireStaff(memberships, tenantId, actorUid);
      const existing = await loadWritablePlayer(
        players,
        actor,
        tenantId,
        input.playerId,
      );

      const now = this.clock.now();
      const firstNames = validateRequiredText(input.firstNames, "firstNames");
      const lastNames = validateRequiredText(input.lastNames, "lastNames");
      const birthDate = validateBirthDate(input.birthDate, now);
      const emergencyContact = {
        name: validateRequiredText(
          input.emergencyContact.name,
          "emergencyContact.name",
        ),
        phone: validateRequiredText(
          input.emergencyContact.phone,
          "emergencyContact.phone",
        ),
        relationship: validateRequiredText(
          input.emergencyContact.relationship,
          "emergencyContact.relationship",
        ),
      };

      const playerDocumentKey = input.document
        ? documentKey(input.document)
        : null;
      if (playerDocumentKey && playerDocumentKey !== existing.documentKey) {
        const clash = await players.findByDocumentKey(
          tenantId,
          playerDocumentKey,
        );
        if (clash && clash.id !== existing.id) {
          throw new DomainError(
            "failed_precondition",
            "A player with that document already exists",
            {playerId: clash.id},
          );
        }
      }

      const saved: Player = {
        ...existing,
        firstNames,
        lastNames,
        nameKey: nameKey(firstNames, lastNames),
        document: input.document ?? null,
        documentKey: playerDocumentKey,
        birthDate,
        emergencyContact,
        medical: input.medical ?? {},
        updatedAt: now,
      };
      await players.save(saved);

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole: actor.role,
        action: "player.updated",
        target: {type: "player", id: saved.id},
        before: snapshot(existing),
        after: snapshot(saved),
        device: input.device ?? {},
      });

      return {playerId: saved.id};
    });
  }
}
