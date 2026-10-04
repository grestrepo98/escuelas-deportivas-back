import {HttpsError, onCall} from "firebase-functions/v2/https";
import {
  findMyMemberships,
} from "../../firestore/my-memberships-query.js";
import {firestore} from "../../../../shared/infrastructure/admin.js";
import {requireUid} from "../../authorize.js";
import {
  listMyMembershipsInput,
  listMyMembershipsOutput,
  type ListMyMembershipsOutput,
} from "./schema.js";

export const listMyMemberships = onCall(
  async (request): Promise<ListMyMembershipsOutput> => {
    const uid = requireUid(request.auth);

    if (!listMyMembershipsInput.safeParse(request.data).success) {
      throw new HttpsError("invalid-argument", "This callable takes no input");
    }

    const memberships = await findMyMemberships(firestore(), uid);
    return listMyMembershipsOutput.parse({memberships});
  },
);
