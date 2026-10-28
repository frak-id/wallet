import { isRunningInProd } from "@frak-labs/app-essentials";

export const frakGame = {
    enabled: !isRunningInProd,
} as const;

/** The account connected to the stage's Meta app (FRA-372): DMs and follows are checked against it. */
const FRAK_INSTAGRAM_HANDLE = isRunningInProd ? "frak_fr" : "frak_ig_test";

export const FRAK_INSTAGRAM_URL = `https://www.instagram.com/${FRAK_INSTAGRAM_HANDLE}/`;
/** Opens the DM thread in the Instagram app; not supported on Instagram Web. Without `/m/` it only opens the app (tested 2026-10-27). */
export const FRAK_INSTAGRAM_DM_URL = `https://ig.me/m/${FRAK_INSTAGRAM_HANDLE}`;
