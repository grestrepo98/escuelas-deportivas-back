import type {RequestHandler} from "express";
import {listPlayers} from "../../../firestore/player-list-query.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {listPlayersOutput, listPlayersQuery} from "./schema.js";

export const listPlayersRoute: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const uid = requireUid(res.locals.uid);
  const query = parseInput(listPlayersQuery, req.query);
  const {tenantId} = req.params;

  const db = firestore();
  const membership = await authorizeTenantMember(db, uid, tenantId);

  const result = await listPlayers(db, tenantId, membership, query);
  res.json(listPlayersOutput.parse(result));
};
