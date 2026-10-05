import {z} from "zod";
import {
  emergencyContact,
  guardianLinks,
  medical,
  personDocument,
  text,
} from "../../common-schema.js";

// POST /tenants/:tenantId/players. The tenant travels in the route; the actor
// is never part of the input: it comes from the verified token. The player is
// always created `preinscrito`, so the status is not accepted.
export const enrollPlayerInput = z
  .object({
    firstNames: text(100),
    lastNames: text(100),
    document: personDocument.optional(),
    birthDate: text(10),
    groupId: z.string().min(1),
    emergencyContact,
    medical: medical.optional(),
    guardians: guardianLinks,
    confirmDuplicate: z.boolean().optional(),
  })
  .strict();

export const enrollPlayerOutput = z.object({
  playerId: z.string(),
  status: z.literal("preinscrito"),
  createdGuardianIds: z.array(z.string()),
});

export type EnrollPlayerInput = z.infer<typeof enrollPlayerInput>;
export type EnrollPlayerOutput = z.infer<typeof enrollPlayerOutput>;
