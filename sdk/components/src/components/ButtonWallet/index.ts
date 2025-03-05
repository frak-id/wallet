import { registerWebComponent } from "@/utils/registerWebComponent";
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

// Register the ButtonWallet component
registerWebComponent(ButtonWallet, "frak-button-wallet", [], { shadow: false });
