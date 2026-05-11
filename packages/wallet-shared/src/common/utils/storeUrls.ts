import { IS_ANDROID, IS_IOS } from "@frak-labs/app-essentials/utils/platform";

const isProdStage =
    process.env.STAGE === "prod" || process.env.STAGE === "production";

export const STORE_PACKAGE_ID = isProdStage
    ? "id.frak.wallet"
    : "id.frak.wallet.dev";

export const APP_STORE_URL =
    "https://apps.apple.com/app/frak-wallet/id6740261164";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${STORE_PACKAGE_ID}`;

export function getRateAppUrl(): string | null {
    if (!isProdStage) return null;
    if (IS_IOS) return APP_STORE_URL;
    if (IS_ANDROID) return PLAY_STORE_URL;
    return null;
}
