import {setGlobalOptions} from "firebase-functions";

// For cost control, cap concurrent containers per function. The region is
// fixed to match Firestore's nam5 location (D-14); it cannot be changed later.
setGlobalOptions({region: "us-central1", maxInstances: 10});

export {membershipApi} from "./membership/infrastructure/http/membership-api.js";
export {tenantApi} from "./tenant/infrastructure/http/tenant-api.js";
export {structureApi} from "./structure/infrastructure/http/structure-api.js";
export {playerApi} from "./player/infrastructure/http/player-api.js";
export {documentApi} from "./document/infrastructure/http/document-api.js";
