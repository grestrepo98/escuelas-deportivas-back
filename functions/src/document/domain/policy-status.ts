import type {PolicyData, PolicyStatus} from "./document.js";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar day (YYYY-MM-DD) of an instant in America/Bogota.
export function bogotaDay(instant: Date): string {
  return new Date(instant.getTime() - BOGOTA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS;
}

// `validUntil` is inclusive: the policy is still valid until the day ends in
// Bogota.
export function policyStatus(
  policy: PolicyData | undefined,
  now: Date,
  warningDays: number,
): PolicyStatus {
  if (!policy) return "missing";
  const daysLeft = dayNumber(policy.validUntil) - dayNumber(bogotaDay(now));
  if (daysLeft < 0) return "expired";
  if (daysLeft <= warningDays) return "expiring";
  return "valid";
}
