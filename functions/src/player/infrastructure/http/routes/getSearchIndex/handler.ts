import type {RequestHandler} from "express";
import {readPlayerSearchIndex} from "../../../firestore/player-search-index-query.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {noQuery} from "../../common-schema.js";
import {getSearchIndexOutput} from "./schema.js";

export const getSearchIndexRoute: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const uid = requireUid(res.locals.uid);
  parseInput(noQuery, req.query);
  const {tenantId} = req.params;

  const db = firestore();
  const membership = await authorizeTenantMember(db, uid, tenantId);

  const result = await readPlayerSearchIndex(db, tenantId, membership);
  res.json(getSearchIndexOutput.parse(result));
};
