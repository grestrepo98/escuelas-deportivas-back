import {z} from "zod";
import {playerStatus} from "../../common-schema.js";

// GET /tenants/:tenantId/players/search-index takes no parameters.
export const getSearchIndexOutput = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      documentNumber: z.string().optional(),
      guardianNames: z.array(z.string()).optional(),
      status: playerStatus,
      groupId: z.string(),
    }),
  ),
});

export type GetSearchIndexOutput = z.infer<typeof getSearchIndexOutput>;
