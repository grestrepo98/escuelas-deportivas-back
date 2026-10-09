import {z} from "zod";
import {
  documentDto,
  documentType,
  policyInput,
  policyStatus,
} from "../../common-schema.js";

// POST /tenants/:tenantId/players/:playerId/documents. The upload id is
// required except for a policy recorded without a file.
export const recordDocumentInput = z
  .object({
    type: documentType,
    uploadId: z.string().min(1).max(128).optional(),
    policy: policyInput.optional(),
  })
  .strict();

export const recordDocumentOutput = z.object({
  document: documentDto,
  policyStatus: policyStatus.optional(),
});

export type RecordDocumentInput = z.infer<typeof recordDocumentInput>;
export type RecordDocumentOutput = z.infer<typeof recordDocumentOutput>;
