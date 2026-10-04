import {
  visibleStructure,
  type Structure,
} from "../../../domain/visible-structure.js";
import {onCall} from "firebase-functions/v2/https";
import {readStructure} from "../../firestore/structure-query.js";
import {firestore} from "../../../../shared/infrastructure/admin.js";
import {
  authorizeTenantMember,
  requireUid,
} from "../../../../membership/infrastructure/authorize.js";
import {parseInput} from "../../../../shared/infrastructure/callable.js";
import {
  toHttpsError,
} from "../../../../shared/infrastructure/to-https-error.js";
import {
  getStructureInput,
  getStructureOutput,
  type GetStructureOutput,
} from "./schema.js";

const byName = (a: {name: string}, b: {name: string}) =>
  a.name.localeCompare(b.name, "es", {sensitivity: "base"});

// Closed records are filtered out before the visibility rules apply, so a
// teacher is not shown the venue of a group that is hidden.
function withoutClosed(structure: Structure): Structure {
  return {
    venues: structure.venues.filter((v) => v.status === "active"),
    categories: structure.categories.filter((c) => c.status === "active"),
    groups: structure.groups.filter((g) => g.status === "active"),
  };
}

function toDto(structure: Structure): GetStructureOutput {
  return {
    venues: [...structure.venues].sort(byName).map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      ...(v.facility !== undefined && {facility: v.facility}),
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
    categories: [...structure.categories].sort(byName).map((c) => ({
      id: c.id,
      name: c.name,
      birthYears: c.birthYears,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    groups: [...structure.groups].sort(byName).map((g) => ({
      id: g.id,
      venueId: g.venueId,
      categoryId: g.categoryId,
      name: g.name,
      schedule: g.schedule,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
  };
}

export const getStructure = onCall(
  async (request): Promise<GetStructureOutput> => {
    const uid = requireUid(request.auth);
    const {tenantId, includeClosed} =
      parseInput(getStructureInput, request.data);

    const db = firestore();
    const membership = await authorizeTenantMember(db, uid, tenantId);

    try {
      const all = await readStructure(db, tenantId);
      const visible = visibleStructure(
        membership,
        includeClosed ? all : withoutClosed(all),
      );
      return getStructureOutput.parse(toDto(visible));
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
