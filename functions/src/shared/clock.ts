import type {Clock} from "@escuelas/domain";

export const systemClock: Clock = {now: () => new Date()};
