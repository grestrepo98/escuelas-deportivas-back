import {z} from "zod";
import {scopeInput, scopeOutput} from "../../scope-schema.js";

// PUT /tenants/:tenantId/memberships/:uid/scope replaces the whole scope. The
// tenant and the target travel in the route; the actor comes from the token.
export const setMembershipScopeInput = z
  .object({
    scope: scopeInput,
  })
  .strict();

export const setMembershipScopeOutput = z.object({
  membershipId: z.string(),
  scope: scopeOutput,
});

export type SetMembershipScopeInput = z.infer<typeof setMembershipScopeInput>;
export type SetMembershipScopeOutput = z.infer<typeof setMembershipScopeOutput>;
