import {z} from "zod";

// The actor is never part of the input: it comes from request.auth.
// Without a categoryId the call creates a category.
export const saveCategoryInput = z.object({
  tenantId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  name: z.string(),
  birthYears: z.array(z.number().int()),
}).strict();

export const saveCategoryOutput = z.object({
  categoryId: z.string(),
});

export type SaveCategoryInput = z.infer<typeof saveCategoryInput>;
export type SaveCategoryOutput = z.infer<typeof saveCategoryOutput>;
