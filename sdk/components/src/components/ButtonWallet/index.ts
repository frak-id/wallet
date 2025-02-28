import { initFrakSdk } from "@/utils/initFrakSdk";
import { onDocumentReady } from "@shared/module/utils/onDocumentReady";
import register from "preact-custom-element";
import { ButtonWallet } from "./ButtonWallet";
import type { ButtonWalletProps } from "./types";

export { ButtonWallet };

// Button wallet element is HTML element + ButtonWalletProps
export interface ButtonWalletElement extends HTMLElement, ButtonWalletProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-wallet": ButtonWalletElement;
    }
}

if (typeof window !== "undefined") {
    onDocumentReady(async function init() {
        await initFrakSdk();
    });

    // If custom element is not already registered
    if (!customElements.get("frak-button-wallet")) {
        register(ButtonWallet, "frak-button-wallet", [], { shadow: false });
    }
}
