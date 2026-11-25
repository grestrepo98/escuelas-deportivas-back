import {z} from "zod";
import {policyDto, policyStatus} from "../../common-schema.js";

// GET /tenants/:tenantId/categories/:categoryId/policies
export const listCategoryPoliciesOutput = z.object({
  items: z.array(
    z.object({
      playerId: z.string(),
      fullName: z.string(),
      groupId: z.string(),
      policy: policyDto.optional(),
      policyStatus,
    }),
  ),
});

export type ListCategoryPoliciesOutput = z.infer<
  typeof listCategoryPoliciesOutput
>;
