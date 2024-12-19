import register from "preact-custom-element";
import { ButtonShare, type ButtonShareProps } from "./ButtonShare";

// Button share element is HTML element + ButtonShareProps
interface ButtonShareElement extends HTMLElement, ButtonShareProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-share": ButtonShareElement;
    }
}

// If custom element is not already registered
if (!customElements.get("frak-button-share")) {
    register(ButtonShare, "frak-button-share", ["text"], { shadow: false });
}

export { ButtonShare };
