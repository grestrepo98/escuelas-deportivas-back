import {DomainError} from "../errors.js";
import {requireOwner} from "../membership/require-owner.js";
import type {Clock} from "../ports/clock.js";
import type {UnitOfWork} from "../ports/unit-of-work.js";
import type {StructureStatus} from "./structure.js";
import {isNameTaken} from "./validation.js";

export type SetCategoryStatusInput = {
  tenantId: string;
  actorUid: string;
  categoryId: string;
  status: StructureStatus;
  reason?: string;
  device?: {userAgent?: string};
};

export type SetCategoryStatusResult = {
  categoryId: string;
  status: StructureStatus;
};

export class SetCategoryStatus {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SetCategoryStatusInput): Promise<SetCategoryStatusResult> {
    const {tenantId, actorUid, categoryId, status} = input;

    return this.unitOfWork.run(
      async ({memberships, categories, groups, auditLog}) => {
        const actorRole = await requireOwner(memberships, tenantId, actorUid);

        const category = await categories.get(tenantId, categoryId);
        if (!category) {
          throw new DomainError("not_found", "Category not found");
        }
        if (category.status === status) {
          throw new DomainError(
            "failed_precondition",
            `The category is already ${status}`,
          );
        }

        if (status === "closed") {
          const tenantGroups = await groups.listByTenant(tenantId);
          if (tenantGroups.some((g) =>
            g.categoryId === categoryId && g.status === "active")) {
            throw new DomainError(
              "failed_precondition",
              "Close the active groups of the category first",
            );
          }
        } else {
          const all = await categories.listByTenant(tenantId);
          if (isNameTaken(all, category.name, category.id)) {
            throw new DomainError(
              "failed_precondition",
              "An active category already uses that name",
            );
          }
        }

        await categories.save({
          ...category,
          status,
          updatedAt: this.clock.now(),
        });

        await auditLog.append({
          tenantId,
          actorUid,
          actorRole,
          action: status === "closed" ? "category.closed" :
            "category.reopened",
          target: {type: "category", id: categoryId},
          before: {status: category.status},
          after: {status},
          ...(input.reason !== undefined && {reason: input.reason}),
          device: input.device ?? {},
        });

        return {categoryId, status};
      },
    );
  }
}
