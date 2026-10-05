import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {ContactPreference, Guardian} from "../domain/guardian.js";
import {documentKey} from "../domain/normalize.js";
import type {PersonDocument} from "../domain/player.js";
import {canSeeGuardian} from "../domain/player-visibility.js";
import {validateRequiredText} from "../domain/validation.js";
import {requireStaff} from "./require-staff.js";
import {guardianFullName} from "./resolve-guardian-links.js";

// A full replacement of the guardian's data.
export type UpdateGuardianInput = {
  tenantId: string;
  actorUid: string;
  guardianId: string;
  firstNames: string;
  lastNames: string;
  document: PersonDocument;
  phone: string;
  email?: string | null;
  preferredContact: ContactPreference;
  device?: {userAgent?: string};
};

export type UpdateGuardianResult = {guardianId: string};

const snapshot = (guardian: Guardian): Record<string, unknown> => ({
  firstNames: guardian.firstNames,
  lastNames: guardian.lastNames,
});

export class UpdateGuardian {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: UpdateGuardianInput): Promise<UpdateGuardianResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(
      async ({memberships, players, guardians, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        const existing = await guardians.get(tenantId, input.guardianId);
        if (!existing) {
          throw new DomainError("not_found", "Guardian not found");
        }
        const linked = await players.listByGuardian(tenantId, existing.id);
        if (!canSeeGuardian(actor, linked)) {
          throw new DomainError(
            "permission_denied",
            "This guardian has no player in your venues",
          );
        }

        const now = this.clock.now();
        const firstNames = validateRequiredText(input.firstNames, "firstNames");
        const lastNames = validateRequiredText(input.lastNames, "lastNames");
        const phone = validateRequiredText(input.phone, "phone");
        const key = documentKey(input.document);
        if (key !== existing.documentKey) {
          const clash = await guardians.findByDocumentKey(tenantId, key);
          if (clash && clash.id !== existing.id) {
            throw new DomainError(
              "failed_precondition",
              "A guardian with that document already exists",
              {guardianId: clash.id},
            );
          }
        }

        const saved: Guardian = {
          ...existing,
          firstNames,
          lastNames,
          document: input.document,
          documentKey: key,
          phone,
          email: input.email ?? null,
          preferredContact: input.preferredContact,
          updatedAt: now,
        };
        await guardians.save(saved);

        // The players keep a copy of the full name for the light index.
        const fullName = guardianFullName(saved);
        if (fullName !== guardianFullName(existing)) {
          for (const player of linked) {
            await players.save({
              ...player,
              guardians: player.guardians.map((link) =>
                link.guardianId === saved.id ? {...link, fullName} : link,
              ),
              updatedAt: now,
            });
          }
        }

        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "guardian.updated",
          target: {type: "guardian", id: saved.id},
          before: snapshot(existing),
          after: snapshot(saved),
          device: input.device ?? {},
        });

        return {guardianId: saved.id};
      },
    );
  }
}
