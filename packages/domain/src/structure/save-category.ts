import {DomainError} from "../errors.js";
import {requireOwner} from "../membership/require-owner.js";
import type {Clock} from "../ports/clock.js";
import type {UnitOfWork} from "../ports/unit-of-work.js";
import type {Category} from "./structure.js";
import {isNameTaken, validateBirthYears, validateName} from "./validation.js";

export type SaveCategoryInput = {
  tenantId: string;
  actorUid: string;
  categoryId?: string; // absent = create
  name: string;
  birthYears: number[];
  device?: {userAgent?: string};
};

export type SaveCategoryResult = {categoryId: string};

const snapshot = (category: Category): Record<string, unknown> => ({
  name: category.name,
  birthYears: category.birthYears,
  status: category.status,
});

export class SaveCategory {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: SaveCategoryInput): Promise<SaveCategoryResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, categories, auditLog}) => {
      const actorRole = await requireOwner(memberships, tenantId, actorUid);

      const name = validateName(input.name);
      const birthYears = validateBirthYears(input.birthYears);
      const now = this.clock.now();

      const existing = input.categoryId ?
        await categories.get(tenantId, input.categoryId) :
        null;
      if (input.categoryId && !existing) {
        throw new DomainError("not_found", "Category not found");
      }

      // A closed category does not hold its name.
      if (!existing || existing.status === "active") {
        const all = await categories.listByTenant(tenantId);
        if (isNameTaken(all, name, existing?.id)) {
          throw new DomainError(
            "failed_precondition",
            "An active category already uses that name",
          );
        }
      }

      const saved: Category = {
        id: existing?.id ?? categories.newId(),
        tenantId,
        name,
        birthYears,
        status: existing?.status ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await categories.save(saved);

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: existing ? "category.updated" : "category.created",
        target: {type: "category", id: saved.id},
        before: existing ? snapshot(existing) : {},
        after: snapshot(saved),
        device: input.device ?? {},
      });

      return {categoryId: saved.id};
    });
  }
}
