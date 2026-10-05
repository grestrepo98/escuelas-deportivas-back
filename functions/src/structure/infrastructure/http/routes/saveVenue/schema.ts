import {z} from "zod";

// POST /tenants/:tenantId/venues and PUT /tenants/:tenantId/venues/:venueId.
// The tenant and the venue travel in the route; the actor is never part of
// the input: it comes from the verified token.
export const saveVenueInput = z
  .object({
    name: z.string(),
    address: z.string(),
    facility: z.string().optional(),
  })
  .strict();

export const saveVenueOutput = z.object({
  venueId: z.string(),
});

export type SaveVenueInput = z.infer<typeof saveVenueInput>;
export type SaveVenueOutput = z.infer<typeof saveVenueOutput>;
