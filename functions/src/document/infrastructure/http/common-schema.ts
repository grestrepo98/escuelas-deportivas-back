import {z} from "zod";
import type {PlayerDocument} from "../../domain/document.js";
import {DOCUMENT_TYPES} from "../../domain/document.js";

// Shapes shared by several routes. Business rules (a real calendar date, the
// size limits per type, ...) are checked by the domain, which answers
// invalid_argument; this layer fixes the shape and the sizes.
export const documentType = z.enum(DOCUMENT_TYPES);

export const policyStatus = z.enum(["valid", "expiring", "expired", "missing"]);

// GET routes that take no parameters still refuse unknown ones.
export const noQuery = z.object({}).strict();

export const policyInput = z
  .object({
    number: z.string().max(50),
    insurer: z.string().max(100),
    validFrom: z.string().max(10),
    validUntil: z.string().max(10),
  })
  .strict();

export const policyDto = z.object({
  number: z.string(),
  insurer: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
});

// The storage path stays inside the back: clients download through a signed
// URL, never by path.
export const documentDto = z.object({
  id: z.string(),
  playerId: z.string(),
  type: documentType,
  status: z.enum(["current", "superseded"]),
  supersededBy: z.string().optional(),
  file: z.object({contentType: z.string(), size: z.number()}).optional(),
  policy: policyDto.optional(),
  createdAt: z.string(), // ISO 8601, UTC
  createdBy: z.string(),
});

export function toDocumentDto(document: PlayerDocument) {
  const {file, createdAt, ...rest} = document;
  return documentDto.parse({
    ...rest,
    ...(file && {file: {contentType: file.contentType, size: file.size}}),
    createdAt: createdAt.toISOString(),
  });
}
