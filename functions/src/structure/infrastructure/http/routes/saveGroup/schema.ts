import {z} from "zod";

// "HH:mm" and end > start are business rules checked by the domain, which
// answers invalid_argument; this layer only fixes the shape.
const scheduleSlot = z.object({
  weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
  start: z.string(),
  end: z.string(),
}).strict();

// POST /tenants/:tenantId/groups and PUT /tenants/:tenantId/groups/:groupId.
// The tenant and the group travel in the route; the actor is never part of
// the input: it comes from the verified token. A group is created in a venue
// and never moves, so `venueId` is accepted on create only.
export const createGroupInput = z.object({
  venueId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string(),
  schedule: z.array(scheduleSlot),
}).strict();

export const updateGroupInput = createGroupInput.omit({venueId: true}).strict();

export const saveGroupOutput = z.object({
  groupId: z.string(),
});

export type CreateGroupInput = z.infer<typeof createGroupInput>;
export type UpdateGroupInput = z.infer<typeof updateGroupInput>;
export type SaveGroupOutput = z.infer<typeof saveGroupOutput>;
