import {z} from "zod";
import {dataConsentDto} from "../../common-schema.js";

// PUT /tenants/:tenantId/players/:playerId/consent. The staff member and the
// time come from the token and the clock, never from the request.
export const recordConsentInput = z
  .object({guardianId: z.string().min(1)})
  .strict();

export const recordConsentOutput = z.object({
  playerId: z.string(),
  dataConsent: dataConsentDto,
});

export type RecordConsentInput = z.infer<typeof recordConsentInput>;
export type RecordConsentOutput = z.infer<typeof recordConsentOutput>;
