import { frakConfig, loginModalStep } from "./module/config";
import { bindLoginButton } from "./module/login";
import { modalShare } from "./module/modalShare";
import { setupFrakClient } from "./module/setupClient";
import { displayWalletStatus } from "./module/walletStatus";

// Export the setup function and config for use in other files
window.FrakSetup = { frakConfig, frakClient: null, modalShare };

document.addEventListener("DOMContentLoaded", () => {
    console.log("NexusSDK", window.NexusSDK);
    setupFrakClient().then((frakClient) => {
        console.log("frakClient", frakClient);
        if (!frakClient) {
            console.error("Failed to create Frak client");
            return;
        }

        window.FrakSetup.frakClient = frakClient;

        window.NexusSDK.referralInteraction(frakClient, {
            modalConfig: {
                steps: {
                    login: loginModalStep,
                    openSession: {},
                    final: {
                        action: { key: "reward" },
                    },
                },
                metadata: {
                    lang: "fr",
                    isDismissible: true,
                },
            },
            options: {
                alwaysAppendUrl: true,
            },
        }).then((referral: unknown) => {
            console.log("referral", referral);
        });

        displayWalletStatus();
        bindLoginButton();
    });
});
