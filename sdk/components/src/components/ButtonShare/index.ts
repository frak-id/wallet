import { registerWebComponent } from "@/utils/registerWebComponent";
import { ButtonShare } from "./ButtonShare";
import type { ButtonShareProps } from "./types";

export { ButtonShare };

// Button share element is HTML element + ButtonShareProps
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
