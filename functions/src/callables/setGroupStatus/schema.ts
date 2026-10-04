import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
export const setGroupStatusInput = z.object({
  tenantId: z.string().min(1),
  groupId: z.string().min(1),
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setGroupStatusOutput = z.object({
  groupId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetGroupStatusInput = z.infer<typeof setGroupStatusInput>;
export type SetGroupStatusOutput = z.infer<typeof setGroupStatusOutput>;
