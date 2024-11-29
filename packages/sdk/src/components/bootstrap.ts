import {
    loadScript,
    onDocumentReady,
    setupClient,
    setupModalConfig,
    setupReferral,
} from "./utils";

export { ButtonShare } from "./ButtonShare";

/**
 * Start loading the Frak SDK
 */
const loadSdk = loadScript(
    "https://cdn.jsdelivr.net/npm/@frak-labs/nexus-sdk@latest/dist/bundle/bundle.js"
);

/**
 * Initialize the app on document ready
 */
onDocumentReady(async function init() {
    await loadSdk;
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
