import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {parseSeedArgs, runSeed} from "./seed-lib.js";

// Usage:
//   npm run seed:emulator   (through firebase emulators:exec / start)
//   SEED_PASSWORD=... npm run seed:dev
async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2), process.env);
  const app = initializeApp({projectId: args.projectId});
  console.log(`Seeding "${args.target}" (project ${args.projectId})...`);
  const summary = await runSeed({
    db: getFirestore(app),
    auth: getAuth(app),
    password: args.password,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
