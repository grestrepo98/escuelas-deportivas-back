import type {Auth} from "firebase-admin/auth";
import type {IdentityProvider} from "../../application/identity-provider.js";

// Firebase Auth accepts at most 100 identifiers per getUsers call.
const GET_USERS_LIMIT = 100;

export class FirebaseIdentityProvider implements IdentityProvider {
  constructor(private readonly auth: Auth) {}

  async findByEmail(
    email: string,
  ): Promise<{uid: string; hasSignedIn: boolean} | null> {
    try {
      const user = await this.auth.getUserByEmail(email);
      // Not `lastSignInTime`: the Admin SDK fills it with the creation time
      // for an account that never signed in. `lastRefreshTime` stays null
      // until the person enters for the first time.
      return {
        uid: user.uid,
        hasSignedIn: Boolean(user.metadata.lastRefreshTime),
      };
    } catch (error) {
      if ((error as {code?: string}).code === "auth/user-not-found") {
        return null;
      }
      throw error;
    }
  }

  async create(email: string): Promise<{uid: string}> {
    const user = await this.auth.createUser({email});
    return {uid: user.uid};
  }

  createPasswordResetLink(email: string): Promise<string> {
    return this.auth.generatePasswordResetLink(email);
  }

  async getEmails(uids: string[]): Promise<Map<string, string>> {
    const emails = new Map<string, string>();
    for (let i = 0; i < uids.length; i += GET_USERS_LIMIT) {
      const batch = uids.slice(i, i + GET_USERS_LIMIT);
      const {users} = await this.auth.getUsers(batch.map((uid) => ({uid})));
      for (const user of users) {
        if (user.email) {
          emails.set(user.uid, user.email);
        }
      }
    }
    return emails;
  }
}
