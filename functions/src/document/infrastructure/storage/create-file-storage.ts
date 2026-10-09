import {storageBucket} from "../../../shared/infrastructure/admin.js";
import type {FileStorage} from "../../application/file-storage.js";
import {EmulatorFileStorage} from "./emulator-file-storage.js";
import {GcsFileStorage} from "./gcs-file-storage.js";

// Picks the adapter by environment: the Functions emulator cannot sign URLs.
export function createFileStorage(): FileStorage {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (process.env.FUNCTIONS_EMULATOR === "true" && emulatorHost) {
    // The emulator has no default bucket for a demo project.
    const bucket = storageBucket(
      process.env.STORAGE_BUCKET ?? `${process.env.GCLOUD_PROJECT}.appspot.com`,
    );
    return new EmulatorFileStorage(bucket, emulatorHost);
  }
  return new GcsFileStorage(storageBucket());
}
