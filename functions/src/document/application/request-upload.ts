import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {requireStaff} from "../../player/application/require-staff.js";
import {
  assertUploadAllowed,
  isDocumentType,
} from "../domain/document-limits.js";
import {UPLOAD_URL_TTL_MS} from "../domain/document-paths.js";
import {assertCanWriteDocument} from "../domain/document-visibility.js";
import type {FileStorage, UploadTicket} from "./file-storage.js";
import type {PlayerReader} from "./player-reader.js";

export type RequestUploadInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  type: string;
  contentType: string;
  size: number;
  device?: {userAgent?: string};
};

export type RequestUploadResult = UploadTicket;

// Step 1 of D-08: the client gets a short-lived URL to upload straight to
// Storage. Nothing is recorded until the upload is confirmed.
export class RequestUpload {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly players: PlayerReader,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  execute(input: RequestUploadInput): Promise<RequestUploadResult> {
    const {tenantId, actorUid, playerId, contentType, size} = input;

    return this.unitOfWork.run(async ({memberships, auditLog}) => {
      const actor = await requireStaff(memberships, tenantId, actorUid);
      const player = await this.players.get(tenantId, playerId);
      if (!player) {
        throw new DomainError("not_found", "Player not found");
      }
      assertCanWriteDocument(actor, player.venueId);

      const {type} = input;
      if (!isDocumentType(type)) {
        throw new DomainError("invalid_argument", "Unknown document type");
      }
      assertUploadAllowed({type, contentType, size});

      const ticket = await this.storage.createUpload({
        tenantId,
        contentType,
        size,
        expiresAt: new Date(this.clock.now().getTime() + UPLOAD_URL_TTL_MS),
      });

      await auditLog.append({
        tenantId,
        actorUid,
        actorRole: actor.role,
        action: "document.uploaded",
        target: {type: "document", id: ticket.uploadId},
        before: {},
        after: {playerId, type, contentType, size},
        device: input.device ?? {},
      });

      return ticket;
    });
  }
}
