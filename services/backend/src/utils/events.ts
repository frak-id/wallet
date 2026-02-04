import type { InteractionType } from "../domain/rewards";

export type FrakEvents = {
    newInteraction: [{ type: InteractionType }];
    newPendingRewards: [{ count: number }];
};
