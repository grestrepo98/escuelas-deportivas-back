import {z} from "zod";
import {
  emergencyContact,
  medical,
  personDocument,
  text,
} from "../../common-schema.js";

// PUT /tenants/:tenantId/players/:playerId replaces the personal, emergency
// and medical data. The group, the status and the guardians have their own
// routes, so they are not accepted here. Without `document` the player has
// none.
export const updatePlayerInput = z
  .object({
    firstNames: text(100),
    lastNames: text(100),
    document: personDocument.nullable().optional(),
    birthDate: text(10),
    emergencyContact,
    medical: medical.optional(),
  })
  .strict();

export const updatePlayerOutput = z.object({playerId: z.string()});

export type UpdatePlayerInput = z.infer<typeof updatePlayerInput>;
export type UpdatePlayerOutput = z.infer<typeof updatePlayerOutput>;
