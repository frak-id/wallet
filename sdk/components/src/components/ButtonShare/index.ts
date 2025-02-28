import { initFrakSdk } from "@/utils/initFrakSdk";
import { onDocumentReady } from "@shared/module/utils/onDocumentReady";
import register from "preact-custom-element";
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

if (typeof window !== "undefined") {
    onDocumentReady(async function init() {
        await initFrakSdk();
    });

    // If custom element is not already registered
    if (!customElements.get("frak-button-share")) {
        register(ButtonShare, "frak-button-share", ["text"], { shadow: false });
    }
}
