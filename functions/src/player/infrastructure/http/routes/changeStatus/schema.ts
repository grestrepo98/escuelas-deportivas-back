import {z} from "zod";
import {playerStatus, text} from "../../common-schema.js";

// PATCH /tenants/:tenantId/players/:playerId/status. Whether a reason is
// required depends on the transition, so the domain checks it.
export const changeStatusInput = z
  .object({
    status: playerStatus,
    reason: text(500).optional(),
  })
  .strict();

export const changeStatusOutput = z.object({
  playerId: z.string(),
  status: playerStatus,
});

export type ChangeStatusInput = z.infer<typeof changeStatusInput>;
export type ChangeStatusOutput = z.infer<typeof changeStatusOutput>;
