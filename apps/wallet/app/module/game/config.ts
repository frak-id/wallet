import { isRunningInProd } from "@frak-labs/app-essentials";

export const frakGame = {
    enabled: !isRunningInProd,
    // shortcut: off until FRA-369 serves the linking endpoints, so testers don't DM @frak_fr mocked codes.
    instagramLink: false,
} as const;

export const FRAK_INSTAGRAM_URL = "https://www.instagram.com/frak_fr/";
/** Opens the DM thread with @frak_fr in the Instagram app; not supported on Instagram Web. Without `/m/` it only opens the app (tested 2026-10-27). */
export const FRAK_INSTAGRAM_DM_URL = "https://ig.me/m/frak_fr";
