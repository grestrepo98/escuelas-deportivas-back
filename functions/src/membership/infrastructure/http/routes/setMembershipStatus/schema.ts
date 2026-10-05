import {z} from "zod";

// PATCH /tenants/:tenantId/memberships/:uid/status. The tenant and the target
// travel in the route; the actor comes from the verified token.
export const setMembershipStatusInput = z
  .object({
    status: z.enum(["active", "inactive"]),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const setMembershipStatusOutput = z.object({
  membershipId: z.string(),
  status: z.enum(["active", "inactive"]),
});

export type SetMembershipStatusInput = z.infer<typeof setMembershipStatusInput>;
export type SetMembershipStatusOutput = z.infer<
  typeof setMembershipStatusOutput
>;
