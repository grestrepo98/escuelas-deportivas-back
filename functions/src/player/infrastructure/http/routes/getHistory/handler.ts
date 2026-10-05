import type {RequestHandler} from "express";
import {readPlayerHistory} from "../../../firestore/player-history-query.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {noQuery} from "../../common-schema.js";
import {getHistoryOutput} from "./schema.js";

export const getHistoryRoute: RequestHandler<{
  tenantId: string;
  playerId: string;
}> = async (req, res) => {
  const uid = requireUid(res.locals.uid);
  parseInput(noQuery, req.query);
  const {tenantId, playerId} = req.params;

  const db = firestore();
  const membership = await authorizeTenantMember(db, uid, tenantId);

  const {entries} = await readPlayerHistory(db, tenantId, membership, playerId);
  res.json(
    getHistoryOutput.parse({
      entries: entries.map((entry) => ({...entry, at: entry.at.toISOString()})),
    }),
  );
};
