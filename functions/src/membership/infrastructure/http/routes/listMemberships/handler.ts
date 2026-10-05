import type {RequestHandler} from "express";
import {ListMemberships} from "../../../../application/list-memberships.js";
import {FirebaseIdentityProvider} from "../../../firebase/firebase-identity-provider.js";
import {FirestoreUnitOfWork} from "../../../../../shared/infrastructure/firestore-unit-of-work.js";
import {
  adminAuth,
  firestore,
} from "../../../../../shared/infrastructure/admin.js";
import {authorizeTenantMember, requireUid} from "../../../authorize.js";
import {listMembershipsOutput} from "./schema.js";

export const listMemberships: RequestHandler<{tenantId: string}> = async (
  req,
  res,
) => {
  const actorUid = requireUid(res.locals.uid);
  const {tenantId} = req.params;

  const db = firestore();
  await authorizeTenantMember(db, actorUid, tenantId);

  const result = await new ListMemberships(
    new FirestoreUnitOfWork(db),
    new FirebaseIdentityProvider(adminAuth()),
  ).execute({tenantId, actorUid});
  res.json(listMembershipsOutput.parse(result));
};
