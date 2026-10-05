import {ROLES} from "../../../../domain/role.js";
import {z} from "zod";
import {scopeInput} from "../../scope-schema.js";

// PATCH /tenants/:tenantId/memberships/:uid/role. The tenant and the target
// travel in the route; the actor is never part of the input: it comes from the
// verified token. `scope` is required for coordinator and teacher (an additive
// change: without it owner and accountant work as before).
export const changeMembershipRoleInput = z
  .object({
    newRole: z.enum(ROLES),
    scope: scopeInput.optional(),
    reason: z.string().optional(),
  })
  .strict();

export const changeMembershipRoleOutput = z.object({
  membershipId: z.string(),
  role: z.enum(ROLES),
});

export type ChangeMembershipRoleInput = z.infer<
  typeof changeMembershipRoleInput
>;
export type ChangeMembershipRoleOutput = z.infer<
  typeof changeMembershipRoleOutput
>;
