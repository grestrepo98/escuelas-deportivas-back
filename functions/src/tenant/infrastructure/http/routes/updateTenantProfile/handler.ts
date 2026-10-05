import type {RequestHandler} from "express";
import {
  UpdateTenantProfile,
} from "../../../../application/update-tenant-profile.js";
import {
  FirestoreUnitOfWork,
} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {
  systemClock,
} from "../../../../../shared/infrastructure/system-clock.js";
import {updateTenantProfileInput, updateTenantProfileOutput} from "./schema.js";

export const updateTenantProfile: RequestHandler<
  {tenantId: string}
> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(updateTenantProfileInput, req.body);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new UpdateTenantProfile(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, actorUid, device: deviceOf(req)});
  res.json(updateTenantProfileOutput.parse(result));
};
