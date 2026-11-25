import {DomainError} from "../../shared/domain/errors.js";

export const DEFAULT_POLICY_WARNING_DAYS = 30;

export type TenantStatus = "active" | "suspended";

export type Tenant = {
  id: string;
  name: string;
  status: TenantStatus;
  idrdRegistration?: string;
  contact: {email?: string; phone?: string};
  policyWarningDays: number; // days before a policy expires to warn
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};

export function validatePolicyWarningDays(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new DomainError(
      "invalid_argument",
      "policyWarningDays must be a whole number between 1 and 365",
    );
  }
  return value;
}
