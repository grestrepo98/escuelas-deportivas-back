import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {documentKey, nameKey} from "../domain/normalize.js";
import type {PersonDocument, Player} from "../domain/player.js";
import {assertCanWriteInVenue} from "../domain/player-visibility.js";
import {validateBirthDate, validateRequiredText} from "../domain/validation.js";
import {requireStaff} from "./require-staff.js";
import {
  resolveGuardianLinks,
  type GuardianLinkInput,
} from "./resolve-guardian-links.js";

export type EnrollPlayerInput = {
  tenantId: string;
  actorUid: string;
  firstNames: string;
  lastNames: string;
  document?: PersonDocument;
  birthDate: string;
  groupId: string;
  emergencyContact: {name: string; phone: string; relationship: string};
  medical?: Player["medical"];
  guardians: GuardianLinkInput[];
  confirmDuplicate?: boolean;
  device?: {userAgent?: string};
};

export type EnrollPlayerResult = {
  playerId: string;
  status: "preinscrito";
  createdGuardianIds: string[];
};

export class EnrollPlayer {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: EnrollPlayerInput): Promise<EnrollPlayerResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, groups, players, guardians, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);

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

        const group = await groups.get(tenantId, input.groupId);
        if (!group) {
          throw new DomainError("not_found", "Group not found");
        }
        assertCanWriteInVenue(actor, group.venueId);
        if (group.status !== "active") {
          throw new DomainError("failed_precondition", "The group is closed");
        }

        const playerDocumentKey = input.document
          ? documentKey(input.document)
          : null;
        if (playerDocumentKey) {
          const clash = await players.findByDocumentKey(
            tenantId,
            playerDocumentKey,
          );
          if (clash) {
            throw new DomainError(
              "failed_precondition",
              "A player with that document already exists",
              {playerId: clash.id},
            );
          }
        }

        const key = nameKey(firstNames, lastNames);
        if (!input.confirmDuplicate) {
          const candidates = await players.findByNameAndBirthDate(
            tenantId,
            key,
            birthDate,
          );
          if (candidates.length > 0) {
            throw new DomainError(
              "failed_precondition",
              "A player with the same name and birth date already exists",
              {
                duplicateCandidates: candidates.map((candidate) => ({
                  playerId: candidate.id,
                  firstNames: candidate.firstNames,
                  lastNames: candidate.lastNames,
                  birthDate: candidate.birthDate,
                  status: candidate.status,
                })),
              },
            );
          }
        }

        const {links, created} = await resolveGuardianLinks(
          guardians,
          tenantId,
          input.guardians,
          now,
        );

        const player: Player = {
          id: players.newId(),
          tenantId,
          firstNames,
          lastNames,
          nameKey: key,
          document: input.document ?? null,
          documentKey: playerDocumentKey,
          birthDate,
          groupId: group.id,
          venueId: group.venueId,
          categoryId: group.categoryId,
          status: "preinscrito",
          statusReason: null,
          joinedAt: now,
          emergencyContact,
          medical: input.medical ?? {},
          guardians: links,
          guardianIds: links.map((link) => link.guardianId),
          dataConsent: null,
          createdAt: now,
          updatedAt: now,
        };

        for (const guardian of created) {
          await guardians.save(guardian);
          await auditLog.append({
            tenantId,
            actorUid,
            actorRole: actor.role,
            action: "guardian.created",
            target: {type: "guardian", id: guardian.id},
            before: {},
            after: {
              firstNames: guardian.firstNames,
              lastNames: guardian.lastNames,
            },
            device: input.device ?? {},
          });
        }

        await players.save(player);
        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "player.created",
          target: {type: "player", id: player.id},
          before: {},
          after: {
            firstNames: player.firstNames,
            lastNames: player.lastNames,
            groupId: player.groupId,
            venueId: player.venueId,
            categoryId: player.categoryId,
            status: player.status,
            guardianIds: player.guardianIds,
          },
          device: input.device ?? {},
        });

        return {
          playerId: player.id,
          status: "preinscrito",
          createdGuardianIds: created.map((guardian) => guardian.id),
        };
      },
    );
  }
}
