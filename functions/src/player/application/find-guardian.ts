import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import type {Guardian} from "../domain/guardian.js";
import {documentKey} from "../domain/normalize.js";
import type {DocumentType} from "../domain/player.js";
import {canSeeGuardian} from "../domain/player-visibility.js";
import {requireStaff} from "./require-staff.js";

export type FindGuardianInput = {
  tenantId: string;
  actorUid: string;
  documentType: DocumentType;
  documentNumber: string;
};

export type FindGuardianResult = {guardian: Guardian | null};

// A coordinator only finds guardians linked to a player of their venues; for
// any other guardian the answer is "none", so it does not reveal who exists in
// the rest of the organization (the enroll route answers 409 with the id).
export class FindGuardian {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  execute(input: FindGuardianInput): Promise<FindGuardianResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, players, guardians}) => {
      const actor = await requireStaff(memberships, tenantId, actorUid);
      const guardian = await guardians.findByDocumentKey(
        tenantId,
        documentKey({type: input.documentType, number: input.documentNumber}),
      );
      if (!guardian) {
        return {guardian: null};
      }
      const linked =
        actor.role === "coordinator"
          ? await players.listByGuardian(tenantId, guardian.id)
          : [];
      return {guardian: canSeeGuardian(actor, linked) ? guardian : null};
    });
  }
}
