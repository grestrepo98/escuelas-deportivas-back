import {z} from "zod";

// PATCH /tenants/:tenantId/venues/:venueId/status. The actor is never part of
// the input: it comes from the verified token.
export const setVenueStatusInput = z.object({
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setVenueStatusOutput = z.object({
  venueId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetVenueStatusInput = z.infer<typeof setVenueStatusInput>;
export type SetVenueStatusOutput = z.infer<typeof setVenueStatusOutput>;
