import {DomainError} from "../../shared/domain/errors.js";

function invalid(message: string): DomainError {
  return new DomainError("invalid_argument", message);
}

export function validateRequiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw invalid(`${field} must not be blank`);
  }
  return trimmed;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const OLDEST_BIRTH_YEAR = 1900;

// "YYYY-MM-DD", a real calendar date, not in the future and not before 1900.
export function validateBirthDate(value: string, now: Date): string {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw invalid("birthDate must be formatted as YYYY-MM-DD");
  }
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exists =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!exists) {
    throw invalid("birthDate is not a real date");
  }
  if (year < OLDEST_BIRTH_YEAR) {
    throw invalid("birthDate is too far in the past");
  }
  if (value > now.toISOString().slice(0, 10)) {
    throw invalid("birthDate must not be in the future");
  }
  return value;
}
