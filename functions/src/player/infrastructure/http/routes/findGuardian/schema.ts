import {z} from "zod";
import {
  contactPreference,
  documentType,
  isoDate,
  personDocument,
} from "../../common-schema.js";

// GET /tenants/:tenantId/guardians?documentType=CC&documentNumber=1020304.
// Query values are always strings.
export const findGuardianQuery = z
  .object({
    documentType,
    documentNumber: z.string().min(1).max(30),
  })
  .strict();

// The normalized `documentKey` is internal and never leaves.
export const findGuardianOutput = z.object({
  guardian: z
    .object({
      id: z.string(),
      firstNames: z.string(),
      lastNames: z.string(),
      document: personDocument,
      phone: z.string(),
      email: z.string().nullable(),
      preferredContact: contactPreference,
      createdAt: isoDate,
      updatedAt: isoDate,
    })
    .nullable(),
});

export type FindGuardianQuery = z.infer<typeof findGuardianQuery>;
export type FindGuardianOutput = z.infer<typeof findGuardianOutput>;
