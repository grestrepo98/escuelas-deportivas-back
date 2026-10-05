import type {RequestHandler} from "express";
import {RecordDataConsent} from "../../../../application/record-data-consent.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {recordConsentInput, recordConsentOutput} from "./schema.js";

export const recordConsentRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(recordConsentInput, req.body);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const {dataConsent, ...rest} = await new RecordDataConsent(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, playerId, actorUid, device: deviceOf(req)});
  res.json(
    recordConsentOutput.parse({
      ...rest,
      dataConsent: {...dataConsent, at: dataConsent.at.toISOString()},
    }),
  );
};
