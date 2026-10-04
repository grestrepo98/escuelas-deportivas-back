import {setGlobalOptions} from "firebase-functions";

// For cost control, cap concurrent containers per function. The region is
// fixed to match Firestore's nam5 location (D-14); it cannot be changed later.
setGlobalOptions({region: "us-central1", maxInstances: 10});

export {listMyMemberships} from "./callables/listMyMemberships/index.js";
export {changeMembershipRole} from "./callables/changeMembershipRole/index.js";
export {updateTenantProfile} from "./callables/updateTenantProfile/index.js";
export {saveVenue} from "./callables/saveVenue/index.js";
export {setVenueStatus} from "./callables/setVenueStatus/index.js";
export {saveCategory} from "./callables/saveCategory/index.js";
export {setCategoryStatus} from "./callables/setCategoryStatus/index.js";
export {saveGroup} from "./callables/saveGroup/index.js";
export {setGroupStatus} from "./callables/setGroupStatus/index.js";
export {getStructure} from "./callables/getStructure/index.js";
