import {z} from "zod";
import {isoDate, playerStatus} from "../../common-schema.js";

const placementState = z.object({
  groupId: z.string().optional(),
  venueId: z.string().optional(),
  categoryId: z.string().optional(),
  status: playerStatus.optional(),
});

// GET /tenants/:tenantId/players/:playerId/history takes no parameters. The
// entries are newest first.
export const getHistoryOutput = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["placement", "status"]),
      before: placementState,
      after: placementState,
      reason: z.string().nullable(),
      actorUid: z.string(),
      at: isoDate,
    }),
  ),
});

export type GetHistoryOutput = z.infer<typeof getHistoryOutput>;
