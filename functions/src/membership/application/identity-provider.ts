// Port to the identity system (Firebase Auth). It is not transactional: an
// account created here survives a failed Firestore transaction, so inviting
// the same email again must reuse it (spec 05).
export interface IdentityProvider {
  findByEmail(
    email: string,
  ): Promise<{uid: string; hasSignedIn: boolean} | null>;
  create(email: string): Promise<{uid: string}>;
  createPasswordResetLink(email: string): Promise<string>;
  // Uids without an account are left out of the map.
  getEmails(uids: string[]): Promise<Map<string, string>>;
}
