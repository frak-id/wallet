import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import type { Hex } from "viem";

export type PendingInteraction = {
    productId: Hex;
    interaction: PreparedInteraction;
    signature?: Hex;
    timestamp: number;
};
