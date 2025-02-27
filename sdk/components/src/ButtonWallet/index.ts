import register from "preact-custom-element";
import { ButtonWallet } from "./ButtonWallet";
import type { ButtonWalletProps } from "./types";

// Button wallet element is HTML element + ButtonWalletProps
interface ButtonWalletElement extends HTMLElement, ButtonWalletProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-wallet": ButtonWalletElement;
    }
}

export function setupButtonWallet() {
    // If custom element is not already registered
    if (!customElements.get("frak-button-wallet")) {
        register(ButtonWallet, "frak-button-wallet", [], { shadow: false });
    }
}
