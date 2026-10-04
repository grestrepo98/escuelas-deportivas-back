import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
export const setVenueStatusInput = z.object({
  tenantId: z.string().min(1),
  venueId: z.string().min(1),
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setVenueStatusOutput = z.object({
  venueId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetVenueStatusInput = z.infer<typeof setVenueStatusInput>;
export type SetVenueStatusOutput = z.infer<typeof setVenueStatusOutput>;
