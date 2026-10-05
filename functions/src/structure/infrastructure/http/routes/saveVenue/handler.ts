import type {Request, RequestHandler, Response} from "express";
import {SaveVenue} from "../../../../application/save-venue.js";
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
import {
  saveVenueInput,
  saveVenueOutput,
  type SaveVenueOutput,
} from "./schema.js";

// Without a venueId the use case creates a venue.
async function save(
  req: Request,
  res: Response,
  tenantId: string,
  venueId?: string,
): Promise<SaveVenueOutput> {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(saveVenueInput, req.body);

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SaveVenue(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, venueId, actorUid, device: deviceOf(req)});
  return saveVenueOutput.parse(result);
}

export const createVenue: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  res.status(201).json(await save(req, res, req.params.tenantId));
};

export const updateVenue: RequestHandler<
  {tenantId: string; venueId: string}
> = async (req, res) => {
  const {tenantId, venueId} = req.params;
  res.json(await save(req, res, tenantId, venueId));
};
