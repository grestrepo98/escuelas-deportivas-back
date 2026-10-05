import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {parseCreateTenantArgs, runCreateTenant} from "./create-tenant-lib.js";

// Usage (arguments go after `--`):
//   firebase emulators:exec --only auth,firestore --project demo-escuelas \
//     "npm run tenant:create -- --target emulator --tenant-id escuela-x \
//      --name 'Escuela X' --owner-email dueno@escuela-x.co"
//   npm run tenant:create -- --target dev --tenant-id escuela-x \
//     --name 'Escuela X' --owner-email dueno@escuela-x.co
async function main(): Promise<void> {
  const args = parseCreateTenantArgs(process.argv.slice(2), process.env);
  const app = initializeApp({projectId: args.projectId});
  console.log(
    `Creating "${args.tenantId}" on "${args.target}" ` +
      `(project ${args.projectId})...`,
  );
  const result = await runCreateTenant({
    db: getFirestore(app),
    auth: getAuth(app),
    tenantId: args.tenantId,
    name: args.name,
    ownerEmail: args.ownerEmail,
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "\nSend the reset link to the owner over a private channel: " +
      "whoever opens it can set the owner's password.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
