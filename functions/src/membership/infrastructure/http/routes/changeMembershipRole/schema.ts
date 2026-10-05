import {ROLES} from "../../../../domain/role.js";
import {z} from "zod";

// PATCH /tenants/:tenantId/memberships/:uid/role. The tenant and the target
// travel in the route; the actor is never part of the input: it comes from the
// verified token.
export const changeMembershipRoleInput = z.object({
  newRole: z.enum(ROLES),
  reason: z.string().optional(),
}).strict();

export const changeMembershipRoleOutput = z.object({
  membershipId: z.string(),
  role: z.enum(ROLES),
});

export type ChangeMembershipRoleInput =
  z.infer<typeof changeMembershipRoleInput>;
export type ChangeMembershipRoleOutput =
  z.infer<typeof changeMembershipRoleOutput>;
