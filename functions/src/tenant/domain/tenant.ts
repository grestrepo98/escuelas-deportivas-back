export type TenantStatus = "active" | "suspended";

export type Tenant = {
  id: string;
  name: string;
  status: TenantStatus;
  idrdRegistration?: string;
  contact: {email?: string; phone?: string};
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};
