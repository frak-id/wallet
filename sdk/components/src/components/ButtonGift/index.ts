import { registerWebComponent } from "@/utils/registerWebComponent";
import { ButtonGift } from "./ButtonGift";
import type { ButtonGiftProps } from "./types";

export { ButtonGift };

// Button gift element is HTML element + ButtonGiftProps
export interface ButtonGiftElement extends HTMLElement, ButtonGiftProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-gift": ButtonGiftElement;
    }
}

// Register the ButtonGift component
registerWebComponent(ButtonGift, "frak-button-gift", [], { shadow: false });
