import {getAuth} from "firebase-admin/auth";
import {beforeEach, describe, expect, it} from "vitest";
import {FirebaseIdentityProvider} from "./firebase-identity-provider.js";
import {testApp} from "../../../shared/infrastructure/testing/helpers.js";
import {
  clearAuth,
  createUser,
} from "../../../shared/infrastructure/testing/emulator-helpers.js";

const auth = getAuth(testApp());
const identity = new FirebaseIdentityProvider(auth);

beforeEach(async () => {
  await clearAuth();
});

describe("FirebaseIdentityProvider.findByEmail", () => {
  it("returns null when there is no account", async () => {
    expect(await identity.findByEmail("nobody@club.co")).toBeNull();
  });

  it("finds an account created by create(), never signed in", async () => {
    const {uid} = await identity.create("ana@club.co");

    expect(await identity.findByEmail("ana@club.co")).toEqual({
      uid,
      hasSignedIn: false,
    });
  });

  it("reports an account that has signed in", async () => {
    const user = await createUser("beto@club.co");

    expect(await identity.findByEmail("beto@club.co")).toEqual({
      uid: user.uid,
      hasSignedIn: true,
    });
  });

  it("does not hide other errors as a missing account", async () => {
    await expect(identity.findByEmail("not-an-email")).rejects.toThrow();
  });
});

describe("FirebaseIdentityProvider.create", () => {
  it("creates an account with that email and no password", async () => {
    const {uid} = await identity.create("ana@club.co");
    const user = await auth.getUser(uid);
    expect(user.email).toBe("ana@club.co");
    expect(user.passwordHash).toBeUndefined();
  });

  it("fails when the email is already taken", async () => {
    await identity.create("ana@club.co");
    await expect(identity.create("ana@club.co")).rejects.toThrow();
  });
});

describe("FirebaseIdentityProvider.createPasswordResetLink", () => {
  it("returns a reset link for an existing account", async () => {
    await identity.create("ana@club.co");

    const link = await identity.createPasswordResetLink("ana@club.co");

    expect(link).toContain("oobCode=");
    expect(() => new URL(link)).not.toThrow();
  });

  it("fails for an email without an account", async () => {
    await expect(
      identity.createPasswordResetLink("nobody@club.co"),
    ).rejects.toThrow();
  });
});

describe("FirebaseIdentityProvider.getEmails", () => {
  it("maps uids to emails and leaves unknown uids out", async () => {
    const a = await identity.create("ana@club.co");
    const b = await identity.create("beto@club.co");

    const emails = await identity.getEmails([a.uid, "ghost", b.uid]);

    expect(emails).toEqual(
      new Map([
        [a.uid, "ana@club.co"],
        [b.uid, "beto@club.co"],
      ]),
    );
  });

  it("returns an empty map without calling Auth for no uids", async () => {
    expect(await identity.getEmails([])).toEqual(new Map());
  });

  it("handles more uids than one Auth lookup allows (100)", async () => {
    const created = await Promise.all(
      Array.from({length: 101}, (_, i) => identity.create(`u${i}@club.co`)),
    );

    const emails = await identity.getEmails(created.map((c) => c.uid));

    expect(emails.size).toBe(101);
    expect(emails.get(created[100].uid)).toBe("u100@club.co");
  });
});
