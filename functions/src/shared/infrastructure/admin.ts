import {getApps, initializeApp} from "firebase-admin/app";
import {type Firestore, getFirestore} from "firebase-admin/firestore";

const DEFAULT_APP_NAME = "[DEFAULT]";

// Lazy default-app Firestore, so importing a module never initializes it.
// Check for the default app by name: the Functions runtime may already own
// apps with other names, so `getApps().length` is not a valid test.
export function firestore(): Firestore {
  if (!getApps().some((app) => app.name === DEFAULT_APP_NAME)) {
    initializeApp();
  }
  return getFirestore();
}
