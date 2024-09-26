import type { Hex } from "viem";
import type { pendingInteractionsTable } from "../../db/schema";

export type InteractionData = {
    handlerTypeDenominator: Hex;
    interactionData: Hex;
};

export type PreparedInteraction = {
    interaction: typeof pendingInteractionsTable.$inferSelect;
    signature: Hex;
    packedInteraction: Hex;
};
