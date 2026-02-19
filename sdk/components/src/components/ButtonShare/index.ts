import { registerWebComponent } from "@/utils/registerWebComponent";
import { ButtonShare } from "./ButtonShare";
import type { ButtonShareProps } from "./types";

export { ButtonShare };

/**
 * Custom element interface for `<frak-button-share>`.
 * Combines standard {@link HTMLElement} with {@link ButtonShareProps}.
 */
export interface ButtonShareElement extends HTMLElement, ButtonShareProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-share": ButtonShareElement;
    }
}

// Register the ButtonShare component
registerWebComponent(ButtonShare, "frak-button-share", ["text"], {
    shadow: false,
});
