import {type App, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, type Firestore} from "firebase-admin/firestore";

export const INTEGRATION_PROJECT_ID = "demo-escuelas-integration";

// Requires FIRESTORE_EMULATOR_HOST (set by `firebase emulators:exec`).
export function testApp(): App {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error("FIRESTORE_EMULATOR_HOST is not set: run through " +
      "`npm run test:integration` so the emulator is available");
  }
  return getApps().find((a) => a.name === "integration") ??
    initializeApp({projectId: INTEGRATION_PROJECT_ID}, "integration");
}

export function testDb(): Firestore {
  return getFirestore(testApp());
}

export async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const url = `http://${host}/emulator/v1/projects/` +
    `${INTEGRATION_PROJECT_ID}/databases/(default)/documents`;
  const response = await fetch(url, {method: "DELETE"});
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`);
  }
}
