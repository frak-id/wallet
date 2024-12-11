import { loadScript } from "@module/utils/loadScript";

/**
 * This whole script is only a flat pass to the newer SDK versions
 */
loadScript(
    "frak-core-sdk",
    "https://cdn.jsdelivr.net/npm/@frak-labs/core-sdk@latest/dist/bundle/bundle.js"
).then(() => {
    console.log("Frak core SDK loaded");
    // Re-export FrakSDK as NexusSDK
    //  todo: Are we sure that this will work?
    //  todo: Will the lazy loading of the SDK be a problem?
    window.NexusSDK = window.FrakSDK;
});
