import {DomainError} from "../../shared/domain/errors.js";
import {validateName} from "../../structure/domain/validation.js";
import type {PolicyData} from "./document.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function validateDay(value: string, field: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !DAY.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new DomainError(
      "invalid_argument",
      `${field} must be a valid date (YYYY-MM-DD)`,
    );
  }
  return value;
}

export function validatePolicyData(input: PolicyData): PolicyData {
  const number = validateName(input.number, "policy number");
  const insurer = validateName(input.insurer, "insurer");
  const validFrom = validateDay(input.validFrom, "validFrom");
  const validUntil = validateDay(input.validUntil, "validUntil");
  if (validUntil < validFrom) {
    throw new DomainError(
      "invalid_argument",
      "validUntil must not be before validFrom",
    );
  }
  return {number, insurer, validFrom, validUntil};
}
