import {z} from "zod";

// POST /tenants/:tenantId/categories and
// PUT /tenants/:tenantId/categories/:categoryId. The tenant and the category
// travel in the route; the actor is never part of the input: it comes from
// the verified token. `birthYears` may be empty (a category by level).
export const saveCategoryInput = z.object({
  name: z.string(),
  birthYears: z.array(z.number().int()),
}).strict();

export const saveCategoryOutput = z.object({
  categoryId: z.string(),
});

export type SaveCategoryInput = z.infer<typeof saveCategoryInput>;
export type SaveCategoryOutput = z.infer<typeof saveCategoryOutput>;
