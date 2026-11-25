import type {RequestHandler} from "express";
import {RecordDocument} from "../../../../application/record-document.js";
import {FirestorePlayerReader} from "../../../firestore/firestore-player-reader.js";
import {createFileStorage} from "../../../storage/create-file-storage.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {toDocumentDto} from "../../common-schema.js";
import {recordDocumentInput, recordDocumentOutput} from "./schema.js";

export const recordDocumentRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(recordDocumentInput, req.body);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new RecordDocument(
    new FirestoreUnitOfWork(db),
    new FirestorePlayerReader(db),
    createFileStorage(),
    systemClock,
  ).execute({...input, tenantId, playerId, actorUid, device: deviceOf(req)});
  res.status(201).json(
    recordDocumentOutput.parse({
      document: toDocumentDto(result.document),
      ...(result.policyStatus && {policyStatus: result.policyStatus}),
    }),
  );
};
