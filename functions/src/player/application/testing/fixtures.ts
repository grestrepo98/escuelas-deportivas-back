import type {Membership} from "../../../membership/domain/membership.js";
import type {Group} from "../../../structure/domain/structure.js";
import type {Guardian} from "../../domain/guardian.js";
import type {Player} from "../../domain/player.js";

export function buildPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    tenantId: "tenant-a",
    firstNames: "Juan",
    lastNames: "Perez",
    nameKey: "perez juan",
    document: null,
    documentKey: null,
    birthDate: "2014-05-01",
    groupId: "group-1",
    venueId: "venue-1",
    categoryId: "category-1",
    status: "preinscrito",
    statusReason: null,
    joinedAt: new Date("2026-10-04T12:00:00Z"),
    emergencyContact: {
      name: "Ana Perez",
      phone: "3001112233",
      relationship: "madre",
    },
    medical: {},
    guardians: [],
    guardianIds: [],
    dataConsent: null,
    createdAt: new Date("2026-10-04T12:00:00Z"),
    updatedAt: new Date("2026-10-04T12:00:00Z"),
    ...overrides,
  };
}

export function buildGuardian(overrides: Partial<Guardian> = {}): Guardian {
  return {
    id: "guardian-1",
    tenantId: "tenant-a",
    firstNames: "Ana",
    lastNames: "Perez",
    document: {type: "CC", number: "1020304"},
    documentKey: "CC:1020304",
    phone: "3001112233",
    email: null,
    preferredContact: "whatsapp",
    createdAt: new Date("2026-10-04T12:00:00Z"),
    updatedAt: new Date("2026-10-04T12:00:00Z"),
    ...overrides,
  };
}

const T0 = new Date("2026-10-01T00:00:00Z");

export function buildMember(
  uid: string,
  role: Membership["role"],
  scope: Partial<Membership["scope"]> = {},
  overrides: Partial<Membership> = {},
): Membership {
  return {
    uid,
    tenantId: "tenant-a",
    role,
    status: "active",
    scope: {venueIds: [], groupIds: [], playerIds: [], ...scope},
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

export function buildGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    tenantId: "tenant-a",
    venueId: "venue-1",
    categoryId: "category-1",
    name: "Grupo A",
    schedule: [],
    status: "active",
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}
