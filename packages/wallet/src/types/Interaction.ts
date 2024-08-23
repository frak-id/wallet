import type { PreparedInteraction } from "@frak-labs/nexus-sdk/core";
import type { Hex } from "viem";

export type PendingInteraction = {
    contentId: Hex;
    interaction: PreparedInteraction;
    signature?: Hex;
    timestamp: number;
};
