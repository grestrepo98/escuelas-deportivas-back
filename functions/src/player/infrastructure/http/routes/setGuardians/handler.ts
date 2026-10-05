import type {RequestHandler} from "express";
import {SetPlayerGuardians} from "../../../../application/set-player-guardians.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {setGuardiansInput, setGuardiansOutput} from "./schema.js";

export const setGuardiansRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(setGuardiansInput, req.body);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SetPlayerGuardians(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({...input, tenantId, playerId, actorUid, device: deviceOf(req)});
  res.json(setGuardiansOutput.parse(result));
};
