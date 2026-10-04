import type {
  Category,
  Group,
  ScheduleSlot,
  StructureStatus,
  Venue,
} from "../../domain/structure.js";
import {Timestamp, type DocumentData} from "firebase-admin/firestore";

// Converts one entity to and from its document. The id and the tenantId live
// in the document path, so they are not stored in the data.
export type StructureMapper<T> = {
  toDoc(entity: T): DocumentData;
  fromDoc(id: string, tenantId: string, data: DocumentData): T;
};

function status(kind: string, data: DocumentData): StructureStatus {
  if (data.status !== "active" && data.status !== "closed") {
    throw new Error(`Corrupt ${kind}: unknown status "${data.status}"`);
  }
  return data.status;
}

const toDate = (value: unknown): Date => (value as Timestamp).toDate();

export const venueMapper: StructureMapper<Venue> = {
  toDoc: (venue) => ({
    name: venue.name,
    address: venue.address,
    ...(venue.facility !== undefined && {facility: venue.facility}),
    status: venue.status,
    createdAt: Timestamp.fromDate(venue.createdAt),
    updatedAt: Timestamp.fromDate(venue.updatedAt),
  }),
  fromDoc: (id, tenantId, data) => ({
    id,
    tenantId,
    name: data.name,
    address: data.address,
    ...(data.facility !== undefined && {facility: data.facility}),
    status: status("venue", data),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }),
};

export const categoryMapper: StructureMapper<Category> = {
  toDoc: (category) => ({
    name: category.name,
    birthYears: category.birthYears,
    status: category.status,
    createdAt: Timestamp.fromDate(category.createdAt),
    updatedAt: Timestamp.fromDate(category.updatedAt),
  }),
  fromDoc: (id, tenantId, data) => ({
    id,
    tenantId,
    name: data.name,
    birthYears: data.birthYears ?? [],
    status: status("category", data),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }),
};

export const groupMapper: StructureMapper<Group> = {
  toDoc: (group) => ({
    venueId: group.venueId,
    categoryId: group.categoryId,
    name: group.name,
    schedule: group.schedule,
    status: group.status,
    createdAt: Timestamp.fromDate(group.createdAt),
    updatedAt: Timestamp.fromDate(group.updatedAt),
  }),
  fromDoc: (id, tenantId, data) => ({
    id,
    tenantId,
    venueId: data.venueId,
    categoryId: data.categoryId,
    name: data.name,
    // Firestore returns map keys sorted; rebuild each slot in a fixed order.
    schedule: (data.schedule ?? []).map((slot: ScheduleSlot) => ({
      weekday: slot.weekday,
      start: slot.start,
      end: slot.end,
    })),
    status: status("group", data),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }),
};
