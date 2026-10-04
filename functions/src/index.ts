import {setGlobalOptions} from "firebase-functions";

// For cost control, cap concurrent containers per function. The region is
// fixed to match Firestore's nam5 location (D-14); it cannot be changed later.
setGlobalOptions({region: "us-central1", maxInstances: 10});

export {listMyMemberships} from "./callables/listMyMemberships/index.js";
export {changeMembershipRole} from "./callables/changeMembershipRole/index.js";
