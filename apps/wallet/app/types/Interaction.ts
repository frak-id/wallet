import type { PreparedInteraction } from "@frak-labs/core-sdk";
import type { Hex } from "viem";

export type PendingInteraction = {
    productId: Hex;
    interaction: PreparedInteraction;
    signature?: Hex;
    timestamp: number;
};
