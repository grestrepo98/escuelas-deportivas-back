import {DomainError} from "../../shared/domain/errors.js";
import {requireOwner} from "../../membership/application/require-owner.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {validateName} from "../../structure/domain/validation.js";
import {validatePolicyWarningDays, type Tenant} from "../domain/tenant.js";

export type UpdateTenantProfileInput = {
  tenantId: string;
  actorUid: string;
  name: string;
  idrdRegistration?: string;
  contact: {email?: string; phone?: string};
  policyWarningDays?: number;
  device?: {userAgent?: string};
};

export type UpdateTenantProfileResult = {tenantId: string};

const snapshot = (tenant: Tenant): Record<string, unknown> => ({
  name: tenant.name,
  ...(tenant.idrdRegistration !== undefined && {
    idrdRegistration: tenant.idrdRegistration,
  }),
  contact: tenant.contact,
  policyWarningDays: tenant.policyWarningDays,
});

// Blank optional text is stored as absent.
const optional = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;

export class UpdateTenantProfile {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(input: UpdateTenantProfileInput): Promise<UpdateTenantProfileResult> {
    const {tenantId, actorUid} = input;

    return this.unitOfWork.run(async ({memberships, tenants, auditLog}) => {
      const actorRole = await requireOwner(memberships, tenantId, actorUid);

      const name = validateName(input.name);
      const idrdRegistration = optional(input.idrdRegistration);
      const email = optional(input.contact.email);
      const phone = optional(input.contact.phone);
      const policyWarningDays =
        input.policyWarningDays === undefined
          ? undefined
          : validatePolicyWarningDays(input.policyWarningDays);

      const tenant = await tenants.get(tenantId);
      if (!tenant) {
        throw new DomainError("not_found", "Organization not found");
      }

      const updated: Tenant = {
        id: tenant.id,
        name,
        status: tenant.status,
        ...(idrdRegistration !== undefined && {idrdRegistration}),
        contact: {
          ...(email !== undefined && {email}),
          ...(phone !== undefined && {phone}),
        },
        policyWarningDays: policyWarningDays ?? tenant.policyWarningDays,
        createdAt: tenant.createdAt,
        updatedAt: this.clock.now(),
      };
      await tenants.save(updated);

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole,
        action: "tenant.updated",
        target: {type: "tenant", id: tenantId},
        before: snapshot(tenant),
        after: snapshot(updated),
        device: input.device ?? {},
      });

      return {tenantId};
    });
  }
}
