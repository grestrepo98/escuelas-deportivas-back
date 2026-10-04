import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
export const setCategoryStatusInput = z.object({
  tenantId: z.string().min(1),
  categoryId: z.string().min(1),
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setCategoryStatusOutput = z.object({
  categoryId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetCategoryStatusInput = z.infer<typeof setCategoryStatusInput>;
export type SetCategoryStatusOutput = z.infer<typeof setCategoryStatusOutput>;
