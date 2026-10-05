import {z} from "zod";
import {text} from "../../common-schema.js";

// PUT /tenants/:tenantId/players/:playerId/placement. The venue and the
// category come from the group, so they are not accepted.
export const changePlacementInput = z
  .object({
    groupId: z.string().min(1),
    reason: text(500).optional(),
  })
  .strict();

export const changePlacementOutput = z.object({
  playerId: z.string(),
  groupId: z.string(),
  venueId: z.string(),
  categoryId: z.string(),
});

export type ChangePlacementInput = z.infer<typeof changePlacementInput>;
export type ChangePlacementOutput = z.infer<typeof changePlacementOutput>;
