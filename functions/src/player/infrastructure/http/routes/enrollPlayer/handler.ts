import type {RequestHandler} from "express";
import {EnrollPlayer} from "../../../../application/enroll-player.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {enrollPlayerInput, enrollPlayerOutput} from "./schema.js";

export const enrollPlayerRoute: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(enrollPlayerInput, req.body);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new EnrollPlayer(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, actorUid, device: deviceOf(req)});
  res.status(201).json(enrollPlayerOutput.parse(result));
};
