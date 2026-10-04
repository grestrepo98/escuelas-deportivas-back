import {SaveGroup} from "../../../application/save-group.js";
import {onCall} from "firebase-functions/v2/https";
import {
  FirestoreUnitOfWork,
} from "../../../../shared/infrastructure/firestore-unit-of-work.js";
import {firestore} from "../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../membership/infrastructure/authorize.js";
import {
  deviceOf,
  parseInput,
} from "../../../../shared/infrastructure/callable.js";
import {systemClock} from "../../../../shared/infrastructure/system-clock.js";
import {
  toHttpsError,
} from "../../../../shared/infrastructure/to-https-error.js";
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
