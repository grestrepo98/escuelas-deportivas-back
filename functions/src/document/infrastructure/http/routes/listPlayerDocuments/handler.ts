import type {RequestHandler} from "express";
import {ListPlayerDocuments} from "../../../../application/list-player-documents.js";
import {FirestorePlayerReader} from "../../../firestore/firestore-player-reader.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {toDocumentDto} from "../../common-schema.js";
import {listPlayerDocumentsOutput, listPlayerDocumentsQuery} from "./schema.js";

export const listPlayerDocumentsRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const query = parseInput(listPlayerDocumentsQuery, req.query);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new ListPlayerDocuments(
    new FirestoreUnitOfWork(db),
    new FirestorePlayerReader(db),
    systemClock,
  ).execute({
    tenantId,
    playerId,
    actorUid,
    history: query.history === "true",
  });
  res.json(
    listPlayerDocumentsOutput.parse({
      documents: result.documents.map(toDocumentDto),
      policyStatus: result.policyStatus,
    }),
  );
};
