import type {RequestHandler} from "express";
import {InviteMember} from "../../../../application/invite-member.js";
import {FirebaseIdentityProvider} from "../../../firebase/firebase-identity-provider.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {
  adminAuth,
  firestore,
} from "../../../../../shared/infrastructure/admin.js";
import {deviceOf} from "../../../../../shared/infrastructure/http/device.js";
import {parseInput} from "../../../../../shared/infrastructure/http/parse.js";
import {systemClock} from "../../../../../shared/infrastructure/system-clock.js";
import {authorizeTenantMember, requireUid} from "../../../authorize.js";
import {inviteMemberInput, inviteMemberOutput} from "./schema.js";

export const inviteMember: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const actorUid = requireUid(res.locals.uid);
  const {email, role, scope} = parseInput(inviteMemberInput, req.body);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new InviteMember(
    new FirestoreUnitOfWork(db),
    new FirebaseIdentityProvider(adminAuth()),
    systemClock,
  ).execute({
    tenantId,
    actorUid,
    email,
    role,
    scope,
    device: deviceOf(req),
  });
  res.status(201).json(inviteMemberOutput.parse(result));
};
