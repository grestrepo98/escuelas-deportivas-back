import {DomainError} from "../../shared/domain/errors.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {
  isActiveMembershipOf,
  type Membership,
  type MembershipStatus,
  type Scope,
} from "../domain/membership.js";
import type {Role} from "../domain/role.js";
import type {IdentityProvider} from "./identity-provider.js";

export type ListMembershipsInput = {
  tenantId: string;
  actorUid: string;
};

export type MemberView = {
  uid: string;
  email: string;
  role: Role;
  status: MembershipStatus;
  scope: Scope;
};

export type ListMembershipsResult = {memberships: MemberView[]};

// What the actor may see, per the permission matrix (§6 of the product doc):
// owner and accountant see every member; a coordinator sees the coordinators
// that share one of their venues and the teachers with a group in one of
// them; teachers and families do not see users.
function visibility(
  actor: Membership,
  venueOfGroup: Map<string, string>,
): (target: Membership) => boolean {
  switch (actor.role) {
    case "owner":
    case "accountant":
      return () => true;
    case "coordinator": {
      const mine = new Set(actor.scope.venueIds);
      return (target) => {
        if (target.role === "coordinator") {
          return target.scope.venueIds.some((id) => mine.has(id));
        }
        if (target.role === "teacher") {
          return target.scope.groupIds.some((id) => {
            const venueId = venueOfGroup.get(id);
            return venueId !== undefined && mine.has(venueId);
          });
        }
        return false;
      };
    }
    default:
      throw new DomainError(
        "permission_denied",
        "Only the owner, an accountant or a coordinator can list members",
      );
  }
}

export class ListMemberships {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly identity: IdentityProvider,
  ) {}

  async execute(input: ListMembershipsInput): Promise<ListMembershipsResult> {
    const {tenantId, actorUid} = input;

    const visible = await this.unitOfWork.run(async (tx) => {
      const actor = await tx.memberships.get(actorUid, tenantId);
      if (!isActiveMembershipOf(actor, tenantId) || actor == null) {
        throw new DomainError(
          "permission_denied",
          "Only an active member of the tenant can list members",
        );
      }

      const groups = await tx.groups.listByTenant(tenantId);
      const venueOfGroup = new Map(groups.map((g) => [g.id, g.venueId]));
      const canSee = visibility(actor, venueOfGroup);

      const all = await tx.memberships.listByTenant(tenantId);
      return all.filter(canSee);
    });

    const emails = await this.identity.getEmails(visible.map((m) => m.uid));

    return {
      memberships: visible
        .map((m) => ({
          uid: m.uid,
          email: emails.get(m.uid) ?? "",
          role: m.role,
          status: m.status,
          scope: m.scope,
        }))
        .sort(
          (a, b) =>
            a.email.localeCompare(b.email, "en") ||
            a.uid.localeCompare(b.uid, "en"),
        ),
    };
  }
}
