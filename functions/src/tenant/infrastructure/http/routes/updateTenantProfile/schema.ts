import {z} from "zod";

// Optional contact text may be blank (it clears the field); when present,
// the email must be well formed.
const optionalEmail = z
  .string()
  .refine(
    (value) => value.trim() === "" || z.email().safeParse(value.trim()).success,
    "Invalid email",
  );

// PUT /tenants/:tenantId/profile. The tenant travels in the route and the actor
// is never part of the input: it comes from the verified token.
export const updateTenantProfileInput = z
  .object({
    name: z.string(),
    idrdRegistration: z.string().optional(),
    contact: z
      .object({
        email: optionalEmail.optional(),
        phone: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const updateTenantProfileOutput = z.object({
  tenantId: z.string(),
});

export type UpdateTenantProfileInput = z.infer<typeof updateTenantProfileInput>;
export type UpdateTenantProfileOutput = z.infer<
  typeof updateTenantProfileOutput
>;
