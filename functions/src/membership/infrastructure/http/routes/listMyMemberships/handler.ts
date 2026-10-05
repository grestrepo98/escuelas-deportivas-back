import type {RequestHandler} from "express";
import {findMyMemberships} from "../../../firestore/my-memberships-query.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {requireUid} from "../../../authorize.js";
import {listMyMembershipsOutput} from "./schema.js";

export const listMyMemberships: RequestHandler = async (_req, res) => {
  const uid = requireUid(res.locals.uid);
  const memberships = await findMyMemberships(firestore(), uid);
  res.json(listMyMembershipsOutput.parse({memberships}));
};
