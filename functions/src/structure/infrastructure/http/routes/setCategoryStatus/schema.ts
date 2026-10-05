import {z} from "zod";

// PATCH /tenants/:tenantId/categories/:categoryId/status. The actor is never
// part of the input: it comes from the verified token.
export const setCategoryStatusInput = z.object({
  status: z.enum(["active", "closed"]),
  reason: z.string().optional(),
}).strict();

export const setCategoryStatusOutput = z.object({
  categoryId: z.string(),
  status: z.enum(["active", "closed"]),
});

export type SetCategoryStatusInput = z.infer<typeof setCategoryStatusInput>;
export type SetCategoryStatusOutput = z.infer<typeof setCategoryStatusOutput>;
