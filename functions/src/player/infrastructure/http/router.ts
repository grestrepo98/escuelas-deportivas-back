import {Router} from "express";
import {changePlacementRoute} from "./routes/changePlacement/handler.js";
import {changeStatusRoute} from "./routes/changeStatus/handler.js";
import {enrollPlayerRoute} from "./routes/enrollPlayer/handler.js";
import {findGuardianRoute} from "./routes/findGuardian/handler.js";
import {getHistoryRoute} from "./routes/getHistory/handler.js";
import {getPlayerRoute} from "./routes/getPlayer/handler.js";
import {getSearchIndexRoute} from "./routes/getSearchIndex/handler.js";
import {listPlayersRoute} from "./routes/listPlayers/handler.js";
import {recordConsentRoute} from "./routes/recordConsent/handler.js";
import {setGuardiansRoute} from "./routes/setGuardians/handler.js";
import {updateGuardianRoute} from "./routes/updateGuardian/handler.js";
import {updatePlayerRoute} from "./routes/updatePlayer/handler.js";

export function playerRouter(): Router {
  const router = Router();

  router.post("/tenants/:tenantId/players", enrollPlayerRoute);
  router.get("/tenants/:tenantId/players", listPlayersRoute);
  // Before `/players/:playerId`, or "search-index" would be read as an id.
  router.get("/tenants/:tenantId/players/search-index", getSearchIndexRoute);
  router.get("/tenants/:tenantId/players/:playerId", getPlayerRoute);
  router.put("/tenants/:tenantId/players/:playerId", updatePlayerRoute);
  router.put(
    "/tenants/:tenantId/players/:playerId/placement",
    changePlacementRoute,
  );
  router.patch(
    "/tenants/:tenantId/players/:playerId/status",
    changeStatusRoute,
  );
  router.put(
    "/tenants/:tenantId/players/:playerId/guardians",
    setGuardiansRoute,
  );
  router.put(
    "/tenants/:tenantId/players/:playerId/consent",
    recordConsentRoute,
  );
  router.get("/tenants/:tenantId/players/:playerId/history", getHistoryRoute);

  router.get("/tenants/:tenantId/guardians", findGuardianRoute);
  router.put("/tenants/:tenantId/guardians/:guardianId", updateGuardianRoute);
  return router;
}
