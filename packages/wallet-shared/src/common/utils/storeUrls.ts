import { IS_ANDROID, IS_IOS } from "@frak-labs/app-essentials/utils/platform";

const isProdStage =
    process.env.STAGE === "prod" || process.env.STAGE === "production";

export const STORE_PACKAGE_ID = isProdStage
    ? "id.frak.wallet"
    : "id.frak.wallet.dev";

// Apple ID 6759159306 (`id.frak.wallet`). The iOS SDK no longer matches this id — it only
// checks that the tapped link is an App Store listing — so an old app in the wild keeps
// working when this changes. The id still has to be right for the web install page itself.
export const APP_STORE_URL =
    "https://apps.apple.com/app/frak-wallet/id6759159306";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${STORE_PACKAGE_ID}`;

export function getRateAppUrl(): string | null {
    if (!isProdStage) return null;
    if (IS_IOS) return APP_STORE_URL;
    if (IS_ANDROID) return PLAY_STORE_URL;
    return null;
}
