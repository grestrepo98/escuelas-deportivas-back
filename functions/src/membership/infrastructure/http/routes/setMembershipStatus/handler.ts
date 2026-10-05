import type {RequestHandler} from "express";
import {SetMembershipStatus} from "../../../../application/set-membership-status.js";
import {AllowAllDeactivationGuard} from "../../../../application/testing/allow-all-deactivation-guard.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {authorizeTenantMember, requireUid} from "../../../authorize.js";
import {setMembershipStatusInput, setMembershipStatusOutput} from "./schema.js";

export const setMembershipStatus: RequestHandler<{
  tenantId: string;
  uid: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const {status, reason} = parseInput(setMembershipStatusInput, req.body);
  const {tenantId, uid: targetUid} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  // C21: phase 2 swaps in the guard that checks the open cash register.
  const result = await new SetMembershipStatus(
    new FirestoreUnitOfWork(db),
    new AllowAllDeactivationGuard(),
    systemClock,
  ).execute({
    tenantId,
    actorUid,
    targetUid,
    status,
    reason,
    device: deviceOf(req),
  });
  res.json(setMembershipStatusOutput.parse(result));
};
