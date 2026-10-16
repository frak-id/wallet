import type { MoneriumEnvironment } from "@frak-labs/app-essentials/monerium";
import { isRunningInProd } from "@frak-labs/app-essentials/utils/env";

export const isMoneriumEnabled = !isRunningInProd;

/** Where a user manages or contests their Monerium account. */
export const MONERIUM_PORTAL_URL: Record<MoneriumEnvironment, string> = {
    production: "https://monerium.app",
    sandbox: "https://sandbox.monerium.dev",
};
