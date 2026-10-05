import {z} from "zod";
import {playerStatus} from "../../common-schema.js";

// GET /tenants/:tenantId/players. Query values are always strings. At most
// one of venueId, categoryId and groupId: the use case answers 400 for two.
export const listPlayersQuery = z
  .object({
    venueId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    groupId: z.string().min(1).optional(),
    status: playerStatus.optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().optional(),
  })
  .strict();

export const listPlayersOutput = z.object({
  players: z.array(
    z.object({
      id: z.string(),
      firstNames: z.string(),
      lastNames: z.string(),
      birthDate: z.string(),
      status: playerStatus,
      groupId: z.string(),
      venueId: z.string(),
      categoryId: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export type ListPlayersQuery = z.infer<typeof listPlayersQuery>;
export type ListPlayersOutput = z.infer<typeof listPlayersOutput>;
