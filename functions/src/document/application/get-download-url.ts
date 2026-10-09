import {DomainError} from "../../shared/domain/errors.js";
import type {Clock} from "../../shared/domain/clock.js";
import type {UnitOfWork} from "../../shared/application/unit-of-work.js";
import {DOWNLOAD_URL_TTL_MS} from "../domain/document-paths.js";
import {assertCanReadDocument} from "../domain/document-visibility.js";
import type {DownloadLink, FileStorage} from "./file-storage.js";
import type {PlayerReader} from "./player-reader.js";
import {requireReader} from "./require-reader.js";

export type GetDownloadUrlInput = {
  tenantId: string;
  actorUid: string;
  playerId: string;
  documentId: string;
};

export type GetDownloadUrlResult = DownloadLink;

export class GetDownloadUrl {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly players: PlayerReader,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  execute(input: GetDownloadUrlInput): Promise<GetDownloadUrlResult> {
    const {tenantId, actorUid, playerId} = input;

    return this.unitOfWork.run(async ({memberships, documents}) => {
      const actor = await requireReader(memberships, tenantId, actorUid);
      const player = await this.players.get(tenantId, playerId);
      if (!player) {
        throw new DomainError("not_found", "Player not found");
      }
      const document = await documents.get(tenantId, input.documentId);
      if (!document || document.playerId !== playerId) {
        throw new DomainError("not_found", "Document not found");
      }
      assertCanReadDocument(actor, {...player, type: document.type});
      if (!document.file) {
        throw new DomainError(
          "failed_precondition",
          "This document has no file",
        );
      }

      return this.storage.createDownloadUrl({
        path: document.file.path,
        expiresAt: new Date(this.clock.now().getTime() + DOWNLOAD_URL_TTL_MS),
      });
    });
  }
}
