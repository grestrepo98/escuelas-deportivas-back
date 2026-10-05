import {z} from "zod";

// What a client sends as a scope: venues and groups only. Players are never
// assigned by hand (they come with the guardian and player modules).
const id = z.string().min(1).max(128);
const ids = z.array(id).max(100);

export const scopeInput = z
  .object({
    venueIds: ids.optional(),
    groupIds: ids.optional(),
  })
  .strict();

export const scopeOutput = z.object({
  venueIds: z.array(z.string()),
  groupIds: z.array(z.string()),
  playerIds: z.array(z.string()),
});
