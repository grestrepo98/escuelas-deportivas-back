import type {RequestHandler} from "express";
import {GetDownloadUrl} from "../../../../application/get-download-url.js";
import {FirestorePlayerReader} from "../../../firestore/firestore-player-reader.js";
import {createFileStorage} from "../../../storage/create-file-storage.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {noQuery} from "../../common-schema.js";
import {getDownloadUrlOutput} from "./schema.js";

export const getDownloadUrlRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
  documentId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  parseInput(noQuery, req.query);
  const {tenantId, playerId, documentId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const link = await new GetDownloadUrl(
    new FirestoreUnitOfWork(db),
    new FirestorePlayerReader(db),
    createFileStorage(),
    systemClock,
  ).execute({tenantId, playerId, documentId, actorUid});
  res.json(
    getDownloadUrlOutput.parse({
      url: link.url,
      expiresAt: link.expiresAt.toISOString(),
    }),
  );
};
