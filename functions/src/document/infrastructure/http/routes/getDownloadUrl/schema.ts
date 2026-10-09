import {z} from "zod";

// GET /tenants/:tenantId/players/:playerId/documents/:documentId/download-url
export const getDownloadUrlOutput = z.object({
  url: z.string(),
  expiresAt: z.string(), // ISO 8601, UTC
});

export type GetDownloadUrlOutput = z.infer<typeof getDownloadUrlOutput>;
