import {z} from "zod";
import {INVITABLE_ROLES} from "../../../../application/invite-member.js";
import {scopeInput} from "../../scope-schema.js";

// POST /tenants/:tenantId/memberships. The tenant travels in the route; the
// actor is never part of the input: it comes from the verified token.
export const inviteMemberInput = z
  .object({
    email: z.string().trim().pipe(z.email().max(254)),
    role: z.enum(INVITABLE_ROLES),
    scope: scopeInput.optional(),
  })
  .strict();

export const inviteMemberOutput = z.object({
  uid: z.string(),
  membershipId: z.string(),
  role: z.enum(INVITABLE_ROLES),
  // Only for an account that was just created or never signed in.
  passwordResetLink: z.string().optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberInput>;
export type InviteMemberOutput = z.infer<typeof inviteMemberOutput>;
