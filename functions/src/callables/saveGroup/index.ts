import {SaveGroup} from "@escuelas/domain";
import {onCall} from "firebase-functions/v2/https";
import {FirestoreUnitOfWork} from "../../adapters/firestore/index.js";
import {firestore} from "../../shared/admin.js";
import {authorizeTenantMember, requireUid} from "../../shared/authorize.js";
import {deviceOf, parseInput} from "../../shared/callable.js";
import {systemClock} from "../../shared/clock.js";
import {toHttpsError} from "../../shared/errors.js";
import {
  saveGroupInput,
  saveGroupOutput,
  type SaveGroupOutput,
} from "./schema.js";

export const saveGroup = onCall(
  async (request): Promise<SaveGroupOutput> => {
    const actorUid = requireUid(request.auth);
    const input = parseInput(saveGroupInput, request.data);

    const db = firestore();
    await authorizeTenantMember(db, actorUid, input.tenantId);

    try {
      const result = await new SaveGroup(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({...input, actorUid, device: deviceOf(request)});
      return saveGroupOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
