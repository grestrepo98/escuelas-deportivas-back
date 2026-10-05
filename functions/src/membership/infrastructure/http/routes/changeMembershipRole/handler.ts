import type {RequestHandler} from "express";
import {
  ChangeMembershipRole,
} from "../../../../application/change-membership-role.js";
import {
  FirestoreUnitOfWork,
} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {
  systemClock,
} from "../../../../../shared/infrastructure/system-clock.js";
import {authorizeTenantMember, requireUid} from "../../../authorize.js";
import {changeMembershipRoleInput, changeMembershipRoleOutput} from "./schema.js";

export const changeMembershipRole: RequestHandler<
  {tenantId: string; uid: string}
> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const {newRole, reason} = parseInput(changeMembershipRoleInput, req.body);
  const {tenantId, uid: targetUid} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new ChangeMembershipRole(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({
    tenantId,
    actorUid,
    targetUid,
    newRole,
    reason,
    device: deviceOf(req),
  });
  res.json(changeMembershipRoleOutput.parse(result));
};
