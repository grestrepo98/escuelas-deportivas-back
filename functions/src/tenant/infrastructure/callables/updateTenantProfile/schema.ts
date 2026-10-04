import {z} from "zod";

// Optional contact text may be blank (it clears the field); when present,
// the email must be well formed.
const optionalEmail = z.string().refine(
  (value) => value.trim() === "" || z.email().safeParse(value.trim()).success,
  "Invalid email",
);

// The actor is never part of the input: it comes from request.auth.
export const updateTenantProfileInput = z.object({
  tenantId: z.string().min(1),
  name: z.string(),
  idrdRegistration: z.string().optional(),
  contact: z.object({
    email: optionalEmail.optional(),
    phone: z.string().optional(),
  }).strict(),
}).strict();

export const updateTenantProfileOutput = z.object({
  tenantId: z.string(),
});

export type UpdateTenantProfileInput =
  z.infer<typeof updateTenantProfileInput>;
export type UpdateTenantProfileOutput =
  z.infer<typeof updateTenantProfileOutput>;
