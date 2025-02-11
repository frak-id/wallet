import { loadScript } from "@module/utils/loadScript";
import { gapianne } from "./gapianne";

const WEBSITE_OVERRIDES: Record<string, () => void> = {
    "gapianne.com": gapianne,
};

export function websiteOverrides() {
    const override = WEBSITE_OVERRIDES[window.location.host];
    if (override) {
        override();

        loadScript(
            "frak-components",
            "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/cdn/components.js"
        );
    }
}
