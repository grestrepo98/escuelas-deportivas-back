import {
  membershipId,
  type Membership,
} from "../../src/membership/membership.js";
import type {Role} from "../../src/membership/role.js";
import type {
  MembershipRepository,
} from "../../src/ports/membership-repository.js";

export class InMemoryMembershipRepository implements MembershipRepository {
  private items = new Map<string, Membership>();

  async get(uid: string, tenantId: string): Promise<Membership | null> {
    const found = this.items.get(membershipId(uid, tenantId));
    return found ? structuredClone(found) : null;
  }

  async save(membership: Membership): Promise<void> {
    this.items.set(
      membershipId(membership.uid, membership.tenantId),
      structuredClone(membership),
    );
  }

  async countActiveByRole(tenantId: string, role: Role): Promise<number> {
    return [...this.items.values()].filter((m) =>
      m.tenantId === tenantId && m.role === role && m.status === "active",
    ).length;
  }

  snapshot(): Map<string, Membership> {
    return structuredClone(this.items);
  }

  restore(snapshot: Map<string, Membership>): void {
    this.items = structuredClone(snapshot);
  }
}
