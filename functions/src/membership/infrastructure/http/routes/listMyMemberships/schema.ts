import {ROLES} from "../../../../domain/role.js";
import {z} from "zod";

// GET /me/memberships takes no input: the uid comes from the verified token.
export const listMyMembershipsOutput = z.object({
  memberships: z.array(
    z.object({
      tenantId: z.string(),
      tenantName: z.string(),
      role: z.enum(ROLES),
      scope: z.object({
        venueIds: z.array(z.string()),
        groupIds: z.array(z.string()),
        playerIds: z.array(z.string()),
      }),
    }),
  ),
});

export type ListMyMembershipsOutput = z.infer<typeof listMyMembershipsOutput>;
