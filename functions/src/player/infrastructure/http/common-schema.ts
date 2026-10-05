import {z} from "zod";
import {CONTACT_PREFERENCES} from "../../domain/guardian.js";
import {DOCUMENT_TYPES, PLAYER_STATUSES} from "../../domain/player.js";

// Shapes shared by several routes. Business rules (a real calendar date, a
// payment responsible per player, ...) are checked by the domain, which
// answers invalid_argument; this layer fixes the shape and the sizes, so a
// request cannot carry an unbounded payload.
export const text = (max: number) => z.string().max(max);

export const playerStatus = z.enum(PLAYER_STATUSES);
export const documentType = z.enum(DOCUMENT_TYPES);
export const contactPreference = z.enum(CONTACT_PREFERENCES);

export const personDocument = z
  .object({type: documentType, number: text(30)})
  .strict();

export const emergencyContact = z
  .object({name: text(100), phone: text(30), relationship: text(50)})
  .strict();

export const medical = z
  .object({
    bloodType: text(10).optional(),
    allergies: text(500).optional(),
    conditions: text(500).optional(),
    medications: text(500).optional(),
    notes: text(500).optional(),
  })
  .strict();

const newGuardian = z
  .object({
    firstNames: text(100),
    lastNames: text(100),
    document: personDocument,
    phone: text(30),
    email: z.email().max(120).nullable().optional(),
    preferredContact: contactPreference,
  })
  .strict();

const linkFields = {relationship: text(50), isPaymentResponsible: z.boolean()};

// An existing guardian by id, or a new one created in the same call.
export const guardianLinks = z
  .array(
    z.union([
      z.object({guardianId: z.string().min(1), ...linkFields}).strict(),
      z.object({guardian: newGuardian, ...linkFields}).strict(),
    ]),
  )
  .max(10);

// GET routes that take no parameters still refuse unknown ones.
export const noQuery = z.object({}).strict();

// ISO 8601, UTC.
export const isoDate = z.string();

export const dataConsentDto = z.object({
  guardianId: z.string(),
  recordedBy: z.string(),
  at: isoDate,
});

export const guardianLinkDto = z.object({
  guardianId: z.string(),
  fullName: z.string(),
  relationship: z.string(),
  isPaymentResponsible: z.boolean(),
});
