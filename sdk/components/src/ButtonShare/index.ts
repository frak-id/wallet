import register from "preact-custom-element";
import { ButtonShare } from "./ButtonShare";
import type { ButtonShareProps } from "./types";

// Button share element is HTML element + ButtonShareProps
interface ButtonShareElement extends HTMLElement, ButtonShareProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-share": ButtonShareElement;
    }
}

export function setupButtonShare() {
    // If custom element is not already registered
    if (!customElements.get("frak-button-share")) {
        register(ButtonShare, "frak-button-share", ["text"], { shadow: false });
    }
}
