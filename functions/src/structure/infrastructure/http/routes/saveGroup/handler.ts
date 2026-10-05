import type {RequestHandler} from "express";
import {SaveGroup} from "../../../../application/save-group.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {createGroupInput, saveGroupOutput, updateGroupInput} from "./schema.js";

export const createGroup: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(createGroupInput, req.body);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SaveGroup(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, actorUid, device: deviceOf(req)});
  res.status(201).json(saveGroupOutput.parse(result));
};

// The venue of an existing group is never sent: the use case keeps it.
export const updateGroup: RequestHandler<{
  tenantId: string;
  groupId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(updateGroupInput, req.body);
  const {tenantId, groupId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SaveGroup(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, groupId, actorUid, device: deviceOf(req)});
  res.json(saveGroupOutput.parse(result));
};
