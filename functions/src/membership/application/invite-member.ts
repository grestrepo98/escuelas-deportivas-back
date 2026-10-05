import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {membershipId, type Membership} from "../domain/membership.js";
import type {Role} from "../domain/role.js";
import {resolveScopeForRole, type ScopeInput} from "../domain/scope.js";
import type {IdentityProvider} from "./identity-provider.js";
import {requireOwner} from "./require-owner.js";
import {assertScopeReferences} from "./scope-references.js";

// Guardians and adult players need players to scope them (later spec); an
// owner is made by tenant:create or by changing a role.
export const INVITABLE_ROLES = [
  "accountant",
  "coordinator",
  "teacher",
] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitable(role: Role): role is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role);
}

export type InviteMemberInput = {
  tenantId: string;
  actorUid: string;
  email: string;
  role: Role;
  scope?: ScopeInput;
  device?: {userAgent?: string};
};

export type InviteMemberResult = {
  uid: string;
  membershipId: string;
  role: Role;
  // Only when the person has never signed in: otherwise they use their own
  // credentials.
  passwordResetLink?: string;
};

// Invitation without email: the owner shares the reset link on their own.
//
// Firebase Auth does not take part in the Firestore transaction. The account
// is created after the owner and the scope were checked and before the write
// transaction; if that fails, the account stays without a membership (it
// grants nothing) and the next invitation reuses it, because it has still
// never signed in.
export class InviteMember {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly identity: IdentityProvider,
    private readonly clock: Clock,
  ) {}

  async execute(input: InviteMemberInput): Promise<InviteMemberResult> {
    const {tenantId, actorUid, role} = input;
    const email = input.email.trim().toLowerCase();

    // Phase 1: nothing is created until the request is known to be valid.
    await this.unitOfWork.run(async (tx) => {
      await requireOwner(tx.memberships, tenantId, actorUid);
      const scope = this.validate(role, email, input.scope);
      await assertScopeReferences(tx, tenantId, scope);
    });

    // Phase 2: the identity, outside any transaction.
    const existing = await this.identity.findByEmail(email);
    const uid = existing?.uid ?? (await this.identity.create(email)).uid;
    const needsLink = existing === null || !existing.hasSignedIn;
    const passwordResetLink = needsLink
      ? await this.identity.createPasswordResetLink(email)
      : undefined;

    // Phase 3: the membership and its audit entry, atomically. The checks of
    // phase 1 are repeated because the structure may have changed since.
    return this.unitOfWork.run(async (tx) => {
      const actorRole = await requireOwner(tx.memberships, tenantId, actorUid);
      const scope = this.validate(role, email, input.scope);
      await assertScopeReferences(tx, tenantId, scope);

      if (await tx.memberships.get(uid, tenantId)) {
        throw new DomainError(
          "failed_precondition",
          "This person already has a membership in the organization",
        );
      }

      const now = this.clock.now();
      const membership: Membership = {
        uid,
        tenantId,
        role,
        status: "active",
        scope,
        createdAt: now,
        updatedAt: now,
      };
      await tx.memberships.save(membership);

      const id = membershipId(uid, tenantId);
      await tx.auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: "membership.invited",
        target: {type: "membership", id},
        before: {},
        after: {role, status: "active", scope},
        device: input.device ?? {},
      });

      return {
        uid,
        membershipId: id,
        role,
        ...(passwordResetLink !== undefined && {passwordResetLink}),
      };
    });
  }

  private validate(role: Role, email: string, scope?: ScopeInput) {
    if (email === "") {
      throw new DomainError("invalid_argument", "The email is required");
    }
    if (!isInvitable(role)) {
      throw new DomainError("invalid_argument", `A ${role} cannot be invited`);
    }
    return resolveScopeForRole(role, scope);
  }
}
