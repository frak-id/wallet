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

register(ButtonShare, "frak-button-share", ["text"], { shadow: false });

export { ButtonShare };
