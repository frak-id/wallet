import { loadScript } from "@module/utils/loadScript";
// import { gapianne } from "./gapianne";
import { moov360 } from "./moov360";

const WEBSITE_OVERRIDES: Record<string, () => void> = {
    "moov360.com": moov360,
    // "gapianne.com": gapianne,
};

export function websiteOverrides() {
    const override = WEBSITE_OVERRIDES[window.location.host];
    if (override) {
        override();
    }

    loadScript(
        "frak-components",
        "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/dist/bundle/components.js"
    );
}
