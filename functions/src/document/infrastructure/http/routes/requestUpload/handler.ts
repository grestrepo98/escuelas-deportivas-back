import type {RequestHandler} from "express";
import {RequestUpload} from "../../../../application/request-upload.js";
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
import {requestUploadInput, requestUploadOutput} from "./schema.js";

export const requestUploadRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(requestUploadInput, req.body);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const ticket = await new RequestUpload(
    new FirestoreUnitOfWork(db),
    new FirestorePlayerReader(db),
    createFileStorage(),
    systemClock,
  ).execute({...input, tenantId, playerId, actorUid, device: deviceOf(req)});
  res.status(201).json(
    requestUploadOutput.parse({
      ...ticket,
      expiresAt: ticket.expiresAt.toISOString(),
    }),
  );
};
