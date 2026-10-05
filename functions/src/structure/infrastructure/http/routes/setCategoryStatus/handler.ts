import type {RequestHandler} from "express";
import {
  SetCategoryStatus,
} from "../../../../application/set-category-status.js";
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
import {setCategoryStatusInput, setCategoryStatusOutput} from "./schema.js";

export const setCategoryStatus: RequestHandler<
  {tenantId: string; categoryId: string}
> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(setCategoryStatusInput, req.body);
  const {tenantId, categoryId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SetCategoryStatus(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({
    ...input,
    tenantId,
    categoryId,
    actorUid,
    device: deviceOf(req),
  });
  res.json(setCategoryStatusOutput.parse(result));
};
