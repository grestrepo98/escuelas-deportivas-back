import {INTEGRATION_PROJECT_ID} from "./helpers.js";

const functionsHost = () =>
  process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

export type TestUser = {uid: string; idToken: string};

// Creates a user in the Auth emulator and returns its uid and ID token.
export async function createUser(email: string): Promise<TestUser> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) throw new Error("FIREBASE_AUTH_EMULATOR_HOST is not set");
  const url = `http://${host}/identitytoolkit.googleapis.com` +
    "/v1/accounts:signUp?key=fake";
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email,
      password: "secret-pass-1",
      returnSecureToken: true,
    }),
  });
  if (!response.ok) throw new Error(`signUp failed: ${response.status}`);
  const body = await response.json() as {localId: string; idToken: string};
  return {uid: body.localId, idToken: body.idToken};
}

export async function clearAuth(): Promise<void> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  await fetch(
    `http://${host}/emulator/v1/projects/${INTEGRATION_PROJECT_ID}/accounts`,
    {method: "DELETE"},
  );
}

export type CallableResponse = {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

// Invokes a callable the way the client SDK does: POST {"data": ...}.
export async function callCallable(
  name: string,
  data: unknown,
  idToken?: string,
): Promise<CallableResponse> {
  const response = await fetch(
    `http://${functionsHost()}/${INTEGRATION_PROJECT_ID}/us-central1/${name}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken && {Authorization: `Bearer ${idToken}`}),
      },
      body: JSON.stringify({data}),
    },
  );
  return {status: response.status, body: await response.json()};
}
