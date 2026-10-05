import {z} from "zod";
import {contactPreference, personDocument, text} from "../../common-schema.js";

// PUT /tenants/:tenantId/guardians/:guardianId replaces the guardian's data.
// Without `email` the guardian has none.
export const updateGuardianInput = z
  .object({
    firstNames: text(100),
    lastNames: text(100),
    document: personDocument,
    phone: text(30),
    email: z.email().max(120).nullable().optional(),
    preferredContact: contactPreference,
  })
  .strict();

export const updateGuardianOutput = z.object({guardianId: z.string()});

export type UpdateGuardianInput = z.infer<typeof updateGuardianInput>;
export type UpdateGuardianOutput = z.infer<typeof updateGuardianOutput>;
