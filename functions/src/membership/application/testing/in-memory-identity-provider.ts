import type {IdentityProvider} from "../identity-provider.js";

type Account = {uid: string; email: string; hasSignedIn: boolean};

// Emails are case-insensitive, like Firebase Auth, which lowercases them.
export class InMemoryIdentityProvider implements IdentityProvider {
  private accounts = new Map<string, Account>();
  private sequence = 0;

  // Test setup: an account that already exists, optionally already used.
  seed(
    email: string,
    {hasSignedIn = false}: {hasSignedIn?: boolean} = {},
  ): {uid: string} {
    const key = email.toLowerCase();
    this.sequence += 1;
    const account = {uid: `auth-${this.sequence}`, email: key, hasSignedIn};
    this.accounts.set(key, account);
    return {uid: account.uid};
  }

  async findByEmail(
    email: string,
  ): Promise<{uid: string; hasSignedIn: boolean} | null> {
    const found = this.accounts.get(email.toLowerCase());
    return found ? {uid: found.uid, hasSignedIn: found.hasSignedIn} : null;
  }

  async create(email: string): Promise<{uid: string}> {
    if (this.accounts.has(email.toLowerCase())) {
      throw new Error(`An account already exists for ${email}`);
    }
    return this.seed(email);
  }

  async createPasswordResetLink(email: string): Promise<string> {
    const found = this.accounts.get(email.toLowerCase());
    if (!found) {
      throw new Error(`No account for ${email}`);
    }
    return `https://reset.test/?email=${encodeURIComponent(found.email)}`;
  }

  async getEmails(uids: string[]): Promise<Map<string, string>> {
    const wanted = new Set(uids);
    const emails = new Map<string, string>();
    for (const account of this.accounts.values()) {
      if (wanted.has(account.uid)) {
        emails.set(account.uid, account.email);
      }
    }
    return emails;
  }
}
