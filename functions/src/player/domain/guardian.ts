import type {PersonDocument} from "./player.js";

export const CONTACT_PREFERENCES = ["phone", "whatsapp", "email"] as const;

export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export type Guardian = {
  id: string;
  tenantId: string;
  firstNames: string;
  lastNames: string;
  document: PersonDocument;
  documentKey: string;
  phone: string;
  email: string | null;
  preferredContact: ContactPreference;
  createdAt: Date; // UTC
  updatedAt: Date; // UTC
};
