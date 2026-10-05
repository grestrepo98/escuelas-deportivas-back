import {Router} from "express";
import {updateTenantProfile} from "./routes/updateTenantProfile/handler.js";

export function tenantRouter(): Router {
  const router = Router();
  router.put("/tenants/:tenantId/profile", updateTenantProfile);
  return router;
}
