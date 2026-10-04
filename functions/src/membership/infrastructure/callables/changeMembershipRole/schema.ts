import {ROLES} from "../../../domain/role.js";
import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
export const changeMembershipRoleInput = z.object({
  tenantId: z.string().min(1),
  targetUid: z.string().min(1),
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
