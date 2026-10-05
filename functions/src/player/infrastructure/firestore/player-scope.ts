import type {Firestore, Query} from "firebase-admin/firestore";
import {DomainError} from "../../../shared/domain/errors.js";
import {
  isActiveMembershipOf,
  type Membership,
} from "../../../membership/domain/membership.js";
import {
  PLAYER_STATUSES,
  type Player,
  type PlayerStatus,
} from "../../domain/player.js";
import {
  assertCanListPlayers,
  canReadPlayer,
} from "../../domain/player-visibility.js";

// Firestore allows at most 30 values in an `in` filter.
const IN_LIMIT = 30;

export type LocationFilter = {
  venueId?: string;
  categoryId?: string;
  groupId?: string;
};

export type ScopedPlayerQuery = {
  query: Query;
  // The visibility rule of the domain. Firestore narrows the query as far as
  // the indexes allow, and this decides the rest, so the answer never
  // depends on how well the query narrowed.
  canRead(player: Player): boolean;
};

// The membership comes from the route, which loads it; this proves it is
// active in the tenant and may list players.
export function assertMayListPlayers(
  membership: Membership,
  tenantId: string,
): void {
  if (!isActiveMembershipOf(membership, tenantId)) {
    throw new DomainError(
      "permission_denied",
      "Only an active member of the organization can read players",
    );
  }
  assertCanListPlayers(membership);
}

export function assertValidStatus(status: PlayerStatus | undefined): void {
  if (status !== undefined && !PLAYER_STATUSES.includes(status)) {
    throw new DomainError("invalid_argument", `Unknown status "${status}"`);
  }
}

// At most one location filter, and one inside the actor's scope.
export async function checkLocationFilter(
  db: Firestore,
  tenantId: string,
  membership: Membership,
  filter: LocationFilter,
): Promise<void> {
  const given = [filter.venueId, filter.categoryId, filter.groupId].filter(
    (value) => value !== undefined,
  );
  if (given.length > 1) {
    throw new DomainError(
      "invalid_argument",
      "Filter by only one of venueId, categoryId or groupId",
    );
  }

  const {role, scope} = membership;
  const outside = () =>
    new DomainError("permission_denied", "That filter is outside your scope");

  if (role === "coordinator") {
    if (
      filter.venueId !== undefined &&
      !scope.venueIds.includes(filter.venueId)
    ) {
      throw outside();
    }
    if (filter.groupId !== undefined) {
      const group = await db
        .doc(`tenants/${tenantId}/groups/${filter.groupId}`)
        .get();
      if (!group.exists) {
        throw new DomainError("not_found", "Group not found");
      }
      if (!scope.venueIds.includes(group.data()!.venueId)) {
        throw outside();
      }
    }
  }
  if (
    role === "teacher" &&
    filter.groupId !== undefined &&
    !scope.groupIds.includes(filter.groupId)
  ) {
    throw outside();
  }
}

// The players the actor may read, narrowed by an optional filter. Returns
// null when the scope is empty, so nothing is visible. Without a filter the
// coordinator is narrowed by `venueId in` and the teacher by `groupId in`.
export function scopedPlayerQuery(
  db: Firestore,
  tenantId: string,
  membership: Membership,
  filter: LocationFilter & {status?: PlayerStatus},
): ScopedPlayerQuery | null {
  let query: Query = db.collection(`tenants/${tenantId}/players`);

  if (filter.venueId !== undefined) {
    query = query.where("venueId", "==", filter.venueId);
  } else if (filter.categoryId !== undefined) {
    query = query.where("categoryId", "==", filter.categoryId);
  } else if (filter.groupId !== undefined) {
    query = query.where("groupId", "==", filter.groupId);
  } else if (
    membership.role === "coordinator" ||
    membership.role === "teacher"
  ) {
    const byVenue = membership.role === "coordinator";
    const ids = [
      ...new Set(
        byVenue ? membership.scope.venueIds : membership.scope.groupIds,
      ),
    ];
    if (ids.length === 0) {
      return null;
    }
    // Past the limit there is no single `in`: the domain rule trims instead.
    if (ids.length <= IN_LIMIT) {
      query = query.where(byVenue ? "venueId" : "groupId", "in", ids);
    }
  }

  if (filter.status !== undefined) {
    query = query.where("status", "==", filter.status);
  }
  return {query, canRead: (player) => canReadPlayer(membership, player)};
}
