import {z} from "zod";
import {documentType} from "../../common-schema.js";

// POST /tenants/:tenantId/players/:playerId/documents/uploads. Type and size
// limits are checked by the domain.
export const requestUploadInput = z
  .object({
    type: documentType,
    contentType: z.string().max(100),
    size: z.number(),
  })
  .strict();

export const requestUploadOutput = z.object({
  uploadId: z.string(),
  uploadUrl: z.string(),
  uploadMethod: z.enum(["PUT", "POST"]),
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: z.string(), // ISO 8601, UTC
});

export type RequestUploadInput = z.infer<typeof requestUploadInput>;
export type RequestUploadOutput = z.infer<typeof requestUploadOutput>;
