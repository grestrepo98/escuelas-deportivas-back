import type {RequestHandler} from "express";
import {SetVenueStatus} from "../../../../application/set-venue-status.js";
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
import {setVenueStatusInput, setVenueStatusOutput} from "./schema.js";

export const setVenueStatus: RequestHandler<
  {tenantId: string; venueId: string}
> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(setVenueStatusInput, req.body);
  const {tenantId, venueId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SetVenueStatus(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, venueId, actorUid, device: deviceOf(req)});
  res.json(setVenueStatusOutput.parse(result));
};
