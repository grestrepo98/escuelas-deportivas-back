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

export type ApiResponse = {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
};

// Calls a route of a module API (e.g. "membershipApi") the way the front
// will: plain HTTP with the ID token in `Authorization: Bearer`.
export async function callApi(
  fn: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS",
  path: string,
  body?: unknown,
  idToken?: string,
): Promise<ApiResponse> {
  const response = await fetch(
    `http://${functionsHost()}/${INTEGRATION_PROJECT_ID}/us-central1/${fn}` +
      path,
    {
      method,
      headers: {
        ...(body !== undefined && {"Content-Type": "application/json"}),
        ...(idToken && {Authorization: `Bearer ${idToken}`}),
      },
      ...(body !== undefined && {body: JSON.stringify(body)}),
    },
  );
  // The Functions runtime answers a body it cannot parse with its own HTML
  // 400 before the app runs, so a non-JSON response has no `body`.
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  return {status: response.status, body: parsed, headers: response.headers};
}
