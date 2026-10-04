export const ROLES = [
  "owner", // owner or administrator
  "accountant", // administrative or accounting assistant
  "coordinator",
  "teacher",
  "guardian",
  "adultPlayer",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" &&
    (ROLES as readonly string[]).includes(value);
}
