import { isRunningInProd } from "@frak-labs/app-essentials";

export const frakGame = {
    enabled: !isRunningInProd,
} as const;
