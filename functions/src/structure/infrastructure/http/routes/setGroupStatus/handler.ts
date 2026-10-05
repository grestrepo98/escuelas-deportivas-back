import type {RequestHandler} from "express";
import {SetGroupStatus} from "../../../../application/set-group-status.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {setGroupStatusInput, setGroupStatusOutput} from "./schema.js";

export const setGroupStatus: RequestHandler<{
  tenantId: string;
  groupId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(setGroupStatusInput, req.body);
  const {tenantId, groupId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SetGroupStatus(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, groupId, actorUid, device: deviceOf(req)});
  res.json(setGroupStatusOutput.parse(result));
};
