import { safeVibrate } from "@/utils/safeVibrate";
import { displayEmbededWallet } from "@frak-labs/core-sdk/actions";

/**
 * Open the wallet modal
 *
 * @description
 * This function will open the wallet modal with the configuration provided in the `window.FrakSetup.modalWalletConfig` object.
 */
export function openWalletModal() {
    if (!window.FrakSetup?.client) {
        console.error("Frak client not found");
        return;
    }
    safeVibrate();
    displayEmbededWallet(
        window.FrakSetup.client,
        window.FrakSetup?.modalWalletConfig ?? {}
    );
}
