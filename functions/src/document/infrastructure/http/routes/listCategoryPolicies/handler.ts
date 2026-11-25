import type {RequestHandler} from "express";
import {ListCategoryPolicies} from "../../../../application/list-category-policies.js";
import {FirestorePlayerReader} from "../../../firestore/firestore-player-reader.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {noQuery} from "../../common-schema.js";
import {listCategoryPoliciesOutput} from "./schema.js";

export const listCategoryPoliciesRoute: RequestHandler<{
  tenantId: string;
  categoryId: string;
}> = async (req, res) => {
  const actorUid = requireUid(res.locals.uid);
  parseInput(noQuery, req.query);
  const {tenantId, categoryId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new ListCategoryPolicies(
    new FirestoreUnitOfWork(db),
    new FirestorePlayerReader(db),
    systemClock,
  ).execute({tenantId, categoryId, actorUid});
  res.json(listCategoryPoliciesOutput.parse(result));
};
