import type {Clock} from "../domain/clock.js";

export const systemClock: Clock = {now: () => new Date()};
