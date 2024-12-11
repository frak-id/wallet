import register from "preact-custom-element";
import { ButtonShare } from "./ButtonShare";

interface ButtonShareElement extends HTMLElement {
    text: string;
    classname?: string;
}

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
