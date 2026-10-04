export type StructureStatus = "active" | "closed";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Wall-clock time in America/Bogota, not an instant.
export type ScheduleSlot = {
  weekday: Weekday; // ISO 8601, 1 = Monday
  start: string; // "HH:mm"
  end: string; // "HH:mm", later than start
};

export type Venue = {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  facility?: string;
  status: StructureStatus;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};

export type Category = {
  id: string;
  tenantId: string;
  name: string;
  birthYears: number[]; // empty = level-based category
  status: StructureStatus;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};

export type Group = {
  id: string;
  tenantId: string;
  venueId: string; // immutable
  categoryId: string;
  name: string;
  schedule: ScheduleSlot[];
  status: StructureStatus;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};
