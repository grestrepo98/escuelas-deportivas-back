import {ChangeMembershipRole} from "@escuelas/domain";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {FirestoreUnitOfWork} from "../../adapters/firestore/index.js";
import {firestore} from "../../shared/admin.js";
import {authorizeTenantMember, requireUid} from "../../shared/authorize.js";
import {systemClock} from "../../shared/clock.js";
import {toHttpsError} from "../../shared/errors.js";
import {
  changeMembershipRoleInput,
  changeMembershipRoleOutput,
  type ChangeMembershipRoleOutput,
} from "./schema.js";

export const changeMembershipRole = onCall(
  async (request): Promise<ChangeMembershipRoleOutput> => {
    const actorUid = requireUid(request.auth);

    const parsed = changeMembershipRoleInput.safeParse(request.data);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map(
        (issue) => issue.path.join(".") || "(payload)"))];
      throw new HttpsError(
        "invalid-argument", `Invalid input: ${fields.join(", ")}`);
    }
    const {tenantId, targetUid, newRole, reason} = parsed.data;

    const db = firestore();
    await authorizeTenantMember(db, actorUid, tenantId);

    try {
      const result = await new ChangeMembershipRole(
        new FirestoreUnitOfWork(db),
        systemClock,
      ).execute({
        tenantId,
        actorUid,
        targetUid,
        newRole,
        reason,
        device: {userAgent: request.rawRequest.get("user-agent")},
      });
      return changeMembershipRoleOutput.parse(result);
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
