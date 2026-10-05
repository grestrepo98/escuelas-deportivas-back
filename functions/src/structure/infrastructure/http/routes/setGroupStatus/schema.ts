import {z} from "zod";

// PATCH /tenants/:tenantId/groups/:groupId/status. The actor is never part of
// the input: it comes from the verified token.
export const setGroupStatusInput = z.object({
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setGroupStatusOutput = z.object({
  groupId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetGroupStatusInput = z.infer<typeof setGroupStatusInput>;
export type SetGroupStatusOutput = z.infer<typeof setGroupStatusOutput>;
