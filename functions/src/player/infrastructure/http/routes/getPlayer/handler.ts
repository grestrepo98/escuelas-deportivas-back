import type {RequestHandler} from "express";
import {GetPlayer} from "../../../../application/get-player.js";
import type {Player} from "../../../../domain/player.js";
import type {TeacherPlayerView} from "../../../../domain/player-visibility.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {noQuery} from "../../common-schema.js";
import {getPlayerOutput, type GetPlayerOutput} from "./schema.js";

// The restricted keys are copied only when the record has them, so the
// teacher's record carries none of them. Internal keys (nameKey, documentKey,
// guardianIds, tenantId) never leave.
function toDto(view: Player | TeacherPlayerView): GetPlayerOutput {
  return {
    id: view.id,
    firstNames: view.firstNames,
    lastNames: view.lastNames,
    ...("document" in view && {document: view.document}),
    birthDate: view.birthDate,
    groupId: view.groupId,
    venueId: view.venueId,
    categoryId: view.categoryId,
    status: view.status,
    statusReason: view.statusReason,
    joinedAt: view.joinedAt.toISOString(),
    emergencyContact: view.emergencyContact,
    medical: view.medical,
    ...("guardians" in view && {guardians: view.guardians}),
    ...("dataConsent" in view && {
      dataConsent: view.dataConsent && {
        guardianId: view.dataConsent.guardianId,
        recordedBy: view.dataConsent.recordedBy,
        at: view.dataConsent.at.toISOString(),
      },
    }),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export const getPlayerRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  parseInput(noQuery, req.query);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const {player} = await new GetPlayer(new FirestoreUnitOfWork(db)).execute({
    tenantId,
    actorUid,
    playerId,
  });
  res.json(getPlayerOutput.parse(toDto(player)));
};
