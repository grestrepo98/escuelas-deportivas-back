import {z} from "zod";
import {
  dataConsentDto,
  guardianLinkDto,
  isoDate,
  personDocument,
  playerStatus,
} from "../../common-schema.js";

// GET /tenants/:tenantId/players/:playerId. `document`, `guardians` and
// `dataConsent` are absent (not null) in the teacher's record, which is how
// the front tells a restricted record from one that has none.
export const getPlayerOutput = z.object({
  id: z.string(),
  firstNames: z.string(),
  lastNames: z.string(),
  document: personDocument.nullable().optional(),
  birthDate: z.string(),
  groupId: z.string(),
  venueId: z.string(),
  categoryId: z.string(),
  status: playerStatus,
  statusReason: z.string().nullable(),
  joinedAt: isoDate,
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  }),
  medical: z.object({
    bloodType: z.string().optional(),
    allergies: z.string().optional(),
    conditions: z.string().optional(),
    medications: z.string().optional(),
    notes: z.string().optional(),
  }),
  guardians: z.array(guardianLinkDto).optional(),
  dataConsent: dataConsentDto.nullable().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type GetPlayerOutput = z.infer<typeof getPlayerOutput>;
