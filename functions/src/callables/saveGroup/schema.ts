import {z} from "zod";

// "HH:mm" and end > start are business rules checked by the domain, which
// answers invalid-argument; this layer only fixes the shape.
const scheduleSlot = z.object({
  weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
  start: z.string(),
  end: z.string(),
}).strict();

// The actor is never part of the input: it comes from request.auth.
// Without a groupId the call creates a group, and then venueId is required;
// on an existing group venueId must be omitted or unchanged.
export const saveGroupInput = z.object({
  tenantId: z.string().min(1),
  groupId: z.string().min(1).optional(),
  venueId: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  name: z.string(),
  schedule: z.array(scheduleSlot),
}).strict();

export const saveGroupOutput = z.object({
  groupId: z.string(),
});

export type SaveGroupInput = z.infer<typeof saveGroupInput>;
export type SaveGroupOutput = z.infer<typeof saveGroupOutput>;
