import type {
  DocumentType,
  PlayerDocument,
} from "../document/domain/document.js";
import {documentPath} from "../document/domain/document-paths.js";
import {bogotaDay} from "../document/domain/policy-status.js";

const TENANT = "tenant-a";
const PDF = "application/pdf";
const PNG = "image/png";

// Fixed, so a seeded record is byte-identical on every run.
const SEED_DOCUMENT_DATE = new Date("2026-01-15T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

// Tiny fictitious files (spec 07): no real document of a minor goes into
// `dev` while Q12 is open.
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n% Archivo ficticio de prueba (seed)\n%%EOF\n",
);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export function seedFileBytes(contentType: string): Buffer {
  return contentType === PNG ? PNG_BYTES : PDF_BYTES;
}

// Policy dates are offsets from the day the seed runs, so the statuses
// (valid, expiring, expired) stay true whenever it is rerun.
type PolicyPlan = {
  number: string;
  insurer: string;
  fromDays: number;
  untilDays: number;
};

type Plan = {
  id: string;
  playerId: string;
  type: DocumentType;
  status?: "superseded";
  supersededBy?: string;
  contentType?: string; // the file, if any
  policy?: PolicyPlan;
  createdOffsetDays?: number;
};

const PLANS: Plan[] = [
  // valid policy with its file, plus identity and photo
  {
    id: "seed-doc-p1-identity",
    playerId: "seed-player-1",
    type: "identity",
    contentType: PDF,
  },
  {
    id: "seed-doc-p1-photo",
    playerId: "seed-player-1",
    type: "photo",
    contentType: PNG,
  },
  {
    id: "seed-doc-p1-policy",
    playerId: "seed-player-1",
    type: "policy",
    contentType: PDF,
    policy: {
      number: "SEED-0001",
      insurer: "Seguros Ficticios",
      fromDays: -30,
      untilDays: 90,
    },
  },
  // expiring policy recorded without a file (as an import would bring it)
  {
    id: "seed-doc-p2-policy",
    playerId: "seed-player-2",
    type: "policy",
    policy: {
      number: "SEED-0002",
      insurer: "Seguros Ficticios",
      fromDays: -355,
      untilDays: 10,
    },
  },
  // expired policy that replaced an older version
  {
    id: "seed-doc-p4-policy-v1",
    playerId: "seed-player-4",
    type: "policy",
    status: "superseded",
    supersededBy: "seed-doc-p4-policy",
    contentType: PDF,
    policy: {
      number: "SEED-0003",
      insurer: "Seguros Ficticios",
      fromDays: -730,
      untilDays: -385,
    },
    createdOffsetDays: -1,
  },
  {
    id: "seed-doc-p4-policy",
    playerId: "seed-player-4",
    type: "policy",
    contentType: PDF,
    policy: {
      number: "SEED-0003",
      insurer: "Seguros Ficticios",
      fromDays: -385,
      untilDays: -20,
    },
  },
  // a player with documents but no policy
  {
    id: "seed-doc-p7-identity",
    playerId: "seed-player-7",
    type: "identity",
    contentType: PDF,
  },
];

const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

export function buildSeedDocuments(
  now: Date,
  ownerUid: string,
): PlayerDocument[] {
  const today = bogotaDay(now);
  return PLANS.map((plan): PlayerDocument => {
    const bytes = plan.contentType ? seedFileBytes(plan.contentType) : null;
    return {
      id: plan.id,
      tenantId: TENANT,
      playerId: plan.playerId,
      type: plan.type,
      status: plan.status ?? "current",
      ...(plan.supersededBy !== undefined && {supersededBy: plan.supersededBy}),
      ...(plan.contentType !== undefined &&
        bytes !== null && {
          file: {
            path: documentPath(TENANT, plan.playerId, plan.id),
            contentType: plan.contentType,
            size: bytes.length,
          },
        }),
      ...(plan.policy !== undefined && {
        policy: {
          number: plan.policy.number,
          insurer: plan.policy.insurer,
          validFrom: addDays(today, plan.policy.fromDays),
          validUntil: addDays(today, plan.policy.untilDays),
        },
      }),
      createdAt: new Date(
        SEED_DOCUMENT_DATE.getTime() + (plan.createdOffsetDays ?? 0) * DAY_MS,
      ),
      createdBy: ownerUid,
    };
  });
}
