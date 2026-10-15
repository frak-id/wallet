import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { openExternalUrl } from "@frak-labs/wallet-shared";
import { MONERIUM_PORTAL_URL } from "./moneriumConfig";

export function openMoneriumPortal(
    environment: keyof typeof MONERIUM_PORTAL_URL
) {
    const url = MONERIUM_PORTAL_URL[environment];
    if (IS_TAURI) return openExternalUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
}
