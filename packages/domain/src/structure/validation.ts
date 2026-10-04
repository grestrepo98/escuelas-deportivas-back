import {DomainError} from "../errors.js";
import type {ScheduleSlot} from "./structure.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function invalid(message: string): DomainError {
  return new DomainError("invalid_argument", message);
}

export function validateName(value: string, field = "name"): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw invalid(`${field} must not be blank`);
  }
  return trimmed;
}

// Names are unique among active records, ignoring case and outer spaces.
export function isNameTaken(
  items: {id: string; name: string; status: string}[],
  name: string,
  excludeId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return items.some((item) =>
    item.status === "active" &&
    item.id !== excludeId &&
    item.name.trim().toLowerCase() === wanted);
}

export function validateBirthYears(years: number[]): number[] {
  for (const year of years) {
    if (!Number.isInteger(year)) {
      throw invalid(`birth year must be an integer: ${year}`);
    }
  }
  return years;
}

function validateTime(value: string): void {
  if (!TIME_PATTERN.test(value)) {
    throw invalid(`time must be HH:mm: ${value}`);
  }
}

// "HH:mm" is zero-padded, so string comparison orders it correctly.
export function validateSchedule(schedule: ScheduleSlot[]): ScheduleSlot[] {
  for (const slot of schedule) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 1 ||
      slot.weekday > 7) {
      throw invalid(`weekday must be 1-7: ${slot.weekday}`);
    }
    validateTime(slot.start);
    validateTime(slot.end);
    if (slot.end <= slot.start) {
      throw invalid(`end must be later than start: ${slot.start}-${slot.end}`);
    }
  }
  return schedule;
}
