import { registerWebComponent } from "@/utils/registerWebComponent";
import { Banner } from "./Banner";
import type { BannerProps } from "./types";

export { Banner };

/**
 * Custom element interface for `<frak-banner>`.
 * Combines standard {@link HTMLElement} with {@link BannerProps}.
 */
export interface BannerElement extends HTMLElement, BannerProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-banner": BannerElement;
    }
}

registerWebComponent(Banner, "frak-banner", ["placement", "classname"], {
    shadow: false,
});
