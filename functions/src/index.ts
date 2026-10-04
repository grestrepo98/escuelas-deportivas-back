import {setGlobalOptions} from "firebase-functions";

// For cost control, cap concurrent containers per function. The region is
// fixed to match Firestore's nam5 location (D-14); it cannot be changed later.
setGlobalOptions({region: "us-central1", maxInstances: 10});

export {
  listMyMemberships,
} from "./membership/infrastructure/callables/listMyMemberships/index.js";
export {
  changeMembershipRole,
} from "./membership/infrastructure/callables/changeMembershipRole/index.js";
export {
  updateTenantProfile,
} from "./tenant/infrastructure/callables/updateTenantProfile/index.js";
export {
  saveVenue,
} from "./structure/infrastructure/callables/saveVenue/index.js";
export {
  setVenueStatus,
} from "./structure/infrastructure/callables/setVenueStatus/index.js";
export {
  saveCategory,
} from "./structure/infrastructure/callables/saveCategory/index.js";
export {
  setCategoryStatus,
} from "./structure/infrastructure/callables/setCategoryStatus/index.js";
export {
  saveGroup,
} from "./structure/infrastructure/callables/saveGroup/index.js";
export {
  setGroupStatus,
} from "./structure/infrastructure/callables/setGroupStatus/index.js";
export {
  getStructure,
} from "./structure/infrastructure/callables/getStructure/index.js";
