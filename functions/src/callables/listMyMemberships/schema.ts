import {ROLES} from "@escuelas/domain";
import {z} from "zod";

// The uid comes from request.auth, never from the client. The client may send
// nothing (`null`/`undefined`, as the SDK does) or an empty object.
export const listMyMembershipsInput = z.object({}).strict().nullish();

export const listMyMembershipsOutput = z.object({
  memberships: z.array(z.object({
    tenantId: z.string(),
    tenantName: z.string(),
    role: z.enum(ROLES),
    scope: z.object({
      venueIds: z.array(z.string()),
      groupIds: z.array(z.string()),
      playerIds: z.array(z.string()),
    }),
  })),
});

export type ListMyMembershipsOutput = z.infer<typeof listMyMembershipsOutput>;
