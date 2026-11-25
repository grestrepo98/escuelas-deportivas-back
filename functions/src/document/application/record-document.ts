import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {requireStaff} from "../../player/application/require-staff.js";
import {DEFAULT_POLICY_WARNING_DAYS} from "../../tenant/domain/tenant.js";
import type {
  DocumentFile,
  PlayerDocument,
  PolicyData,
  PolicyStatus,
} from "../domain/document.js";
import {
  assertUploadAllowed,
  isDocumentType,
} from "../domain/document-limits.js";
import {
  UPLOAD_MAX_AGE_MS,
  documentPath,
  isValidUploadId,
  uploadPath,
} from "../domain/document-paths.js";
import {assertCanWriteDocument} from "../domain/document-visibility.js";
import {policyStatus} from "../domain/policy-status.js";
import {validatePolicyData} from "../domain/policy-validation.js";
import type {FileStorage} from "./file-storage.js";
import type {PlayerReader} from "./player-reader.js";

export type RecordDocumentInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  type: string;
  uploadId?: string;
  policy?: PolicyData;
  device?: {userAgent?: string};
};

export type RecordDocumentResult = {
  document: PlayerDocument;
  policyStatus?: PolicyStatus;
};

const invalid = (message: string) =>
  new DomainError("invalid_argument", message);

// Step 3 of D-08: confirm an upload (or record a policy without a file). The
// upload id becomes the document id, which makes confirming twice idempotent.
export class RecordDocument {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly players: PlayerReader,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  execute(input: RecordDocumentInput): Promise<RecordDocumentResult> {
    const {tenantId, actorUid, playerId, uploadId} = input;

    return this.unitOfWork.run(
      async ({memberships, documents, tenants, auditLog}) => {
        const actor = await requireStaff(memberships, tenantId, actorUid);
        const player = await this.players.get(tenantId, playerId);
        if (!player) {
          throw new DomainError("not_found", "Player not found");
        }
        assertCanWriteDocument(actor, player.venueId);

        const {type} = input;
        if (!isDocumentType(type)) {
          throw invalid("Unknown document type");
        }
        if (uploadId !== undefined && !isValidUploadId(uploadId)) {
          throw invalid("The upload id is not valid");
        }
        if (type !== "policy" && input.policy !== undefined) {
          throw invalid("Only a policy carries policy data");
        }
        if (type !== "policy" && uploadId === undefined) {
          throw invalid("An upload is required for this document type");
        }
        if (type === "policy" && input.policy === undefined) {
          throw invalid("The policy data is required");
        }
        const policy =
          input.policy === undefined
            ? undefined
            : validatePolicyData(input.policy);

        const tenant = await tenants.get(tenantId);
        const warningDays =
          tenant?.policyWarningDays ?? DEFAULT_POLICY_WARNING_DAYS;
        const now = this.clock.now();
        const statusOf = (data?: PolicyData): PolicyStatus | undefined =>
          type === "policy" ? policyStatus(data, now, warningDays) : undefined;

        if (uploadId !== undefined) {
          const existing = await documents.get(tenantId, uploadId);
          if (existing) {
            if (existing.playerId !== playerId || existing.type !== type) {
              throw invalid("This upload was already used");
            }
            return withStatus(existing, statusOf(existing.policy));
          }
        }

        const id = uploadId ?? documents.newId();
        const previous = await documents.findCurrent(tenantId, playerId, type);
        const file =
          uploadId === undefined
            ? undefined
            : await this.promote(tenantId, playerId, uploadId, type, now);

        const document: PlayerDocument = {
          id,
          tenantId,
          playerId,
          type,
          status: "current",
          ...(file !== undefined && {file}),
          ...(policy !== undefined && {policy}),
          createdAt: now,
          createdBy: actorUid,
        };

        if (previous) {
          await documents.save({
            ...previous,
            status: "superseded",
            supersededBy: id,
          });
        }
        await documents.save(document);

        const device = input.device ?? {};
        await auditLog.append({
          tenantId,
          actorUid,
          actorRole: actor.role,
          action: "document.recorded",
          target: {type: "document", id},
          before: {},
          after: {playerId, type, hasFile: file !== undefined},
          device,
        });
        if (previous) {
          await auditLog.append({
            tenantId,
            actorUid,
            actorRole: actor.role,
            action: "document.superseded",
            target: {type: "document", id: previous.id},
            before: {status: "current"},
            after: {status: "superseded", supersededBy: id},
            device,
          });
        }

        return withStatus(document, statusOf(policy));
      },
    );
  }

  // Verifies the stored object (never what the client declared) and moves it
  // to its final path. If a previous attempt already moved it but lost the
  // record, the file is found at the final path and the confirm completes.
  private async promote(
    tenantId: string,
    playerId: string,
    uploadId: string,
    type: PlayerDocument["type"],
    now: Date,
  ): Promise<DocumentFile> {
    const path = documentPath(tenantId, playerId, uploadId);
    const pending = uploadPath(tenantId, uploadId);

    const moved = await this.storage.stat(path);
    const stored = moved ?? (await this.storage.stat(pending));
    if (
      !stored ||
      (!moved && now.getTime() - stored.createdAt.getTime() > UPLOAD_MAX_AGE_MS)
    ) {
      throw invalid("The upload does not exist or has expired");
    }
    assertUploadAllowed({
      type,
      contentType: stored.contentType,
      size: stored.size,
    });
    if (!moved) {
      await this.storage.move(pending, path);
    }
    return {path, contentType: stored.contentType, size: stored.size};
  }
}

function withStatus(
  document: PlayerDocument,
  status: PolicyStatus | undefined,
): RecordDocumentResult {
  return status === undefined ? {document} : {document, policyStatus: status};
}
