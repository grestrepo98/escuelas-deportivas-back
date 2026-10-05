import type {RequestHandler} from "express";
import {SetMembershipScope} from "../../../../application/set-membership-scope.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {authorizeTenantMember, requireUid} from "../../../authorize.js";
import {setMembershipScopeInput, setMembershipScopeOutput} from "./schema.js";

export const setMembershipScope: RequestHandler<{
  tenantId: string;
  uid: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const {scope} = parseInput(setMembershipScopeInput, req.body);
  const {tenantId, uid: targetUid} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SetMembershipScope(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({
    tenantId,
    actorUid,
    targetUid,
    scope,
    device: deviceOf(req),
  });
  res.json(setMembershipScopeOutput.parse(result));
};
