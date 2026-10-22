import { isRunningInProd } from "@frak-labs/app-essentials";

export const frakGame = {
    enabled: !isRunningInProd,
} as const;

export const FRAK_INSTAGRAM_URL = "https://www.instagram.com/frak_fr/";
