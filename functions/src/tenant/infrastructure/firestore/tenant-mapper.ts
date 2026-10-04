import type {Tenant} from "../../domain/tenant.js";
import {Timestamp, type DocumentData} from "firebase-admin/firestore";

// The id is the document id, so it is not stored in the data.
export function toTenantDoc(tenant: Tenant): DocumentData {
  return {
    name: tenant.name,
    status: tenant.status,
    ...(tenant.idrdRegistration !== undefined &&
      {idrdRegistration: tenant.idrdRegistration}),
    contact: {
      ...(tenant.contact.email !== undefined &&
        {email: tenant.contact.email}),
      ...(tenant.contact.phone !== undefined &&
        {phone: tenant.contact.phone}),
    },
    createdAt: Timestamp.fromDate(tenant.createdAt),
    updatedAt: Timestamp.fromDate(tenant.updatedAt),
  };
}

// Tenants created before spec 02 have no `contact` or `updatedAt`.
export function fromTenantDoc(id: string, data: DocumentData): Tenant {
  if (data.status !== "active" && data.status !== "suspended") {
    throw new Error(`Corrupt tenant: unknown status "${data.status}"`);
  }
  const createdAt = (data.createdAt as Timestamp).toDate();
  return {
    id,
    name: data.name,
    status: data.status,
    ...(data.idrdRegistration !== undefined &&
      {idrdRegistration: data.idrdRegistration}),
    contact: {
      ...(data.contact?.email !== undefined && {email: data.contact.email}),
      ...(data.contact?.phone !== undefined && {phone: data.contact.phone}),
    },
    createdAt,
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate() ??
      createdAt,
  };
}
