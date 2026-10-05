import type {RequestHandler} from "express";
import {FindGuardian} from "../../../../application/find-guardian.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {findGuardianOutput, findGuardianQuery} from "./schema.js";

export const findGuardianRoute: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const actorUid = requireUid(res.locals.uid);
  const query = parseInput(findGuardianQuery, req.query);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const {guardian} = await new FindGuardian(
    new FirestoreUnitOfWork(db),
  ).execute({tenantId, actorUid, ...query});
  res.json(
    findGuardianOutput.parse({
      guardian: guardian && {
        ...guardian,
        createdAt: guardian.createdAt.toISOString(),
        updatedAt: guardian.updatedAt.toISOString(),
      },
    }),
  );
};
