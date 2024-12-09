import { onDocumentReady } from "@module/utils/onDocumentReady";
import { setupClient, setupModalConfig, setupReferral } from "./utils";

export { ButtonShare } from "./ButtonShare";

/**
 * Initialize the app on document ready
 */
onDocumentReady(async function init() {
    const client = await setupClient();

    if (!client) {
        console.error("Failed to create Frak client");
        return;
    }

    // Setup the modal config
    setupModalConfig(client);

    // Setup the referral
    setupReferral(client);
});
