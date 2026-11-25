import {Router} from "express";
import {getDownloadUrlRoute} from "./routes/getDownloadUrl/handler.js";
import {listCategoryPoliciesRoute} from "./routes/listCategoryPolicies/handler.js";
import {listPlayerDocumentsRoute} from "./routes/listPlayerDocuments/handler.js";
import {recordDocumentRoute} from "./routes/recordDocument/handler.js";
import {requestUploadRoute} from "./routes/requestUpload/handler.js";

export function documentRouter(): Router {
  const router = Router();

  router.post(
    "/tenants/:tenantId/players/:playerId/documents/uploads",
    requestUploadRoute,
  );
  router.post(
    "/tenants/:tenantId/players/:playerId/documents",
    recordDocumentRoute,
  );
  router.get(
    "/tenants/:tenantId/players/:playerId/documents",
    listPlayerDocumentsRoute,
  );
  router.get(
    "/tenants/:tenantId/players/:playerId/documents/:documentId/download-url",
    getDownloadUrlRoute,
  );
  router.get(
    "/tenants/:tenantId/categories/:categoryId/policies",
    listCategoryPoliciesRoute,
  );
  return router;
}
