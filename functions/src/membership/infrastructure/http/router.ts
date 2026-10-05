import {Router} from "express";
import {changeMembershipRole} from "./routes/changeMembershipRole/handler.js";
import {inviteMember} from "./routes/inviteMember/handler.js";
import {listMemberships} from "./routes/listMemberships/handler.js";
import {listMyMemberships} from "./routes/listMyMemberships/handler.js";
import {setMembershipScope} from "./routes/setMembershipScope/handler.js";
import {setMembershipStatus} from "./routes/setMembershipStatus/handler.js";

export function membershipRouter(): Router {
  const router = Router();
  router.get("/me/memberships", listMyMemberships);

  router.get("/tenants/:tenantId/memberships", listMemberships);
  router.post("/tenants/:tenantId/memberships", inviteMember);
  router.patch(
    "/tenants/:tenantId/memberships/:uid/role",
    changeMembershipRole,
  );
  router.patch(
    "/tenants/:tenantId/memberships/:uid/status",
    setMembershipStatus,
  );
  router.put("/tenants/:tenantId/memberships/:uid/scope", setMembershipScope);
  return router;
}
