import {onRequest} from "firebase-functions/v2/https";
import {createApi} from "../../../shared/infrastructure/http/create-api.js";
import {membershipRouter} from "./router.js";

// `cors: true` while only `dev` exists; a list of origins per environment is a
// prerequisite for creating `prod` (spec 04, ADR 0009).
export const membershipApi = onRequest(
  {cors: true},
  createApi(membershipRouter()),
);
