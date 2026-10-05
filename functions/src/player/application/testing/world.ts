import {expect} from "vitest";
import {DomainError} from "../../../shared/domain/errors.js";
import {FakeClock} from "../../../shared/application/testing/fake-clock.js";
import {InMemoryAuditLogWriter} from "../../../audit/application/testing/in-memory-audit-log-writer.js";
import {InMemoryMembershipRepository} from "../../../membership/application/testing/in-memory-membership-repository.js";
import {InMemoryPlayerHistoryWriter} from "./in-memory-player-history-writer.js";
import {InMemoryUnitOfWork} from "../../../shared/application/testing/in-memory-unit-of-work.js";
import {buildGroup, buildMember} from "./fixtures.js";

export const NOW = new Date("2026-10-05T12:00:00Z");

// Two venues with one group each and one member per role of interest:
// owner-1, acc-1, coord-1 (venue-1), coord-2 (venue-2), teacher-1 (group-1).
export async function createWorld() {
  const clock = new FakeClock(NOW);
  const memberships = new InMemoryMembershipRepository();
  const auditLog = new InMemoryAuditLogWriter(clock);
  const uow = new InMemoryUnitOfWork(memberships, auditLog, {
    playerHistory: new InMemoryPlayerHistoryWriter(clock),
  });

  await memberships.save(buildMember("owner-1", "owner"));
  await memberships.save(buildMember("acc-1", "accountant"));
  await memberships.save(
    buildMember("coord-1", "coordinator", {venueIds: ["venue-1"]}),
  );
  await memberships.save(
    buildMember("coord-2", "coordinator", {venueIds: ["venue-2"]}),
  );
  await memberships.save(
    buildMember("teacher-1", "teacher", {groupIds: ["group-1"]}),
  );
  await uow.groups.save(buildGroup());
  await uow.groups.save(
    buildGroup({id: "group-2", venueId: "venue-2", categoryId: "category-2"}),
  );
  return {clock, memberships, auditLog, uow};
}

export type World = Awaited<ReturnType<typeof createWorld>>;

// Resolves with the DomainError the promise rejects with.
export async function failure(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return error as DomainError;
  }
  throw new Error("expected the use case to fail");
}
