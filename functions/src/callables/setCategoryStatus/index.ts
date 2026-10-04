import {SetCategoryStatus} from "@escuelas/domain";
import {onCall} from "firebase-functions/v2/https";
import {FirestoreUnitOfWork} from "../../adapters/firestore/index.js";
import {firestore} from "../../shared/admin.js";
import {authorizeTenantMember, requireUid} from "../../shared/authorize.js";
import {deviceOf, parseInput} from "../../shared/callable.js";
import {systemClock} from "../../shared/clock.js";
import {toHttpsError} from "../../shared/errors.js";
import {
  setCategoryStatusInput,
  setCategoryStatusOutput,
  type SetCategoryStatusOutput,
} from "./schema.js";

export const setCategoryStatus = onCall(
  async (request): Promise<SetCategoryStatusOutput> => {
    const actorUid = requireUid(request.auth);
    const input = parseInput(setCategoryStatusInput, request.data);

    const db = firestore();
    await authorizeTenantMember(db, actorUid, input.tenantId);

    try {
      const result = await new SetCategoryStatus(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({...input, actorUid, device: deviceOf(request)});
      return setCategoryStatusOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
