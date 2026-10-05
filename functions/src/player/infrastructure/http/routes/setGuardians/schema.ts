import {z} from "zod";
import {guardianLinks} from "../../common-schema.js";

// PUT /tenants/:tenantId/players/:playerId/guardians replaces the whole set,
// in the same format as when the player is enrolled.
export const setGuardiansInput = z.object({guardians: guardianLinks}).strict();

export const setGuardiansOutput = z.object({
  playerId: z.string(),
  createdGuardianIds: z.array(z.string()),
});

export type SetGuardiansInput = z.infer<typeof setGuardiansInput>;
export type SetGuardiansOutput = z.infer<typeof setGuardiansOutput>;
