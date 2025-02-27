import { onDocumentReady } from "@shared/module/utils/onDocumentReady";
import { initFrakSdk } from "./utils/initFrakSdk";

/**
 * Initialize the app on document ready
 */
onDocumentReady(async function initComponents() {
    await initFrakSdk();
});
