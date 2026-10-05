import {z} from "zod";
import {ROLES} from "../../../../domain/role.js";
import {scopeOutput} from "../../scope-schema.js";

// GET /tenants/:tenantId/memberships takes no input: the tenant travels in the
// route and the actor comes from the verified token.
export const listMembershipsOutput = z.object({
  memberships: z.array(
    z.object({
      uid: z.string(),
      email: z.string(),
      role: z.enum(ROLES),
      status: z.enum(["active", "inactive"]),
      scope: scopeOutput,
    }),
  ),
});

export type ListMembershipsOutput = z.infer<typeof listMembershipsOutput>;
