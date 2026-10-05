import type {Guardian} from "../domain/guardian.js";

export interface GuardianRepository {
  newId(): string;
  get(tenantId: string, id: string): Promise<Guardian | null>;
  save(guardian: Guardian): Promise<void>;
  findByDocumentKey(
    tenantId: string,
    documentKey: string,
  ): Promise<Guardian | null>;
}
