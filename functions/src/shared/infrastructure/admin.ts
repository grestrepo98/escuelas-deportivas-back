import {type App, getApp, getApps, initializeApp} from "firebase-admin/app";
import {type Auth, getAuth} from "firebase-admin/auth";
import {type Firestore, getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

const DEFAULT_APP_NAME = "[DEFAULT]";

// Lazy default app, so importing a module never initializes it. Check for the
// default app by name: the Functions runtime may already own apps with other
// names, so `getApps().length` is not a valid test.
function defaultApp(): App {
  if (!getApps().some((app) => app.name === DEFAULT_APP_NAME)) {
    initializeApp();
  }
  return getApp();
}

export function firestore(): Firestore {
  return getFirestore(defaultApp());
}

export function adminAuth(): Auth {
  return getAuth(defaultApp());
}

// The default bucket comes from the app config (FIREBASE_CONFIG in the
// Functions runtime); STORAGE_BUCKET overrides it.
export function storageBucket(
  name = process.env.STORAGE_BUCKET,
): ReturnType<ReturnType<typeof getStorage>["bucket"]> {
  return getStorage(defaultApp()).bucket(name);
}
