import {Router} from "express";
import {
  createCategory,
  updateCategory,
} from "./routes/saveCategory/handler.js";
import {createGroup, updateGroup} from "./routes/saveGroup/handler.js";
import {createVenue, updateVenue} from "./routes/saveVenue/handler.js";
import {setCategoryStatus} from "./routes/setCategoryStatus/handler.js";
import {setGroupStatus} from "./routes/setGroupStatus/handler.js";
import {setVenueStatus} from "./routes/setVenueStatus/handler.js";
import {getStructure} from "./routes/getStructure/handler.js";

export function structureRouter(): Router {
  const router = Router();
  router.get("/tenants/:tenantId/structure", getStructure);

  router.post("/tenants/:tenantId/venues", createVenue);
  router.put("/tenants/:tenantId/venues/:venueId", updateVenue);
  router.patch("/tenants/:tenantId/venues/:venueId/status", setVenueStatus);

  router.post("/tenants/:tenantId/categories", createCategory);
  router.put("/tenants/:tenantId/categories/:categoryId", updateCategory);
  router.patch(
    "/tenants/:tenantId/categories/:categoryId/status", setCategoryStatus);

  router.post("/tenants/:tenantId/groups", createGroup);
  router.put("/tenants/:tenantId/groups/:groupId", updateGroup);
  router.patch("/tenants/:tenantId/groups/:groupId/status", setGroupStatus);
  return router;
}
