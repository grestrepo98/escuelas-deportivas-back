import {Router} from "express";
import {changeMembershipRole} from "./routes/changeMembershipRole/handler.js";
import {listMyMemberships} from "./routes/listMyMemberships/handler.js";

export function membershipRouter(): Router {
  const router = Router();
  router.get("/me/memberships", listMyMemberships);
  router.patch(
    "/tenants/:tenantId/memberships/:uid/role",
    changeMembershipRole,
  );
  return router;
}
