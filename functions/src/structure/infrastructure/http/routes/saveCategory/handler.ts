import type {Request, RequestHandler, Response} from "express";
import {SaveCategory} from "../../../../application/save-category.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../../membership/infrastructure/authorize.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {
  saveCategoryInput,
  saveCategoryOutput,
  type SaveCategoryOutput,
} from "./schema.js";

// Without a categoryId the use case creates a category.
async function save(
  req: Request,
  res: Response,
  tenantId: string,
  categoryId?: string,
): Promise<SaveCategoryOutput> {
  const actorUid = requireUid(res.locals.uid);
  const input = parseInput(saveCategoryInput, req.body);

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new SaveCategory(
    new FirestoreUnitOfWork(db),
    systemClock,
  ).execute({
    ...input,
    tenantId,
    categoryId,
    actorUid,
    device: deviceOf(req),
  });
  return saveCategoryOutput.parse(result);
}

export const createCategory: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  res.status(201).json(await save(req, res, req.params.tenantId));
};

export const updateCategory: RequestHandler<{
  tenantId: string;
  categoryId: string;
}> = async (req, res) => {
  const {tenantId, categoryId} = req.params;
  res.json(await save(req, res, tenantId, categoryId));
};
