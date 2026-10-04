import {
  UpdateTenantProfile,
} from "../../../application/update-tenant-profile.js";
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
  updateTenantProfileInput,
  updateTenantProfileOutput,
  type UpdateTenantProfileOutput,
} from "./schema.js";

export const updateTenantProfile = onCall(
  async (request): Promise<UpdateTenantProfileOutput> => {
    const actorUid = requireUid(request.auth);
    const input = parseInput(updateTenantProfileInput, request.data);

    const db = firestore();
    await authorizeTenantMember(db, actorUid, input.tenantId);

    try {
      const result = await new UpdateTenantProfile(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({...input, actorUid, device: deviceOf(request)});
      return updateTenantProfileOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
