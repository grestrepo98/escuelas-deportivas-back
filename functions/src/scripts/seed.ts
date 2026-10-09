import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {parseSeedArgs, runSeed} from "./seed-lib.js";

// Usage:
//   npm run seed:emulator   (through firebase emulators:exec / start)
//   SEED_PASSWORD=... npm run seed:dev
async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2), process.env);
  const app = initializeApp({projectId: args.projectId});
  console.log(`Seeding "${args.target}" (project ${args.projectId})...`);
  // The emulator has no default bucket for a demo project; `dev` needs the
  // name of its bucket (Cloud Console > Storage).
  const bucketName =
    process.env.STORAGE_BUCKET ??
    (args.target === "emulator" ? `${args.projectId}.appspot.com` : undefined);
  if (!bucketName) {
    throw new Error(
      "--target dev needs STORAGE_BUCKET (the name of the dev bucket), " +
        "to seed the fictitious document files",
    );
  }
  const summary = await runSeed({
    db: getFirestore(app),
    auth: getAuth(app),
    bucket: getStorage(app).bucket(bucketName),
    password: args.password,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
