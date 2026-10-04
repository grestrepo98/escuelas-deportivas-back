import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
// Without a venueId the call creates a venue.
export const saveVenueInput = z.object({
  tenantId: z.string().min(1),
  venueId: z.string().min(1).optional(),
  name: z.string(),
  address: z.string(),
  facility: z.string().optional(),
}).strict();

export const saveVenueOutput = z.object({
  venueId: z.string(),
});

export type SaveVenueInput = z.infer<typeof saveVenueInput>;
export type SaveVenueOutput = z.infer<typeof saveVenueOutput>;
