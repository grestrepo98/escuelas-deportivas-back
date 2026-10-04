import {SaveCategory} from "@escuelas/domain";
import {onCall} from "firebase-functions/v2/https";
import {FirestoreUnitOfWork} from "../../adapters/firestore/index.js";
import {firestore} from "../../shared/admin.js";
import {authorizeTenantMember, requireUid} from "../../shared/authorize.js";
import {deviceOf, parseInput} from "../../shared/callable.js";
import {systemClock} from "../../shared/clock.js";
import {toHttpsError} from "../../shared/errors.js";
import {
  saveCategoryInput,
  saveCategoryOutput,
  type SaveCategoryOutput,
} from "./schema.js";

export const saveCategory = onCall(
  async (request): Promise<SaveCategoryOutput> => {
    const actorUid = requireUid(request.auth);
    const input = parseInput(saveCategoryInput, request.data);

    const db = firestore();
    await authorizeTenantMember(db, actorUid, input.tenantId);

    try {
      const result = await new SaveCategory(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({...input, actorUid, device: deviceOf(request)});
      return saveCategoryOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
