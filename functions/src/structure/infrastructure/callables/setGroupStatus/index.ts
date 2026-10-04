import {SetGroupStatus} from "../../../application/set-group-status.js";
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
  setGroupStatusInput,
  setGroupStatusOutput,
  type SetGroupStatusOutput,
} from "./schema.js";

export const setGroupStatus = onCall(
  async (request): Promise<SetGroupStatusOutput> => {
    const actorUid = requireUid(request.auth);
    const input = parseInput(setGroupStatusInput, request.data);

    const db = firestore();
    await authorizeTenantMember(db, actorUid, input.tenantId);

    try {
      const result = await new SetGroupStatus(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({...input, actorUid, device: deviceOf(request)});
      return setGroupStatusOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
