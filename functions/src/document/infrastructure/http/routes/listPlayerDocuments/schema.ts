import {z} from "zod";
import {documentDto, policyStatus} from "../../common-schema.js";

// GET /tenants/:tenantId/players/:playerId/documents?history=true
export const listPlayerDocumentsQuery = z
  .object({history: z.enum(["true", "false"]).optional()})
  .strict();

export const listPlayerDocumentsOutput = z.object({
  documents: z.array(documentDto),
  policyStatus,
});

export type ListPlayerDocumentsOutput = z.infer<
  typeof listPlayerDocumentsOutput
>;
