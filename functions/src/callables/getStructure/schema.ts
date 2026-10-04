import {z} from "zod";

export const getStructureInput = z.object({
  tenantId: z.string().min(1),
  includeClosed: z.boolean().optional(),
}).strict();

const status = z.enum(["active", "closed"]);
// ISO 8601, UTC.
const timestamps = {createdAt: z.string(), updatedAt: z.string()};

const venueDto = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  facility: z.string().optional(),
  status,
  ...timestamps,
});

const categoryDto = z.object({
  id: z.string(),
  name: z.string(),
  birthYears: z.array(z.number()),
  status,
  ...timestamps,
});

const groupDto = z.object({
  id: z.string(),
  venueId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  schedule: z.array(z.object({
    weekday: z.number(),
    start: z.string(),
    end: z.string(),
  })),
  status,
  ...timestamps,
});

export const getStructureOutput = z.object({
  venues: z.array(venueDto),
  categories: z.array(categoryDto),
  groups: z.array(groupDto),
});

export type GetStructureInput = z.infer<typeof getStructureInput>;
export type GetStructureOutput = z.infer<typeof getStructureOutput>;
