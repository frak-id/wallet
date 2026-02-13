import { registerWebComponent } from "@/utils/registerWebComponent";
import { OpenInAppButton } from "./OpenInAppButton";
import type { OpenInAppButtonProps } from "./types";

export { OpenInAppButton };

export interface OpenInAppButtonElement
    extends HTMLElement,
        OpenInAppButtonProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-open-in-app": OpenInAppButtonElement;
    }
}

registerWebComponent(OpenInAppButton, "frak-open-in-app", ["text"], {
    shadow: false,
});
